package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// AxyraBot - Twitch bot that connects via IRC WebSocket and listens to EventSub WebSocket

var (
	eventSubSessionID string
	eventSubMu        sync.Mutex
	activeMu          sync.Mutex
	activeChannels    = map[string]bool{}

	// caches for Helix send chat message API
	helixChatMu         sync.Mutex
	helixBotUserID      string
	helixBroadcasterIDs = map[string]string{}
	appAccessToken      string

	// cached live-status per channel to avoid hitting Helix on every message
	liveStatusMu    sync.Mutex
	liveStatusCache = map[string]liveStatusEntry{}
)

// List of built-in default commands that can be toggled per broadcaster.
var defaultCommandNames = []string{
	"!hello",
	"!test",
	"!testanc",
	"!vanish",
	"!title",
	"!game",
	"!accountage",
	"!followage",
	"!uptime",
}

type liveStatusEntry struct {
	live      bool
	checkedAt time.Time
}

func main() {
	botName := os.Getenv("TWITCH_BOT_USERNAME")
	if botName == "" {
		botName = "AxyraBot"
	}

	oauth := os.Getenv("TWITCH_BOT_OAUTH") // should be in form: oauth:xxxxxxxxxxxx
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
	channel := os.Getenv("TWITCH_CHANNEL")

	if oauth == "" || clientID == "" || clientSecret == "" {
		log.Println("Missing required env vars. See .env.example or README.md")
	}

	// Token persistence: allow configurable tokens path via TWITCH_TOKENS_PATH
	// If not set, default to a tokens.json located next to the binary.
	tokensPath := os.Getenv("TWITCH_TOKENS_PATH")
	if tokensPath == "" {
		if exe, err := os.Executable(); err == nil {
			tokensPath = filepath.Join(filepath.Dir(exe), "tokens.json")
		} else {
			tokensPath = "tokens.json"
		}
	}

	// If TWITCH_BOT_OAUTH is set in the environment, persist it (strip "oauth:")
	if oauth != "" {
		saveTokenIfMissing(tokensPath, oauth)
	} else {
		// If env not set, try to load from tokens.json
		if t, err := loadTokens(tokensPath); err == nil && t.AccessToken != "" {
			oauth = "oauth:" + t.AccessToken
			os.Setenv("TWITCH_BOT_OAUTH", oauth)
		}
	}

	// If we have an OAuth token, validate it and, if possible, derive the
	// correct login name from Twitch so our IRC NICK matches the token.
	if oauth != "" {
		access := strings.TrimPrefix(oauth, "oauth:")
		if login, err := getLoginFromToken(access); err == nil && login != "" {
			botName = login
			log.Println("Using bot login from token:", botName)
		} else if err != nil {
			log.Println("failed to validate bot token:", err)
		}
	}

	// Start token refresher (only active if refresh token present in tokens.json)
	go tokenRefresher(tokensPath, clientID, clientSecret)

	// Initialize DB (if configured)
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		if err := InitDB(dbURL); err != nil {
			log.Println("failed to init db:", err)
		} else {
			if err := EnsureSchema(); err != nil {
				log.Println("failed ensure schema:", err)
			} else {
				log.Println("database initialized successfully")
				// start postgres notifier for dynamic joins
				if err := StartNotifier(dbURL); err != nil {
					log.Println("failed to start notifier:", err)
				}
			}
		}
	}

	// Start EventSub WebSocket reader
	go startEventSubWS()

	// Obtain app access token and list current EventSub subscriptions
	token, err := getAppAccessToken(clientID, clientSecret)
	if err != nil {
		log.Println("failed to get app token:", err)
	} else {
		// cache app access token for Helix chat API usage
		helixChatMu.Lock()
		appAccessToken = token
		helixChatMu.Unlock()

		if err := listEventSubSubscriptions(token, clientID); err != nil {
			log.Println("failed listing subscriptions:", err)
		}

		// attempt to register EventSub subscriptions for the configured channel
		go registerEventSubSubscriptions(token, clientID, channel, tokensPath)
	}

	// Optionally start IRC WebSocket bots for legacy chat reading if explicitly enabled.
	// By default, chat is read via EventSub channel.chat.message instead.
	if os.Getenv("TWITCH_IRC_ENABLED") == "1" {
		go func() {
			chans := []string{}
			// if DB present, join all channels marked joined
			if db != nil {
				if cs, err := GetJoinedChannels(); err == nil && len(cs) > 0 {
					chans = cs
				}
			}
			// if no DB channels yet but TWITCH_CHANNEL is set, fall back to it
			if len(chans) == 0 && channel != "" {
				chans = []string{channel}
			}
			if len(chans) == 0 {
				log.Println("no channels configured to join yet; waiting for /auth/callback to add channels")
				return
			}
			for _, ch := range chans {
				go startIrcBot(botName, oauth, ch)
				markActiveChannel(ch)
				time.Sleep(250 * time.Millisecond)
			}
		}()
	} else {
		log.Println("TWITCH_IRC_ENABLED is not set; using EventSub channel.chat.message for chat reading")
	}

	// Start HTTP server for OAuth + join endpoints
	go startHTTPServer(clientID, clientSecret)

	// Block forever
	select {}
}

// startEventSubWS connects to Twitch EventSub WebSocket endpoint and logs messages.
func startEventSubWS() {
	url := "wss://eventsub.wss.twitch.tv/ws"
	for {
		log.Println("Connecting to EventSub WebSocket...")
		c, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			log.Println("eventsub ws dial error:", err)
			time.Sleep(10 * time.Second)
			continue
		}

		// read loop
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("eventsub ws read error:", err)
				c.Close()
				break
			}
			// try to decode and capture session id from session_welcome and handle notifications
			var m map[string]interface{}
			if err := json.Unmarshal(message, &m); err == nil {
				if metadata, ok := m["metadata"].(map[string]interface{}); ok {
					if mt, ok := metadata["message_type"].(string); ok {
						switch mt {
						case "session_welcome":
							if payload, ok := m["payload"].(map[string]interface{}); ok {
								if session, ok := payload["session"].(map[string]interface{}); ok {
									if id, ok := session["id"].(string); ok {
										eventSubMu.Lock()
										eventSubSessionID = id
										eventSubMu.Unlock()
										log.Println("EventSub session id set:", id)
									}
								}
							}
						case "notification":
							if payload, ok := m["payload"].(map[string]interface{}); ok {
								if sub, ok := payload["subscription"].(map[string]interface{}); ok {
									stype, _ := sub["type"].(string)
									switch stype {
									case "channel.chat.message":
										if event, ok := payload["event"].(map[string]interface{}); ok {
											channelLogin, _ := event["broadcaster_user_login"].(string)
											chatterLogin, _ := event["chatter_user_login"].(string)
											msgText := ""
											if msgObj, ok := event["message"].(map[string]interface{}); ok {
												if t, ok := msgObj["text"].(string); ok {
													msgText = t
												}
											}
											if channelLogin != "" && msgText != "" {
												go handleChatMessageEvent(channelLogin, chatterLogin, msgText)
											}
										}
									case "channel.follow":
										if event, ok := payload["event"].(map[string]interface{}); ok {
											channelLogin, _ := event["broadcaster_user_login"].(string)
											followerName, _ := event["user_name"].(string)
											broadcasterID, _ := event["broadcaster_user_id"].(string)
											if channelLogin != "" && followerName != "" {
												go func(ch, follower, bID string) {
													msg := ""
													if bID != "" {
														if total, err := getFollowerCount(bID); err != nil {
															log.Println("failed to get follower count:", err)
															msg = fmt.Sprintf("Thank you for the follow %s! <3", follower)
														} else {
															msg = fmt.Sprintf("Thank you for the follow %s! <3 Channel total: %d", follower, total)
														}
													} else {
														msg = fmt.Sprintf("Thank you for the follow %s! <3", follower)
													}
													if err := sendHelixChatMessage(ch, msg); err != nil {
														log.Println("failed to send follow thank-you message:", err)
													}
												}(channelLogin, followerName, broadcasterID)
											}
										}
									case "stream.online":
										if event, ok := payload["event"].(map[string]interface{}); ok {
											channelLogin, _ := event["broadcaster_user_login"].(string)
											if channelLogin != "" {
												go func(ch string) {
													title, game, err := getChannelTitleAndGame(ch)
													if err != nil {
														log.Println("failed to fetch title/game for stream.online:", err)
													}
													if title == "" {
														title = "Untitled stream"
													}
													if game == "" {
														game = "Just Chatting"
													}
													msg := fmt.Sprintf("%s is now live! Streaming %s | %s", ch, game, title)
													if err := sendHelixChatMessage(ch, msg); err != nil {
														log.Println("failed to send stream.online live message:", err)
													}
												}(channelLogin)
											}
										}
									}
								}
							}
						}
					}
				}
			}
			log.Printf("[EventSub WS] %s\n", string(message))
		}

		time.Sleep(5 * time.Second)
	}
}

// startIrcBot connects to Twitch IRC over WebSocket and performs simple interactions.
func startIrcBot(botName, oauth, channel string) {
	url := "wss://irc-ws.chat.twitch.tv:443"
	for {
		log.Println("Connecting to Twitch IRC WebSocket...")
		c, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			log.Println("irc ws dial error:", err)
			time.Sleep(10 * time.Second)
			continue
		}

		// Send auth and join
		if oauth != "" {
			writeIRC(c, fmt.Sprintf("PASS %s", oauth))
		}
		writeIRC(c, fmt.Sprintf("NICK %s", botName))
		writeIRC(c, "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership")
		writeIRC(c, fmt.Sprintf("JOIN #%s", strings.ToLower(channel)))

		// Read loop
		sentHello := false
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				log.Println("irc ws read error:", err)
				c.Close()
				break
			}
			text := string(msg)
			// Twitch IRC sometimes sends multiple lines in one message
			for _, line := range strings.Split(text, "\r\n") {
				if line == "" {
					continue
				}
				log.Printf("[IRC] %s\n", line)
				if strings.HasPrefix(line, "PING") {
					// respond to PING
					resp := strings.Replace(line, "PING", "PONG", 1)
					writeIRC(c, resp)
					continue
				}

				// detect when our bot joined and send a greeting once
				if !sentHello && strings.Contains(line, "JOIN #"+strings.ToLower(channel)) && strings.Contains(line, ":"+strings.ToLower(botName)+"!") {
					sendChat(c, strings.ToLower(channel), "hello chat")
					sentHello = true
				}

				// simple PRIVMSG parsing
				// format can be: :username!username@username.tmi.twitch.tv PRIVMSG #channel :message
				if strings.Contains(line, "PRIVMSG") {
					// Prefer to extract the message part after the second " :" which appears after the PRIVMSG target.
					// Example with tags: "@tags :user!user@user.tmi.twitch.tv PRIVMSG #chan :message"
					message := ""
					if i := strings.Index(line, " PRIVMSG "); i != -1 {
						// find the separator " :" after the PRIVMSG portion
						if j := strings.Index(line[i:], " :"); j != -1 {
							message = line[i+j+2:]
						}
					}
					// fallback: split on first " :"
					if message == "" {
						parts := strings.SplitN(line, " :", 2)
						if len(parts) < 2 {
							continue
						}
						message = parts[1]
					}
					// debug: log the parsed message content
					log.Printf("[PARSED] message=%q", message)
					if strings.HasPrefix(message, "!hello") {
						sendChat(c, strings.ToLower(channel), fmt.Sprintf("Hello! I am %s", botName))
					}
					// respond to !test with SUCCESS
					if strings.HasPrefix(message, "!test") {
						sendChat(c, strings.ToLower(channel), "SUCCESS")
					}
				}
			}
		}

		time.Sleep(5 * time.Second)
	}
}

func writeIRC(c *websocket.Conn, line string) {
	// ensure CRLF
	if !strings.HasSuffix(line, "\r\n") {
		line = line + "\r\n"
	}
	if err := c.WriteMessage(websocket.TextMessage, []byte(line)); err != nil {
		log.Println("irc write error:", err)
	}
}

// handleChatMessageEvent processes a chat message received via EventSub
// channel.chat.message and runs simple command handlers.
func handleChatMessageEvent(channelLogin, chatterLogin, message string) {
	channelLogin = strings.ToLower(channelLogin)
	log.Printf("[CHAT] channel=%s user=%s msg=%q", channelLogin, chatterLogin, message)

	// update approximate watch time based on chat activity, but only while live
	if db != nil && isChannelLive(channelLogin) {
		if err := UpdateWatchTime(channelLogin, strings.ToLower(chatterLogin), time.Now().UTC()); err != nil {
			log.Println("failed to update watch time:", err)
		}
	}

	botName := os.Getenv("TWITCH_BOT_USERNAME")
	if botName == "" {
		botName = "AxyraBot"
	}

	// basic commands migrated from IRC handler
	if strings.HasPrefix(message, "!hello") {
		if !isDefaultCommandEnabled(channelLogin, "!hello") {
			return
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("Hello! I am %s", botName)); err != nil {
			log.Println("failed to send !hello response:", err)
		}
	}
	if strings.HasPrefix(message, "!test") {
		if !isDefaultCommandEnabled(channelLogin, "!test") {
			return
		}
		if err := sendHelixChatMessage(channelLogin, "SUCCESS"); err != nil {
			log.Println("failed to send !test response:", err)
		}
	}
	if strings.HasPrefix(message, "!testanc") {
		if !isDefaultCommandEnabled(channelLogin, "!testanc") {
			return
		}
		// Send a Twitch announcement using the Helix Chat Announcement API.
		// The bot account must be a moderator or broadcaster in the channel
		// and its token must include moderator:manage:announcements.
		if err := sendHelixChatAnnouncement(channelLogin, "success", ""); err != nil {
			log.Println("failed to send !testanc announcement:", err)
		}
	}

	// !vanish - timeout the user for 1 second with a playful reason
	if strings.HasPrefix(message, "!vanish") {
		if !isDefaultCommandEnabled(channelLogin, "!vanish") {
			return
		}
		if err := timeoutUser(channelLogin, chatterLogin, 1, "wanted to hide \"something\""); err != nil {
			log.Println("failed to apply !vanish timeout:", err)
		} else {
			if err := sendHelixChatMessage(channelLogin, "Come back here and face it"); err != nil {
				log.Println("failed to send !vanish response:", err)
			}
		}
	}

	// !title (text) - change stream title (mods + broadcaster only)
	if strings.HasPrefix(message, "!title") {
		if !isDefaultCommandEnabled(channelLogin, "!title") {
			return
		}
		// Require broadcaster or moderator
		allowed, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
		if err != nil {
			log.Println("failed moderator check for !title:", err)
		}
		if !allowed {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("@%s only the broadcaster or a moderator can use !title", chatterLogin)); err != nil {
				log.Println("failed to send !title permission response:", err)
			}
			return
		}
		// Extract the new title text after the command keyword
		text := strings.TrimSpace(strings.TrimPrefix(message, "!title"))
		if text == "" {
			if err := sendHelixChatMessage(channelLogin, "Usage: !title <new title>"); err != nil {
				log.Println("failed to send !title usage response:", err)
			}
			return
		}
		if err := updateStreamInfoFromChat(channelLogin, text, ""); err != nil {
			log.Println("failed to update title from !title:", err)
		} else {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("New title is set: %s", text)); err != nil {
				log.Println("failed to send !title confirmation:", err)
			}
		}
	}

	// !game (text) - change Twitch category (mods + broadcaster only)
	if strings.HasPrefix(message, "!game") {
		if !isDefaultCommandEnabled(channelLogin, "!game") {
			return
		}
		allowed, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
		if err != nil {
			log.Println("failed moderator check for !game:", err)
		}
		if !allowed {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("@%s only the broadcaster or a moderator can use !game", chatterLogin)); err != nil {
				log.Println("failed to send !game permission response:", err)
			}
			return
		}
		text := strings.TrimSpace(strings.TrimPrefix(message, "!game"))
		if text == "" {
			if err := sendHelixChatMessage(channelLogin, "Usage: !game <category name>"); err != nil {
				log.Println("failed to send !game usage response:", err)
			}
			return
		}
		if err := updateStreamInfoFromChat(channelLogin, "", text); err != nil {
			log.Println("failed to update category from !game:", err)
		} else {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("New category %s", text)); err != nil {
				log.Println("failed to send !game confirmation:", err)
			}
		}
	}

	// !accountage [username] - report when a user's account was created
	if strings.HasPrefix(message, "!accountage") {
		if !isDefaultCommandEnabled(channelLogin, "!accountage") {
			return
		}
		arg := strings.TrimSpace(strings.TrimPrefix(message, "!accountage"))
		targetDisplay := chatterLogin
		targetLogin := chatterLogin
		if arg != "" {
			// allow mentions like @user
			clean := strings.TrimSpace(arg)
			clean = strings.TrimPrefix(clean, "@")
			if clean != "" {
				targetDisplay = clean
				targetLogin = clean
			}
		}
		ageText, err := getAccountAgeString(targetLogin)
		if err != nil {
			log.Println("failed to get account age:", err)
			return
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s's account was created %s ago", targetDisplay, ageText)); err != nil {
			log.Println("failed to send !accountage response:", err)
		}
	}

	// !followage [username] - report how long a user has been following the broadcaster
	if strings.HasPrefix(message, "!followage") {
		if !isDefaultCommandEnabled(channelLogin, "!followage") {
			return
		}
		arg := strings.TrimSpace(strings.TrimPrefix(message, "!followage"))
		targetDisplay := chatterLogin
		targetLogin := chatterLogin
		if arg != "" {
			clean := strings.TrimSpace(arg)
			clean = strings.TrimPrefix(clean, "@")
			if clean != "" {
				targetDisplay = clean
				targetLogin = clean
			}
		}
		ageText, err := getFollowAgeString(channelLogin, targetLogin)
		if err != nil {
			log.Println("failed to get follow age:", err)
			return
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s has been following %s for %s", targetDisplay, channelLogin, ageText)); err != nil {
			log.Println("failed to send !followage response:", err)
		}
	}

	// !uptime - report how long the broadcaster has been live this session
	if strings.HasPrefix(message, "!uptime") {
		if !isDefaultCommandEnabled(channelLogin, "!uptime") {
			return
		}
		uptime, err := getStreamUptimeString(channelLogin)
		if err != nil {
			log.Println("failed to get uptime:", err)
			return
		}
		if uptime == "" {
			// not live
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s is not currently live", channelLogin)); err != nil {
				log.Println("failed to send !uptime offline response:", err)
			}
			return
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s has been live for %s", channelLogin, uptime)); err != nil {
			log.Println("failed to send !uptime response:", err)
		}
	}

}

// isBroadcasterOrModerator checks whether chatterLogin is the broadcaster for
// channelLogin or a moderator in that channel using the broadcaster's token
// and the Helix Get Moderators endpoint.
func isBroadcasterOrModerator(channelLogin, chatterLogin string) (bool, error) {
	channelLogin = strings.ToLower(channelLogin)
	chatterLogin = strings.ToLower(chatterLogin)
	if channelLogin == chatterLogin {
		return true, nil
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return false, fmt.Errorf("TWITCH_CLIENT_ID not set")
	}

	access, err := GetUserAccessToken(channelLogin)
	if err != nil || access == "" {
		return false, fmt.Errorf("no user token for channel %s: %w", channelLogin, err)
	}

	// Resolve broadcaster id from their token
	broadcasterID, err := getUserIDFromToken(access)
	if err != nil {
		return false, fmt.Errorf("getUserIDFromToken failed: %w", err)
	}

	// Resolve chatter user id via /users
	usersReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(chatterLogin), nil)
	if err != nil {
		return false, err
	}
	usersReq.Header.Set("Client-ID", clientID)
	usersReq.Header.Set("Authorization", "Bearer "+access)
	client := &http.Client{Timeout: 10 * time.Second}
	usersResp, err := client.Do(usersReq)
	if err != nil {
		return false, err
	}
	defer usersResp.Body.Close()
	if usersResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(usersResp.Body)
		return false, fmt.Errorf("helix users status %s: %s", usersResp.Status, string(b))
	}
	var usersRes struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(usersResp.Body).Decode(&usersRes); err != nil {
		return false, err
	}
	if len(usersRes.Data) == 0 {
		return false, nil
	}
	chatterID := usersRes.Data[0].ID

	// Query moderators list for this specific user
	modsURL := fmt.Sprintf("https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=%s&user_id=%s", url.QueryEscape(broadcasterID), url.QueryEscape(chatterID))
	modsReq, err := http.NewRequest("GET", modsURL, nil)
	if err != nil {
		return false, err
	}
	modsReq.Header.Set("Client-ID", clientID)
	modsReq.Header.Set("Authorization", "Bearer "+access)
	modsResp, err := client.Do(modsReq)
	if err != nil {
		return false, err
	}
	defer modsResp.Body.Close()
	if modsResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(modsResp.Body)
		return false, fmt.Errorf("helix moderators status %s: %s", modsResp.Status, string(b))
	}
	var modsRes struct {
		Data []struct {
			UserID string `json:"user_id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(modsResp.Body).Decode(&modsRes); err != nil {
		return false, err
	}
	return len(modsRes.Data) > 0, nil
}

// timeoutUser applies a short timeout to the specified user in the channel
// using the broadcaster's token and the Helix Ban Users (timeout) endpoint.
func timeoutUser(channelLogin, targetLogin string, seconds int, reason string) error {
	channelLogin = strings.ToLower(channelLogin)
	targetLogin = strings.ToLower(targetLogin)
	if seconds <= 0 {
		seconds = 1
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID not set")
	}

	access, err := GetUserAccessToken(channelLogin)
	if err != nil || access == "" {
		return fmt.Errorf("no user token for channel %s: %w", channelLogin, err)
	}

	// broadcaster id from token
	broadcasterID, err := getUserIDFromToken(access)
	if err != nil {
		return fmt.Errorf("getUserIDFromToken failed: %w", err)
	}

	// resolve target user id
	usersReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(targetLogin), nil)
	if err != nil {
		return err
	}
	usersReq.Header.Set("Client-ID", clientID)
	usersReq.Header.Set("Authorization", "Bearer "+access)
	client := &http.Client{Timeout: 10 * time.Second}
	usersResp, err := client.Do(usersReq)
	if err != nil {
		return err
	}
	defer usersResp.Body.Close()
	if usersResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(usersResp.Body)
		return fmt.Errorf("helix users status %s: %s", usersResp.Status, string(b))
	}
	var usersRes struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(usersResp.Body).Decode(&usersRes); err != nil {
		return err
	}
	if len(usersRes.Data) == 0 {
		return fmt.Errorf("user not found: %s", targetLogin)
	}
	targetID := usersRes.Data[0].ID

	body := map[string]interface{}{
		"data": map[string]interface{}{
			"user_id":  targetID,
			"duration": seconds,
			"reason":   reason,
		},
	}
	buf, _ := json.Marshal(body)
	endpoint := fmt.Sprintf("https://api.twitch.tv/helix/moderation/bans?broadcaster_id=%s&moderator_id=%s", url.QueryEscape(broadcasterID), url.QueryEscape(broadcasterID))
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("helix bans status %s: %s", resp.Status, string(b))
	}
	return nil
}

// updateStreamInfoFromChat updates the stream title and/or category in
// response to chat commands using the broadcaster's stored user token.
func updateStreamInfoFromChat(channelLogin, title, category string) error {
	channelLogin = strings.ToLower(channelLogin)
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	if strings.TrimSpace(title) == "" && strings.TrimSpace(category) == "" {
		return nil
	}

	access, err := GetUserAccessToken(channelLogin)
	if err != nil || access == "" {
		return fmt.Errorf("no user token for channel %s: %w", channelLogin, err)
	}
	userID, err := getUserIDFromToken(access)
	if err != nil {
		return fmt.Errorf("getUserIDFromToken failed: %w", err)
	}

	payload := map[string]string{}
	if strings.TrimSpace(title) != "" {
		payload["title"] = title
	}
	if strings.TrimSpace(category) != "" {
		// resolve game name to game_id
		gamesReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/games?name="+url.QueryEscape(category), nil)
		if err == nil {
			gamesReq.Header.Set("Client-ID", clientID)
			gamesReq.Header.Set("Authorization", "Bearer "+access)
			client := &http.Client{Timeout: 10 * time.Second}
			gamesResp, err := client.Do(gamesReq)
			if err == nil {
				defer gamesResp.Body.Close()
				if gamesResp.StatusCode/100 == 2 {
					var g struct {
						Data []struct {
							ID string `json:"id"`
						} `json:"data"`
					}
					if err := json.NewDecoder(gamesResp.Body).Decode(&g); err == nil {
						if len(g.Data) > 0 {
							payload["game_id"] = g.Data[0].ID
						}
					}
				}
			}
		}
	}
	if len(payload) == 0 {
		return nil
	}
	buf, _ := json.Marshal(payload)
	req, err := http.NewRequest("PATCH", "https://api.twitch.tv/helix/channels?broadcaster_id="+url.QueryEscape(userID), bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("helix channels patch status %s: %s", resp.Status, string(b))
	}
	return nil
}

// durationUnit and formatDurationUnits are helpers to build human-readable
// duration strings without including components that are zero.
type durationUnit struct {
	value int
	label string
}

func formatDurationUnits(units ...durationUnit) string {
	parts := []string{}
	for _, u := range units {
		if u.value != 0 {
			parts = append(parts, fmt.Sprintf("%d %s", u.value, u.label))
		}
	}
	if len(parts) == 0 {
		// Fallback when everything is zero; minutes is the smallest unit we use
		return "0 minutes"
	}
	return strings.Join(parts, ", ")
}

// getAccountAgeString retrieves a Twitch user's creation time and returns
// a human-readable age in years, months, days, and hours.
func getAccountAgeString(login string) (string, error) {
	login = strings.ToLower(strings.TrimPrefix(login, "@"))
	if login == "" {
		return "", fmt.Errorf("empty login for account age")
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return "", fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
	if clientSecret == "" {
		return "", fmt.Errorf("TWITCH_CLIENT_SECRET not set")
	}

	// ensure we have an app access token for Helix
	helixChatMu.Lock()
	token := appAccessToken
	helixChatMu.Unlock()
	if token == "" {
		var err error
		token, err = getAppAccessToken(clientID, clientSecret)
		if err != nil {
			return "", fmt.Errorf("failed to get app access token: %w", err)
		}
		helixChatMu.Lock()
		appAccessToken = token
		helixChatMu.Unlock()
	}

	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(login), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("helix users status %s: %s", resp.Status, string(b))
	}
	var res struct {
		Data []struct {
			CreatedAt string `json:"created_at"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	if len(res.Data) == 0 || res.Data[0].CreatedAt == "" {
		return "", fmt.Errorf("user not found: %s", login)
	}
	created, err := time.Parse(time.RFC3339, res.Data[0].CreatedAt)
	if err != nil {
		return "", err
	}

	d := time.Since(created)
	if d < 0 {
		d = 0
	}
	totalHours := int(d.Hours())
	years := totalHours / (24 * 365)
	remainingDays := (totalHours / 24) % 365
	months := remainingDays / 30
	days := remainingDays % 30
	hours := totalHours % 24

	return formatDurationUnits(
		durationUnit{value: years, label: "years"},
		durationUnit{value: months, label: "months"},
		durationUnit{value: days, label: "days"},
		durationUnit{value: hours, label: "hours"},
	), nil
}

// getFollowAgeString retrieves how long followerLogin has been following
// broadcasterLogin and returns a human-readable age including minutes.
func getFollowAgeString(broadcasterLogin, followerLogin string) (string, error) {
	broadcasterLogin = strings.ToLower(strings.TrimPrefix(broadcasterLogin, "@"))
	followerLogin = strings.ToLower(strings.TrimPrefix(followerLogin, "@"))
	if broadcasterLogin == "" || followerLogin == "" {
		return "", fmt.Errorf("empty login for follow age")
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return "", fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	botOAuth := os.Getenv("TWITCH_BOT_OAUTH")
	accessToken := strings.TrimPrefix(botOAuth, "oauth:")
	if accessToken == "" {
		return "", fmt.Errorf("TWITCH_BOT_OAUTH not set or empty")
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// resolve broadcaster id
	usersReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(broadcasterLogin), nil)
	if err != nil {
		return "", err
	}
	usersReq.Header.Set("Client-ID", clientID)
	usersReq.Header.Set("Authorization", "Bearer "+accessToken)
	usersResp, err := client.Do(usersReq)
	if err != nil {
		return "", err
	}
	defer usersResp.Body.Close()
	if usersResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(usersResp.Body)
		return "", fmt.Errorf("helix users status %s: %s", usersResp.Status, string(b))
	}
	var usersRes struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(usersResp.Body).Decode(&usersRes); err != nil {
		return "", err
	}
	if len(usersRes.Data) == 0 {
		return "", fmt.Errorf("broadcaster not found: %s", broadcasterLogin)
	}
	broadcasterID := usersRes.Data[0].ID

	// resolve follower id
	followerReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(followerLogin), nil)
	if err != nil {
		return "", err
	}
	followerReq.Header.Set("Client-ID", clientID)
	followerReq.Header.Set("Authorization", "Bearer "+accessToken)
	followerResp, err := client.Do(followerReq)
	if err != nil {
		return "", err
	}
	defer followerResp.Body.Close()
	if followerResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(followerResp.Body)
		return "", fmt.Errorf("helix users status %s: %s", followerResp.Status, string(b))
	}
	var followerRes struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(followerResp.Body).Decode(&followerRes); err != nil {
		return "", err
	}
	if len(followerRes.Data) == 0 {
		return "", fmt.Errorf("user not found: %s", followerLogin)
	}
	followerID := followerRes.Data[0].ID

	// query channel followers for this specific user
	followURL := fmt.Sprintf("https://api.twitch.tv/helix/channels/followers?broadcaster_id=%s&user_id=%s", url.QueryEscape(broadcasterID), url.QueryEscape(followerID))
	followReq, err := http.NewRequest("GET", followURL, nil)
	if err != nil {
		return "", err
	}
	followReq.Header.Set("Client-ID", clientID)
	followReq.Header.Set("Authorization", "Bearer "+accessToken)
	followResp, err := client.Do(followReq)
	if err != nil {
		return "", err
	}
	defer followResp.Body.Close()
	if followResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(followResp.Body)
		return "", fmt.Errorf("helix followers status %s: %s", followResp.Status, string(b))
	}
	var followRes struct {
		Data []struct {
			FollowedAt string `json:"followed_at"`
		} `json:"data"`
	}
	if err := json.NewDecoder(followResp.Body).Decode(&followRes); err != nil {
		return "", err
	}
	if len(followRes.Data) == 0 || followRes.Data[0].FollowedAt == "" {
		return "", fmt.Errorf("%s does not follow %s", followerLogin, broadcasterLogin)
	}
	followedAt, err := time.Parse(time.RFC3339, followRes.Data[0].FollowedAt)
	if err != nil {
		return "", err
	}

	d := time.Since(followedAt)
	if d < 0 {
		d = 0
	}
	totalMinutes := int(d.Minutes())
	years := totalMinutes / (60 * 24 * 365)
	remainingDays := (totalMinutes / (60 * 24)) % 365
	months := remainingDays / 30
	days := remainingDays % 30
	hours := (totalMinutes / 60) % 24
	minutes := totalMinutes % 60

	return formatDurationUnits(
		durationUnit{value: years, label: "years"},
		durationUnit{value: months, label: "months"},
		durationUnit{value: days, label: "days"},
		durationUnit{value: hours, label: "hours"},
		durationUnit{value: minutes, label: "minutes"},
	), nil
}

// getChannelTitleAndGame fetches the current title and category (game name)
// for the given broadcaster login using their stored user access token.
func getChannelTitleAndGame(login string) (string, string, error) {
	login = strings.ToLower(login)
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return "", "", fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	if db == nil {
		return "", "", fmt.Errorf("db not initialized")
	}
	access, err := GetUserAccessToken(login)
	if err != nil || access == "" {
		return "", "", fmt.Errorf("no user token for channel %s: %w", login, err)
	}
	userID, err := getUserIDFromToken(access)
	if err != nil {
		return "", "", fmt.Errorf("getUserIDFromToken failed: %w", err)
	}
	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/channels?broadcaster_id="+url.QueryEscape(userID), nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+access)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("helix channels status %s: %s", resp.Status, string(b))
	}
	var data struct {
		Data []struct {
			Title    string `json:"title"`
			GameName string `json:"game_name"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", "", err
	}
	if len(data.Data) == 0 {
		return "", "", nil
	}
	return data.Data[0].Title, data.Data[0].GameName, nil
}

// getStreamUptimeString returns how long the broadcaster has been live this
// session by querying Helix Get Streams and formatting the duration.
func getStreamUptimeString(channelLogin string) (string, error) {
	channelLogin = strings.ToLower(strings.TrimPrefix(channelLogin, "@"))
	if channelLogin == "" {
		return "", fmt.Errorf("empty channel login for uptime")
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return "", fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
	if clientSecret == "" {
		return "", fmt.Errorf("TWITCH_CLIENT_SECRET not set")
	}

	// ensure we have an app access token
	helixChatMu.Lock()
	token := appAccessToken
	helixChatMu.Unlock()
	if token == "" {
		var err error
		token, err = getAppAccessToken(clientID, clientSecret)
		if err != nil {
			return "", fmt.Errorf("failed to get app access token: %w", err)
		}
		helixChatMu.Lock()
		appAccessToken = token
		helixChatMu.Unlock()
	}

	// resolve broadcaster id
	reqUser, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(channelLogin), nil)
	if err != nil {
		return "", err
	}
	reqUser.Header.Set("Client-ID", clientID)
	reqUser.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 10 * time.Second}
	respUser, err := client.Do(reqUser)
	if err != nil {
		return "", err
	}
	defer respUser.Body.Close()
	if respUser.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(respUser.Body)
		return "", fmt.Errorf("helix users status %s: %s", respUser.Status, string(b))
	}
	var userRes struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(respUser.Body).Decode(&userRes); err != nil {
		return "", err
	}
	if len(userRes.Data) == 0 {
		return "", fmt.Errorf("broadcaster not found: %s", channelLogin)
	}
	broadcasterID := userRes.Data[0].ID

	// query current stream
	streamsURL := fmt.Sprintf("https://api.twitch.tv/helix/streams?user_id=%s", url.QueryEscape(broadcasterID))
	reqStreams, err := http.NewRequest("GET", streamsURL, nil)
	if err != nil {
		return "", err
	}
	reqStreams.Header.Set("Client-ID", clientID)
	reqStreams.Header.Set("Authorization", "Bearer "+token)
	respStreams, err := client.Do(reqStreams)
	if err != nil {
		return "", err
	}
	defer respStreams.Body.Close()
	if respStreams.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(respStreams.Body)
		return "", fmt.Errorf("helix streams status %s: %s", respStreams.Status, string(b))
	}
	var streamsRes struct {
		Data []struct {
			StartedAt string `json:"started_at"`
		} `json:"data"`
	}
	if err := json.NewDecoder(respStreams.Body).Decode(&streamsRes); err != nil {
		return "", err
	}
	if len(streamsRes.Data) == 0 || streamsRes.Data[0].StartedAt == "" {
		// not live
		return "", nil
	}
	started, err := time.Parse(time.RFC3339, streamsRes.Data[0].StartedAt)
	if err != nil {
		return "", err
	}

	d := time.Since(started)
	if d < 0 {
		d = 0
	}
	totalMinutes := int(d.Minutes())
	years := totalMinutes / (60 * 24 * 365)
	remainingDays := (totalMinutes / (60 * 24)) % 365
	months := remainingDays / 30
	days := remainingDays % 30
	hours := (totalMinutes / 60) % 24
	minutes := totalMinutes % 60

	return formatDurationUnits(
		durationUnit{value: years, label: "years"},
		durationUnit{value: months, label: "months"},
		durationUnit{value: days, label: "days"},
		durationUnit{value: hours, label: "hours"},
		durationUnit{value: minutes, label: "minutes"},
	), nil
}

// isChannelLive returns true if the broadcaster is currently live.
func isChannelLive(channelLogin string) bool {
	uptime, err := getStreamUptimeString(channelLogin)
	if err != nil {
		// On error, assume offline so we don't over-count watchtime
		log.Println("isChannelLive uptime check failed:", err)
		return false
	}
	return uptime != ""
}

// isDefaultCommandEnabled returns whether a built-in command is enabled for
// the given broadcaster. If there is any error or no row, the command is
// treated as enabled.
func isDefaultCommandEnabled(channelLogin, commandName string) bool {
	enabled, err := GetDefaultCommandEnabled(channelLogin, commandName)
	if err != nil {
		log.Println("failed to read default command setting:", err)
		return true
	}
	return enabled
}

// active channel helpers
func isActiveChannel(ch string) bool {
	ch = strings.ToLower(ch)
	activeMu.Lock()
	defer activeMu.Unlock()
	return activeChannels[ch]
}

func markActiveChannel(ch string) {
	ch = strings.ToLower(ch)
	activeMu.Lock()
	activeChannels[ch] = true
	activeMu.Unlock()
}

func unmarkActiveChannel(ch string) {
	ch = strings.ToLower(ch)
	activeMu.Lock()
	delete(activeChannels, ch)
	activeMu.Unlock()
}

// sendChat sends a visible chat message using the Helix Send Chat Message API.
// If the Helix call fails for any reason, it falls back to the legacy IRC
// PRIVMSG so the bot continues to function.
func sendChat(c *websocket.Conn, channel, msg string) {
	if err := sendHelixChatMessage(channel, msg); err != nil {
		log.Println("helix send chat failed, falling back to IRC:", err)
		line := fmt.Sprintf("PRIVMSG #%s :%s", channel, msg)
		log.Printf("[SENT-IRC] %s\n", line)
		writeIRC(c, line)
	}
}

// sendHelixChatMessage calls Twitch's Helix /helix/chat/messages endpoint to
// send a message into the specified channel. It uses the bot's user access
// token from TWITCH_BOT_OAUTH (without the "oauth:" prefix). This token must
// include the new chat scopes (e.g. user:write:chat and the required bot
// scopes) for the request to succeed.
func sendHelixChatMessage(channelLogin, message string) error {
	channelLogin = strings.ToLower(channelLogin)
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
	if clientSecret == "" {
		return fmt.Errorf("TWITCH_CLIENT_SECRET not set")
	}

	botLogin := os.Getenv("TWITCH_BOT_USERNAME")
	if botLogin == "" {
		botLogin = "AxyraBot"
	}

	// Resolve and cache sender (bot) user id and broadcaster id for the channel.
	helixChatMu.Lock()
	botID := helixBotUserID
	broadcasterID := helixBroadcasterIDs[channelLogin]
	accessToken := appAccessToken
	helixChatMu.Unlock()
	if accessToken == "" {
		// lazily obtain an app access token for Helix chat
		var err error
		accessToken, err = getAppAccessToken(clientID, clientSecret)
		if err != nil {
			return fmt.Errorf("failed to get app access token: %w", err)
		}
		helixChatMu.Lock()
		appAccessToken = accessToken
		helixChatMu.Unlock()
	}

	// helper to resolve a login to user id with the given token
	resolveID := func(login string) (string, error) {
		if login == "" {
			return "", fmt.Errorf("empty login for id resolution")
		}
		req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(login), nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("Client-ID", clientID)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return "", fmt.Errorf("get users status %s: %s", resp.Status, string(b))
		}
		var res struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			return "", err
		}
		if len(res.Data) == 0 {
			return "", fmt.Errorf("user not found: %s", login)
		}
		return res.Data[0].ID, nil
	}

	var err error
	if botID == "" {
		botID, err = resolveID(botLogin)
		if err != nil {
			return fmt.Errorf("resolve bot id failed: %w", err)
		}
	}
	if broadcasterID == "" {
		broadcasterID, err = resolveID(channelLogin)
		if err != nil {
			return fmt.Errorf("resolve broadcaster id failed: %w", err)
		}
	}

	helixChatMu.Lock()
	helixBotUserID = botID
	helixBroadcasterIDs[channelLogin] = broadcasterID
	helixChatMu.Unlock()

	body := map[string]interface{}{
		"broadcaster_id": broadcasterID,
		"sender_id":      botID,
		"message":        message,
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/chat/messages", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("helix chat status %s: %s", resp.Status, string(respBody))
	}
	log.Printf("[SENT-HELIX] channel=%s msg=%q\n", channelLogin, message)
	return nil
}

// sendHelixChatAnnouncement calls Twitch's Helix /helix/chat/announcements endpoint
// to send a highlighted announcement into the specified channel. It uses the bot's
// user access token from TWITCH_BOT_OAUTH (without the "oauth:" prefix). This
// token must include the moderator:manage:announcements scope, and the bot user
// must be a moderator or the broadcaster in the target channel.
func sendHelixChatAnnouncement(channelLogin, message, color string) error {
	channelLogin = strings.ToLower(channelLogin)
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID not set")
	}

	botOAuth := os.Getenv("TWITCH_BOT_OAUTH")
	accessToken := strings.TrimPrefix(botOAuth, "oauth:")
	if accessToken == "" {
		return fmt.Errorf("TWITCH_BOT_OAUTH not set or empty")
	}

	// Resolve and cache bot (moderator) user id and broadcaster id for the channel.
	helixChatMu.Lock()
	botID := helixBotUserID
	broadcasterID := helixBroadcasterIDs[channelLogin]
	helixChatMu.Unlock()

	var err error
	if botID == "" {
		botID, err = getUserIDFromToken(accessToken)
		if err != nil {
			return fmt.Errorf("resolve bot id from token failed: %w", err)
		}
	}
	if broadcasterID == "" {
		// Lookup broadcaster id via Helix /users using the bot's user access token.
		req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(channelLogin), nil)
		if err != nil {
			return err
		}
		req.Header.Set("Client-ID", clientID)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("helix users status %s: %s", resp.Status, string(b))
		}
		var res struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			return err
		}
		if len(res.Data) == 0 {
			return fmt.Errorf("user not found: %s", channelLogin)
		}
		broadcasterID = res.Data[0].ID
	}

	helixChatMu.Lock()
	helixBotUserID = botID
	helixBroadcasterIDs[channelLogin] = broadcasterID
	helixChatMu.Unlock()

	body := map[string]interface{}{
		"message": message,
	}
	if color != "" {
		body["color"] = color
	}
	b, _ := json.Marshal(body)
	endpoint := fmt.Sprintf("https://api.twitch.tv/helix/chat/announcements?broadcaster_id=%s&moderator_id=%s", url.QueryEscape(broadcasterID), url.QueryEscape(botID))
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("helix announcement status %s: %s", resp.Status, string(respBody))
	}
	log.Printf("[SENT-ANNOUNCEMENT] channel=%s msg=%q\n", channelLogin, message)
	return nil
}

// getFollowerCount returns the total number of followers for the given
// broadcaster using Twitch's Helix Get Channel Followers endpoint.
// It uses the bot's user access token from TWITCH_BOT_OAUTH, which must
// include the moderator:read:followers scope and have moderator or
// broadcaster privileges in the channel.
func getFollowerCount(broadcasterID string) (int, error) {
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return 0, fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	botOAuth := os.Getenv("TWITCH_BOT_OAUTH")
	accessToken := strings.TrimPrefix(botOAuth, "oauth:")
	if accessToken == "" {
		return 0, fmt.Errorf("TWITCH_BOT_OAUTH not set or empty")
	}
	if broadcasterID == "" {
		return 0, fmt.Errorf("empty broadcaster id")
	}
	endpoint := fmt.Sprintf("https://api.twitch.tv/helix/channels/followers?broadcaster_id=%s", url.QueryEscape(broadcasterID))
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("helix followers status %s: %s", resp.Status, string(b))
	}
	var res struct {
		Total int `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return 0, err
	}
	return res.Total, nil
}

// getLoginFromToken calls Twitch's /validate endpoint to resolve the login
// associated with a user access token.
func getLoginFromToken(accessToken string) (string, error) {
	if accessToken == "" {
		return "", fmt.Errorf("empty access token")
	}
	req, err := http.NewRequest("GET", "https://id.twitch.tv/oauth2/validate", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "OAuth "+accessToken)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("validate status %s", resp.Status)
	}
	var v struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		return "", err
	}
	return v.Login, nil
}

// getUserIDFromToken calls /validate and returns the user_id associated with
// a user access token.
func getUserIDFromToken(accessToken string) (string, error) {
	if accessToken == "" {
		return "", fmt.Errorf("empty access token")
	}
	req, err := http.NewRequest("GET", "https://id.twitch.tv/oauth2/validate", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "OAuth "+accessToken)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("validate status %s", resp.Status)
	}
	var v struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		return "", err
	}
	return v.UserID, nil
}

// getUserProfileImageFetches the profile_image_url for the user associated with
// the given access token using Twitch's Helix /users endpoint.
func getUserProfileImage(accessToken, clientID string) (string, error) {
	if accessToken == "" || clientID == "" {
		return "", fmt.Errorf("missing access token or client id")
	}
	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("helix users status %s", resp.Status)
	}
	var res struct {
		Data []struct {
			ProfileImageURL string `json:"profile_image_url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	if len(res.Data) == 0 {
		return "", fmt.Errorf("no user data returned")
	}
	return res.Data[0].ProfileImageURL, nil
}

// getAppAccessToken obtains an app access token using client credentials grant
func getAppAccessToken(clientID, clientSecret string) (string, error) {
	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("missing client id or secret")
	}
	url := fmt.Sprintf("https://id.twitch.tv/oauth2/token?client_id=%s&client_secret=%s&grant_type=client_credentials", clientID, clientSecret)
	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var res struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	return res.AccessToken, nil
}

// listEventSubSubscriptions lists current EventSub subscriptions for the app
func listEventSubSubscriptions(appToken, clientID string) error {
	if appToken == "" {
		return fmt.Errorf("app token required")
	}
	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/eventsub/subscriptions", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+appToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return err
	}
	log.Println("EventSub subscriptions response:")
	log.Println(buf.String())
	return nil
}

// getUserID resolves a Twitch login name to user id using Helix API
func getUserID(login, appToken, clientID string) (string, error) {
	if login == "" {
		return "", fmt.Errorf("login required")
	}
	req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+login, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+appToken)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var res struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}
	if len(res.Data) == 0 {
		return "", fmt.Errorf("user not found: %s", login)
	}
	return res.Data[0].ID, nil
}

// createEventSubSubscription creates a single EventSub subscription using the
// specified transport. For websocket transport, a valid sessionID must be
// provided. The version parameter should match the EventSub type's required
// version (e.g., "1" for channel.chat.message, "2" for channel.follow).
func createEventSubSubscription(authToken, clientID, subType, version string, condition map[string]string, sessionID string, transportMethod string, callbackURL string, secret string) error {
	transport := map[string]interface{}{}
	if transportMethod == "webhook" {
		transport["method"] = "webhook"
		transport["callback"] = callbackURL
		if secret != "" {
			transport["secret"] = secret
		}
	} else {
		transport["method"] = "websocket"
		transport["session_id"] = sessionID
	}
	body := map[string]interface{}{
		"type":      subType,
		"version":   version,
		"condition": condition,
		"transport": transport,
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/eventsub/subscriptions", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}

	// Detailed debug: log request headers and body
	var hb bytes.Buffer
	hb.WriteString("--- EventSub Request ---\n")
	hb.WriteString(req.Method + " " + req.URL.String() + "\n")
	for k, v := range req.Header {
		hb.WriteString(k + ": " + strings.Join(v, ",") + "\n")
	}
	hb.WriteString("\n")
	hb.Write(b)
	hb.WriteString("\n------------------------\n")
	log.Println(hb.String())

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// Detailed debug: log response status, headers, and body
	var rb bytes.Buffer
	if _, err := rb.ReadFrom(resp.Body); err != nil {
		return err
	}
	var rhb bytes.Buffer
	rhb.WriteString("--- EventSub Response ---\n")
	rhb.WriteString(resp.Status + "\n")
	for k, v := range resp.Header {
		rhb.WriteString(k + ": " + strings.Join(v, ",") + "\n")
	}
	rhb.WriteString("\n")
	rhb.Write(rb.Bytes())
	rhb.WriteString("\n-------------------------\n")
	log.Println(rhb.String())
	return nil
}

// registerEventSubSubscriptions waits for an EventSub session and registers
// subscriptions for one or more channel logins. Prefer channels from the
// database (joined channels) and fall back to the TWITCH_CHANNEL env only if
// the DB is not available or empty at startup.
func registerEventSubSubscriptions(appToken, clientID, channel, tokensPath string) {
	// Allow disabling EventSub registration entirely via env to avoid
	// errors like "invalid transport and auth combination" when not
	// fully configured.
	if os.Getenv("TWITCH_EVENTSUB_ENABLED") != "1" {
		log.Println("EventSub registration disabled; set TWITCH_EVENTSUB_ENABLED=1 to enable")
		return
	}
	// tokensPath is currently unused but kept for compatibility with callers.
	_ = tokensPath

	// wait for session id to be set
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		eventSubMu.Lock()
		sid := eventSubSessionID
		eventSubMu.Unlock()
		if sid != "" {
			// Determine list of channels to register EventSub for.
			channels := []string{}
			if db != nil {
				if cs, err := GetJoinedChannels(); err == nil && len(cs) > 0 {
					channels = cs
				}
			}
			if len(channels) == 0 && channel != "" {
				channels = []string{channel}
			}
			if len(channels) == 0 {
				log.Println("no channels available for EventSub registration; skipping")
				return
			}

			// Subscribe to chat messages and follows so we can both read chat
			// and thank users when they follow the channel. Separately, we
			// subscribe to stream.online events to announce when channels go live.
			subs := []string{"channel.chat.message", "channel.follow"}

			// bot user access token for chat-related EventSub (channel.chat.message)
			botToken := ""
			if bt := os.Getenv("TWITCH_BOT_OAUTH"); bt != "" {
				botToken = strings.TrimPrefix(bt, "oauth:")
			}

			// resolve bot user id once for channel.chat.message subscriptions
			botLogin := os.Getenv("TWITCH_BOT_USERNAME")
			if botLogin == "" {
				botLogin = "AxyraBot"
			}
			botID := ""
			if appToken != "" {
				if id, err := getUserID(strings.ToLower(botLogin), appToken, clientID); err != nil {
					log.Println("failed to resolve bot id for channel.chat.message:", err)
				} else {
					botID = id
				}
			}

			// For each channel, resolve its broadcaster id and create subscriptions.
			for _, ch := range channels {
				broadcasterID, err := getUserID(ch, appToken, clientID)
				if err != nil {
					log.Println("failed to resolve broadcaster id for", ch, ":", err)
					continue
				}

				for _, st := range subs {
					cond := map[string]string{"broadcaster_user_id": broadcasterID}
					// channel.chat.message also requires the bot user id in the condition
					// and uses version 1 of the subscription type. channel.follow uses
					// version 2 and requires moderator_user_id in the condition.
					version := "1"
					if st == "channel.chat.message" {
						if botID == "" || botToken == "" {
							log.Println("skipping channel.chat.message subscription; botID or botToken not available")
							continue
						}
						cond["user_id"] = botID
					} else if st == "channel.follow" {
						// channel.follow requires version 2 and moderator_user_id.
						version = "2"
						if botID == "" || botToken == "" {
							log.Println("skipping channel.follow subscription; botID or botToken not available")
							continue
						}
						cond["moderator_user_id"] = botID
					}
					// chat-related subs use the bot's user token; stream.online
					// will use the app token below.
					auth := botToken
					if err := createEventSubSubscription(auth, clientID, st, version, cond, sid, "websocket", "", ""); err != nil {
						log.Println("failed creating subscription", st, "for", ch, ":", err)
					}

					// avoid hitting rate limits too quickly
					time.Sleep(500 * time.Millisecond)
				}

				// Additionally subscribe to stream.online using the app access token
				// so we can announce when the broadcaster goes live.
				streamCond := map[string]string{"broadcaster_user_id": broadcasterID}
				if err := createEventSubSubscription(appToken, clientID, "stream.online", "1", streamCond, sid, "websocket", "", ""); err != nil {
					log.Println("failed creating stream.online subscription for", ch, ":", err)
				}
			}
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	log.Println("timed out waiting for EventSub session id; cannot register subscriptions")
}

// Token storage and refresh helpers
type tokenFile struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	Expiry       int64  `json:"expiry"` // unix seconds
}

func loadTokens(path string) (tokenFile, error) {
	var t tokenFile
	b, err := os.ReadFile(path)
	if err != nil {
		return t, err
	}
	if err := json.Unmarshal(b, &t); err != nil {
		return t, err
	}
	return t, nil
}

func saveTokens(path string, t tokenFile) error {
	b, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0600)
}

func saveTokenIfMissing(path, oauthEnv string) {
	access := strings.TrimPrefix(oauthEnv, "oauth:")
	if access == "" {
		return
	}
	t, err := loadTokens(path)
	if err == nil && t.AccessToken != "" {
		return // already present
	}
	t = tokenFile{AccessToken: access}
	if err := saveTokens(path, t); err != nil {
		log.Println("failed saving tokens:", err)
	}
}

// tokenRefresher periodically refreshes the bot access token using stored refresh token
func tokenRefresher(path, clientID, clientSecret string) {
	if clientID == "" || clientSecret == "" {
		return
	}
	for {
		t, err := loadTokens(path)
		if err != nil || t.RefreshToken == "" {
			// no refresh token available; sleep and retry later
			time.Sleep(30 * time.Second)
			continue
		}

		// if token expires in >60s, sleep until near expiry
		now := time.Now().Unix()
		if t.Expiry > now+60 {
			time.Sleep(time.Duration(t.Expiry-now-60) * time.Second)
			continue
		}

		// refresh
		v := url.Values{}
		v.Set("grant_type", "refresh_token")
		v.Set("refresh_token", t.RefreshToken)
		v.Set("client_id", clientID)
		v.Set("client_secret", clientSecret)

		resp, err := http.Post("https://id.twitch.tv/oauth2/token", "application/x-www-form-urlencoded", strings.NewReader(v.Encode()))
		if err != nil {
			log.Println("token refresh request failed:", err)
			time.Sleep(10 * time.Second)
			continue
		}
		var r struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			ExpiresIn    int64  `json:"expires_in"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
			resp.Body.Close()
			log.Println("token refresh decode failed:", err)
			time.Sleep(10 * time.Second)
			continue
		}
		resp.Body.Close()

		t.AccessToken = r.AccessToken
		if r.RefreshToken != "" {
			t.RefreshToken = r.RefreshToken
		}
		t.Expiry = time.Now().Unix() + r.ExpiresIn
		if err := saveTokens(path, t); err != nil {
			log.Println("failed saving refreshed tokens:", err)
		} else {
			// update environment for current process
			os.Setenv("TWITCH_BOT_OAUTH", "oauth:"+t.AccessToken)
			log.Println("refreshed bot access token and updated tokens.json")
		}

		// sleep a short while before next check
		time.Sleep(5 * time.Second)
	}
}
