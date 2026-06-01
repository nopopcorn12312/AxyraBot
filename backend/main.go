package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
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

	// in-memory tracking of recent chatters per channel for template variables
	chattersMu        sync.Mutex
	chattersByChannel = map[string]map[string]time.Time{}

	// cached live-status per channel to avoid hitting Helix on every message
	liveStatusMu    sync.Mutex
	liveStatusCache = map[string]liveStatusEntry{}

	// per-channel rolling chat event ring for dashboard stats (last 10 min)
	chatStatsMu sync.Mutex
	chatEvents  = map[string][]chatEvent{}
)

// Default template for the live announcement module. This can be overridden
// per-broadcaster via the module_settings table.
const defaultLiveAnnouncementTemplate = "$(channel) is now live! Streaming $(game) | $(title)"

// List of all birthday-related commands that are treated as default
// commands and controlled by the birthdays module.
var birthdayCommandNames = []string{
	"!birthday",
	"!nextbday",
	"!addbday",
	"!addmybday",
	"!delbday",
	"!editbday",
}

// List of built-in default commands that can be toggled per broadcaster.
var defaultCommandNames = func() []string {
	base := []string{
		"!hello",
		"!vanish",
		"!title",
		"!game",
		"!accountage",
		"!followage",
		"!uptime",
		"!commands",
		"!ai",
	}
	return append(base, birthdayCommandNames...)
}()

// renderBirthdayCommandMessage allows per-command custom wording for
// birthday-related commands. If a custom template is stored for the
// given command, it is used with simple $(key) replacements based on
// the provided vars; otherwise defaultText is returned.
func renderBirthdayCommandMessage(channelLogin, commandName, defaultText string, vars map[string]string) string {
	tmpl, err := GetBirthdayCommandMessage(channelLogin, commandName)
	if err != nil {
		log.Println("failed to load birthday command template:", commandName, err)
		return defaultText
	}
	tmpl = strings.TrimSpace(tmpl)
	if tmpl == "" {
		return defaultText
	}
	out := tmpl
	for k, v := range vars {
		placeholder := "$(" + k + ")"
		out = strings.ReplaceAll(out, placeholder, v)
	}
	return out
}

type liveStatusEntry struct {
	live      bool
	checkedAt time.Time
}

type chatEvent struct {
	t    time.Time
	user string
}

type chatHistoryBucket struct {
	Label    string `json:"label"`
	Msgs     int    `json:"msgs"`
	Chatters int    `json:"chatters"`
}

func recordChatEvent(channel, user string) {
	chatStatsMu.Lock()
	defer chatStatsMu.Unlock()
	now := time.Now()
	cutoff := now.Add(-10 * time.Minute)
	events := chatEvents[channel]
	i := 0
	for i < len(events) && events[i].t.Before(cutoff) {
		i++
	}
	events = append(events[i:], chatEvent{t: now, user: user})
	chatEvents[channel] = events
}

func getChatStats(channel string) (msgsPerMin float64, uniqueChatters int, history []chatHistoryBucket) {
	chatStatsMu.Lock()
	defer chatStatsMu.Unlock()
	now := time.Now()
	cutoff := now.Add(-10 * time.Minute)
	events := chatEvents[channel]
	i := 0
	for i < len(events) && events[i].t.Before(cutoff) {
		i++
	}
	events = events[i:]
	chatEvents[channel] = events

	oneMinAgo := now.Add(-time.Minute)
	msgsLastMin := 0
	for _, e := range events {
		if e.t.After(oneMinAgo) {
			msgsLastMin++
		}
	}
	msgsPerMin = float64(msgsLastMin)

	seen := map[string]struct{}{}
	for _, e := range events {
		seen[e.user] = struct{}{}
	}
	uniqueChatters = len(seen)

	history = make([]chatHistoryBucket, 10)
	for b := 0; b < 10; b++ {
		bucketEnd := now.Add(time.Duration(-(9 - b)) * time.Minute)
		bucketStart := bucketEnd.Add(-time.Minute)
		bucketSeen := map[string]struct{}{}
		msgs := 0
		for _, e := range events {
			if e.t.After(bucketStart) && !e.t.After(bucketEnd) {
				msgs++
				bucketSeen[e.user] = struct{}{}
			}
		}
		history[b] = chatHistoryBucket{
			Label:    bucketEnd.Format("15:04"),
			Msgs:     msgs,
			Chatters: len(bucketSeen),
		}
	}
	return
}

func main() {
	botName := os.Getenv("TWITCH_BOT_USERNAME")
	if botName == "" {
		botName = "AxyraBot"
	}

	rand.Seed(time.Now().UnixNano())

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
	botTokenValid := false
	if oauth != "" {
		access := strings.TrimPrefix(oauth, "oauth:")
		if login, err := getLoginFromToken(access); err == nil && login != "" {
			botName = login
			botTokenValid = true
			log.Println("Using bot login from token:", botName)
		} else if err != nil {
			log.Println("failed to validate bot token:", err)
		}
	}

	// Start token refresher (only active if refresh token present in tokens.json)
	go tokenRefresher(tokensPath, clientID, clientSecret)

	// Initialize Discord bot (no-op if DISCORD_BOT_TOKEN is unset)
	InitDiscord()

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
				if err := EnsureBlockedTermsTable(); err != nil {
					log.Println("failed to ensure blocked_terms table:", err)
				}
				// start postgres notifier for dynamic joins
				if err := StartNotifier(dbURL); err != nil {
					log.Println("failed to start notifier:", err)
				}
			}
		}
	}

	// If the bot token was missing or expired, try to recover it. Recovery
	// checks (in order): TWITCH_BOT_REFRESH_TOKEN env var, then the users
	// table in the DB (populated when the bot account logs in via /auth/callback).
	// This ensures the bot keeps working across cloud redeployments where
	// the ephemeral tokens.json file is not persisted.
	if !botTokenValid && clientID != "" && clientSecret != "" {
		if newOAuth, newLogin, err := recoverBotToken(botName, clientID, clientSecret); err == nil {
			oauth = newOAuth
			os.Setenv("TWITCH_BOT_OAUTH", oauth)
			if newLogin != "" {
				botName = newLogin
			}
			log.Println("Recovered bot token for:", botName)
		} else {
			log.Println("bot token recovery failed; EventSub chat subscriptions may not work:", err)
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

	// Start HTTP server for OAuth + join endpoints
	go startHTTPServer(clientID, clientSecret)

	// Start automatic midnight birthday announcer
	go StartBirthdayScheduler()

	// Start Discord background schedulers
	go StartDiscordTempRoleScheduler()
	go StartDiscordReminderScheduler()
	go StartDiscordGiveawayScheduler()

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
										// Capture previous session id so we can detect reconnects.
										eventSubMu.Lock()
										prevID := eventSubSessionID
										eventSubSessionID = id
										eventSubMu.Unlock()
										log.Println("EventSub session id set:", id)

										// If we previously had a different session id, this means the
										// WebSocket reconnected. Re-register EventSub subscriptions for
										// all joined channels so the bot continues receiving chat and
										// follow events without requiring a manual part/join.
										if prevID != "" && prevID != id {
											go func() {
												clientID := os.Getenv("TWITCH_CLIENT_ID")
												clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
												if clientID == "" || clientSecret == "" {
													return
												}

												// Ensure we have an app access token for EventSub registration.
												helixChatMu.Lock()
												token := appAccessToken
												helixChatMu.Unlock()
												if token == "" {
													var err error
													token, err = getAppAccessToken(clientID, clientSecret)
													if err != nil {
														log.Println("failed to get app token for EventSub after session reconnect:", err)
														return
													}
													helixChatMu.Lock()
													appAccessToken = token
													helixChatMu.Unlock()
												}

												// Use the configured TWITCH_CHANNEL as a fallback when no
												// database-driven channels exist.
												fallbackChannel := os.Getenv("TWITCH_CHANNEL")
												registerEventSubSubscriptions(token, clientID, fallbackChannel, "")
											}()
										}
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
											chatterID, _ := event["chatter_user_id"].(string)
											messageID, _ := event["message_id"].(string)
											msgText := ""
											if msgObj, ok := event["message"].(map[string]interface{}); ok {
												if t, ok := msgObj["text"].(string); ok {
													msgText = t
												}
											}
											if channelLogin != "" && msgText != "" {
												go handleChatMessageEvent(channelLogin, chatterLogin, chatterID, messageID, msgText)
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
													// Record follow event in audit log.
													if err := InsertAuditLog(ch, "twitch", "follow", fmt.Sprintf("%s followed the channel", follower)); err != nil {
														log.Println("failed to insert audit log for follow:", err)
													}
												}(channelLogin, followerName, broadcasterID)
											}
										}
									case "stream.online":
										if event, ok := payload["event"].(map[string]interface{}); ok {
											channelLogin, _ := event["broadcaster_user_login"].(string)
											if channelLogin != "" && isModuleEnabled(channelLogin, "live_announcement") {
												go func(ch string) {
													title, game, err := getChannelTitleAndGame(ch)
													if err != nil {
														log.Println("failed to fetch title/game for stream.online:", err)
													}
													msg := renderLiveAnnouncementMessage(ch, title, game)
													if err := sendHelixChatMessage(ch, msg); err != nil {
														log.Println("failed to send stream.online live message:", err)
													}
													// Notify Discord
													PostDiscordLiveNotification(ch, title, game)
													// Record stream.online in audit log as a Twitch-side event.
													if err := InsertAuditLog(ch, "twitch", "stream_online", fmt.Sprintf("Stream went live: %s | %s", title, game)); err != nil {
														log.Println("failed to insert audit log for stream.online:", err)
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

// renderLiveAnnouncementMessage builds the outgoing chat message for the
// live announcement module. It supports simple template variables in the
// stored message string:
//
//	$(channel) - broadcaster login
//	$(title)   - stream title (falls back to "Untitled stream")
//	$(game)    - game/category name (falls back to "Just Chatting")
func renderLiveAnnouncementMessage(channelLogin, title, game string) string {
	if title == "" {
		title = "Untitled stream"
	}
	if game == "" {
		game = "Just Chatting"
	}
	tmpl := defaultLiveAnnouncementTemplate
	if db != nil {
		if msg, err := GetModuleMessage(channelLogin, "live_announcement"); err != nil {
			log.Println("failed to load live_announcement template:", err)
		} else if strings.TrimSpace(msg) != "" {
			tmpl = msg
		}
	}
	msg := strings.ReplaceAll(tmpl, "$(channel)", channelLogin)
	msg = strings.ReplaceAll(msg, "$(title)", title)
	msg = strings.ReplaceAll(msg, "$(game)", game)
	return msg
}

// isChatCommand returns true if the message matches the given command token
// exactly (e.g. "!test") or starts with the token followed by a space
// (e.g. "!test foo"). This avoids overlap where a longer command like
// !testanc would otherwise trigger the !test handler.
func isChatCommand(message, command string) bool {
	message = strings.TrimSpace(message)
	if message == command {
		return true
	}
	return strings.HasPrefix(message, command+" ")
}

// handleChatMessageEvent processes a chat message received via EventSub
// channel.chat.message and runs simple command handlers.
// messageID is the EventSub message_id for the chat message that triggered
// this handler and is used when sending true reply messages via Helix.
func handleChatMessageEvent(channelLogin, chatterLogin, chatterID, messageID, message string) {
	channelLogin = strings.ToLower(channelLogin)
	log.Printf("[CHAT] channel=%s user=%s msgID=%s msg=%q", channelLogin, chatterLogin, messageID, message)
	recordChatEvent(channelLogin, chatterLogin)

	// ── Blocked term enforcement ──────────────────────────────────────────────
	if db != nil && strings.ToLower(chatterLogin) != strings.ToLower(channelLogin) {
		terms, err := ListBlockedTerms(channelLogin)
		if err != nil {
			log.Println("blocked terms load error:", err)
		} else {
			lowerMsg := strings.ToLower(message)
			for _, bt := range terms {
				if strings.Contains(lowerMsg, strings.ToLower(bt.Term)) {
					log.Printf("[BLOCKED TERM] channel=%s user=%s term=%q action=%s messageID=%q", channelLogin, chatterLogin, bt.Term, bt.Action, messageID)
					switch bt.Action {
				case "delete":
					if err := deleteHelixMessage(channelLogin, messageID); err != nil {
						log.Println("blocked term delete message error:", err)
					} else {
						go PostDiscordModAlert(channelLogin, "AxyraBot's Moderation Settings", chatterLogin, "delete", fmt.Sprintf("Blocked term: %s", bt.Term))
					}
					case "timeout":
						secs := bt.TimeoutSeconds
						if secs <= 0 {
							secs = 60
						}
						if err := timeoutUser(channelLogin, chatterLogin, secs, fmt.Sprintf("Blocked term: %s", bt.Term)); err != nil {
							log.Println("blocked term timeout error:", err)
						}
					case "ban":
						if err := banUser(channelLogin, chatterLogin, fmt.Sprintf("Blocked term: %s", bt.Term)); err != nil {
							log.Println("blocked term ban error:", err)
						}
					}
					return // stop processing further after enforcement
				}
			}
		}
	}
	// ─────────────────────────────────────────────────────────────────────────

	// ── Spam filter enforcement ───────────────────────────────────────────────
	if db != nil && strings.ToLower(chatterLogin) != strings.ToLower(channelLogin) {
		filters, err := ListSpamFilters(channelLogin)
		if err != nil {
			log.Println("spam filters load error:", err)
		} else if len(filters) > 0 {
			var triggeredFilter *SpamFilter
			var triggerReason string
			for i := range filters {
				f := &filters[i]
				switch f.Type {
				case "caps":
					// Trigger when ≥10 alpha chars and ≥70% are uppercase
					var upper, total int
					for _, ch := range message {
						if ch >= 'A' && ch <= 'Z' {
							upper++
							total++
						} else if ch >= 'a' && ch <= 'z' {
							total++
						}
					}
					if total >= 10 && upper*100/total >= 70 {
						triggeredFilter = f
						triggerReason = "excessive caps"
					}
				case "link":
					// Trigger when any word looks like a URL
					linkTLDs := []string{".com", ".net", ".org", ".gg", ".tv", ".io", ".me", ".co", ".ly", ".ru", ".de", ".uk", ".ca"}
					lowerMsg := strings.ToLower(message)
					for _, word := range strings.Fields(lowerMsg) {
						if strings.Contains(word, "://") || strings.HasPrefix(word, "www.") {
							triggeredFilter = f
							triggerReason = "link detected"
							break
						}
						for _, tld := range linkTLDs {
							if strings.Contains(word, tld) && strings.Contains(word, ".") {
								triggeredFilter = f
								triggerReason = "link detected"
								break
							}
						}
						if triggeredFilter != nil {
							break
						}
					}
				case "length":
					// Trigger when message exceeds 400 characters
					if len([]rune(message)) > 400 {
						triggeredFilter = f
						triggerReason = "message too long"
					}
				case "emotes":
					// Trigger when a single word is repeated 5+ times (emote spam)
					wordCounts := map[string]int{}
					for _, w := range strings.Fields(strings.ToLower(message)) {
						wordCounts[w]++
						if wordCounts[w] >= 5 {
							triggeredFilter = f
							triggerReason = "emote spam"
							break
						}
					}
				}
				if triggeredFilter != nil {
					break
				}
			}
			if triggeredFilter != nil {
				log.Printf("[SPAM FILTER] channel=%s user=%s filter=%s reason=%s action=%s", channelLogin, chatterLogin, triggeredFilter.Type, triggerReason, triggeredFilter.Action)
				switch triggeredFilter.Action {
				case "delete":
					if err := deleteHelixMessage(channelLogin, messageID); err != nil {
						log.Println("spam filter delete message error:", err)
					} else {
						go PostDiscordModAlert(channelLogin, "AxyraBot's Moderation Settings", chatterLogin, "delete", fmt.Sprintf("Spam filter: %s", triggerReason))
					}
				case "timeout":
					secs := triggeredFilter.TimeoutSeconds
					if secs <= 0 {
						secs = 60
					}
					if err := timeoutUser(channelLogin, chatterLogin, secs, fmt.Sprintf("Spam filter: %s", triggerReason)); err != nil {
						log.Println("spam filter timeout error:", err)
					}
				case "ban":
					if err := banUser(channelLogin, chatterLogin, fmt.Sprintf("Spam filter: %s", triggerReason)); err != nil {
						log.Println("spam filter ban error:", err)
					}
				}
				return // stop processing further after enforcement
			}
		}
	}
	// ─────────────────────────────────────────────────────────────────────────

	// update approximate watch time based on chat activity, but only while live
	if db != nil && isChannelLive(channelLogin) {
		if err := UpdateWatchTime(channelLogin, strings.ToLower(chatterLogin), time.Now().UTC()); err != nil {
			log.Println("failed to update watch time:", err)
		}
	}

	// track that this user has recently chatted in this channel so custom
	// commands can reference $(random.chatter)
	noteChatterSeen(channelLogin, chatterLogin)

	botName := os.Getenv("TWITCH_BOT_USERNAME")
	if botName == "" {
		botName = "AxyraBot"
	}

	// !ai (message) - ask ChatGPT a question or send a prompt and reply in chat.
	if isChatCommand(message, "!ai") {
		if !isDefaultCommandEnabled(channelLogin, "!ai") {
			return
		}
		prompt := strings.TrimSpace(strings.TrimPrefix(message, "!ai"))
		if prompt == "" {
			if err := sendHelixChatMessage(channelLogin, "Usage: !ai <your question or prompt>"); err != nil {
				log.Println("failed to send !ai usage response:", err)
			}
			return
		}
		// Call the external AI provider (e.g., OpenAI) to get a short answer.
		reply, err := getAIResponse(channelLogin, chatterLogin, prompt)
		if err != nil {
			log.Println("failed to get !ai response:", err)
			if err := sendHelixChatMessage(channelLogin, "Sorry, the AI is not available right now."); err != nil {
				log.Println("failed to send !ai error response:", err)
			}
			return
		}
		if strings.TrimSpace(reply) == "" {
			return
		}
		// Prefix with the requesting user so chat can see who asked.
		msg := fmt.Sprintf("@%s %s", chatterLogin, reply)
		if err := sendHelixChatMessage(channelLogin, msg); err != nil {
			log.Println("failed to send !ai chat response:", err)
		}
		return
	}

	// !addcom !trigger response - add or update a custom command (mods + broadcaster only)
	if isChatCommand(message, "!addcom") {
		// Require broadcaster or moderator
		allowed, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
		if err != nil {
			log.Println("failed moderator check for !addcom:", err)
		}
		if !allowed {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("@%s only the broadcaster or a moderator can use !addcom", chatterLogin)); err != nil {
				log.Println("failed to send !addcom permission response:", err)
			}
			return
		}
		rest := strings.TrimSpace(strings.TrimPrefix(message, "!addcom"))
		if rest == "" {
			if err := sendHelixChatMessage(channelLogin, "Usage: !addcom !command response text"); err != nil {
				log.Println("failed to send !addcom usage response:", err)
			}
			return
		}
		parts := strings.SplitN(rest, " ", 2)
		if len(parts) < 2 {
			if err := sendHelixChatMessage(channelLogin, "Usage: !addcom !command response text"); err != nil {
				log.Println("failed to send !addcom usage response:", err)
			}
			return
		}
		trigger := strings.TrimSpace(parts[0])
		response := strings.TrimSpace(parts[1])
		if !strings.HasPrefix(trigger, "!") || len(trigger) < 2 {
			if err := sendHelixChatMessage(channelLogin, "Custom command trigger must start with ! and contain at least one character after it"); err != nil {
				log.Println("failed to send !addcom validation response:", err)
			}
			return
		}
		// Do not allow overriding built-in commands; those are controlled via dashboard toggles.
		for _, d := range defaultCommandNames {
			if strings.EqualFold(trigger, d) {
				if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s is a built-in command and cannot be overridden; use the dashboard to toggle it", trigger)); err != nil {
					log.Println("failed to send !addcom built-in response:", err)
				}
				return
			}
		}
		if db != nil {
			if err := UpsertCustomCommand(channelLogin, chatterLogin, trigger, response, "all"); err != nil {
				log.Println("failed to upsert custom command:", err)
				if err2 := sendHelixChatMessage(channelLogin, "Failed to save custom command"); err2 != nil {
					log.Println("failed to send !addcom error response:", err2)
				}
				return
			}
			// Record in the audit log that a custom command was added/updated via chat.
			action := "added"
			if _, role, err := GetCustomCommandResponse(channelLogin, trigger); err == nil && role != "" {
				// If the command already existed, treat this as an update.
				action = "updated"
			}
			desc := fmt.Sprintf("%s %s custom command %s via chat", chatterLogin, action, trigger)
			if err := InsertAuditLog(channelLogin, "bot", "custom_command_add", desc); err != nil {
				log.Println("failed to insert audit log for !addcom:", err)
			}
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s the command %s has been added.", chatterLogin, trigger)); err != nil {
			log.Println("failed to send !addcom confirmation:", err)
		}
		return
	}

	// !delcom !trigger - delete a custom command (mods + broadcaster only)
	if isChatCommand(message, "!delcom") {
		allowed, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
		if err != nil {
			log.Println("failed moderator check for !delcom:", err)
		}
		if !allowed {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("@%s only the broadcaster or a moderator can use !delcom", chatterLogin)); err != nil {
				log.Println("failed to send !delcom permission response:", err)
			}
			return
		}
		arg := strings.TrimSpace(strings.TrimPrefix(message, "!delcom"))
		if arg == "" {
			if err := sendHelixChatMessage(channelLogin, "Usage: !delcom !command"); err != nil {
				log.Println("failed to send !delcom usage response:", err)
			}
			return
		}
		trigger := arg
		if !strings.HasPrefix(trigger, "!") || len(trigger) < 2 {
			if err := sendHelixChatMessage(channelLogin, "Custom command trigger must start with ! and contain at least one character after it"); err != nil {
				log.Println("failed to send !delcom validation response:", err)
			}
			return
		}
		for _, d := range defaultCommandNames {
			if strings.EqualFold(trigger, d) {
				if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s is a built-in command and cannot be deleted; use the dashboard to toggle it", trigger)); err != nil {
					log.Println("failed to send !delcom built-in response:", err)
				}
				return
			}
		}
		if db != nil {
			if err := DeleteCustomCommand(channelLogin, trigger); err != nil {
				log.Println("failed to delete custom command:", err)
				if err2 := sendHelixChatMessage(channelLogin, "Failed to delete custom command"); err2 != nil {
					log.Println("failed to send !delcom error response:", err2)
				}
				return
			}
			if err := InsertAuditLog(channelLogin, "bot", "custom_command_delete", fmt.Sprintf("%s deleted custom command %s via chat", chatterLogin, trigger)); err != nil {
				log.Println("failed to insert audit log for !delcom:", err)
			}
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s the command %s has been deleted!", chatterLogin, trigger)); err != nil {
			log.Println("failed to send !delcom confirmation:", err)
		}
		return
	}

	// !editcom !trigger new response - edit an existing custom command (mods + broadcaster only)
	if isChatCommand(message, "!editcom") {
		allowed, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
		if err != nil {
			log.Println("failed moderator check for !editcom:", err)
		}
		if !allowed {
			if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("@%s only the broadcaster or a moderator can use !editcom", chatterLogin)); err != nil {
				log.Println("failed to send !editcom permission response:", err)
			}
			return
		}
		rest := strings.TrimSpace(strings.TrimPrefix(message, "!editcom"))
		if rest == "" {
			if err := sendHelixChatMessage(channelLogin, "Usage: !editcom !command new response text"); err != nil {
				log.Println("failed to send !editcom usage response:", err)
			}
			return
		}
		parts := strings.SplitN(rest, " ", 2)
		if len(parts) < 2 {
			if err := sendHelixChatMessage(channelLogin, "Usage: !editcom !command new response text"); err != nil {
				log.Println("failed to send !editcom usage response:", err)
			}
			return
		}
		trigger := strings.TrimSpace(parts[0])
		newResponse := strings.TrimSpace(parts[1])
		if !strings.HasPrefix(trigger, "!") || len(trigger) < 2 {
			if err := sendHelixChatMessage(channelLogin, "Custom command trigger must start with ! and contain at least one character after it"); err != nil {
				log.Println("failed to send !editcom validation response:", err)
			}
			return
		}
		for _, d := range defaultCommandNames {
			if strings.EqualFold(trigger, d) {
				if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s is a built-in command and cannot be edited; use the dashboard to toggle it", trigger)); err != nil {
					log.Println("failed to send !editcom built-in response:", err)
				}
				return
			}
		}
		if db != nil {
			if err := UpsertCustomCommand(channelLogin, chatterLogin, trigger, newResponse, "all"); err != nil {
				log.Println("failed to update custom command:", err)
				if err2 := sendHelixChatMessage(channelLogin, "Failed to edit custom command"); err2 != nil {
					log.Println("failed to send !editcom error response:", err2)
				}
				return
			}
			if err := InsertAuditLog(channelLogin, "bot", "custom_command_update", fmt.Sprintf("%s edited custom command %s via chat", chatterLogin, trigger)); err != nil {
				log.Println("failed to insert audit log for !editcom:", err)
			}
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("%s the command %s has been edited.", chatterLogin, trigger)); err != nil {
			log.Println("failed to send !editcom confirmation:", err)
		}
		return
	}

	// basic commands migrated from IRC handler
	if isChatCommand(message, "!hello") {
		if !isDefaultCommandEnabled(channelLogin, "!hello") {
			return
		}
		if err := sendHelixChatMessage(channelLogin, fmt.Sprintf("Hello! I am %s", botName)); err != nil {
			log.Println("failed to send !hello response:", err)
		}
	}

	// !vanish - timeout the user for 1 second with a playful reason
	if isChatCommand(message, "!vanish") {
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
	if isChatCommand(message, "!title") {
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
	if isChatCommand(message, "!game") {
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
	if isChatCommand(message, "!accountage") {
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
	if isChatCommand(message, "!followage") {
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
	if isChatCommand(message, "!uptime") {
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

	// Birthday module commands (treated as a single toggleable module).
	// If the module is disabled for this broadcaster, skip all birthday
	// commands.
	if db != nil && strings.HasPrefix(strings.TrimSpace(message), "!") {
		enabled, err := GetModuleEnabled(channelLogin, "birthdays")
		if err != nil {
			log.Println("GetModuleEnabled(birthdays) failed:", err)
		}
		if enabled {
			// Normalize message and split once for easier parsing.
			msg := strings.TrimSpace(message)
			lower := strings.ToLower(msg)

			// Helper to parse MM DD from args slice.
			parseMonthDay := func(args []string) (int, int, error) {
				if len(args) < 2 {
					return 0, 0, fmt.Errorf("usage: MM DD")
				}
				m, err1 := strconv.Atoi(args[0])
				d, err2 := strconv.Atoi(args[1])
				if err1 != nil || err2 != nil || m < 1 || m > 12 || d < 1 || d > 31 {
					return 0, 0, fmt.Errorf("invalid date")
				}
				return m, d, nil
			}

			// !birthday - show today's birthdays in the broadcaster's timezone.
			if isChatCommand(lower, "!birthday") {
				if !isDefaultCommandEnabled(channelLogin, "!birthday") {
					return
				}
				loc := getBroadcasterLocation(channelLogin)
				now := time.Now().In(loc)
				birthdays, err := ListBirthdays(channelLogin)
				if err != nil {
					log.Println("ListBirthdays failed:", err)
					return
				}
				mm := int(now.Month())
				dd := now.Day()
				var today []string
				for _, b := range birthdays {
					if b.Month == mm && b.Day == dd {
						name := b.DisplayName
						if strings.TrimSpace(name) == "" {
							name = b.UserLogin
						}
						today = append(today, name)
					}
				}
				var text string
				if len(today) == 0 {
					text = "There are no saved birthdays for today."
				} else {
					if len(today) == 1 {
						text = fmt.Sprintf("Today's birthday is %s!", today[0])
					} else {
						text = fmt.Sprintf("Today's birthdays are %s!", strings.Join(today, ", "))
					}
				}
				text = renderBirthdayCommandMessage(channelLogin, "!birthday", text, map[string]string{
					"names": strings.Join(today, ", "),
					"count": strconv.Itoa(len(today)),
				})
				if err := sendHelixChatMessage(channelLogin, text); err != nil {
					log.Println("failed to send !birthday response:", err)
				}
				return
			}

			// !nextbday - show the next upcoming birthday.
			if isChatCommand(lower, "!nextbday") {
				if !isDefaultCommandEnabled(channelLogin, "!nextbday") {
					return
				}
				loc := getBroadcasterLocation(channelLogin)
				now := time.Now().In(loc)
				birthdays, err := ListBirthdays(channelLogin)
				if err != nil {
					log.Println("ListBirthdays failed:", err)
					return
				}
				if len(birthdays) == 0 {
					text := renderBirthdayCommandMessage(channelLogin, "!nextbday", "No birthdays have been saved yet.", map[string]string{
						"names": "",
						"date":  "",
					})
					if err := sendHelixChatMessage(channelLogin, text); err != nil {
						log.Println("failed to send !nextbday empty response:", err)
					}
					return
				}
				var (
					bestDate  time.Time
					bestNames []string
				)
				for _, b := range birthdays {
					candidate := time.Date(now.Year(), time.Month(b.Month), b.Day, 0, 0, 0, 0, loc)
					if candidate.Before(now) {
						candidate = candidate.AddDate(1, 0, 0)
					}
					if bestDate.IsZero() || candidate.Before(bestDate) {
						bestDate = candidate
						bestNames = nil
					}
					if candidate.Equal(bestDate) {
						name := b.DisplayName
						if strings.TrimSpace(name) == "" {
							name = b.UserLogin
						}
						bestNames = append(bestNames, name)
					}
				}
				if bestDate.IsZero() {
					return
				}
				dateStr := bestDate.Format("Jan 2")
				var text string
				if len(bestNames) == 1 {
					text = fmt.Sprintf("The next birthday is %s on %s.", bestNames[0], dateStr)
				} else {
					text = fmt.Sprintf("The next birthdays are %s on %s.", strings.Join(bestNames, ", "), dateStr)
				}
				text = renderBirthdayCommandMessage(channelLogin, "!nextbday", text, map[string]string{
					"names": strings.Join(bestNames, ", "),
					"date":  dateStr,
				})
				if err := sendHelixChatMessage(channelLogin, text); err != nil {
					log.Println("failed to send !nextbday response:", err)
				}
				return
			}

			// !addbday NAME MM DD — mods only.
			if strings.HasPrefix(lower, "!addbday") {
				if !isDefaultCommandEnabled(channelLogin, "!addbday") {
					return
				}
				args := strings.Fields(msg)
				if len(args) < 4 {
					_ = sendHelixChatMessage(channelLogin, "Usage: !addbday NAME MM DD")
					return
				}
				name := args[1]
				m, d, err := parseMonthDay(args[2:4])
				if err != nil {
					_ = sendHelixChatMessage(channelLogin, "Invalid date. Use MM DD, e.g. 02 14")
					return
				}
				isMod, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
				if err != nil || !isMod {
					return
				}
				if err := UpsertBirthday(channelLogin, strings.ToLower(name), name, m, d); err != nil {
					log.Println("UpsertBirthday(!addbday) failed:", err)
					return
				}
				text := fmt.Sprintf("Saved birthday for %s as %02d/%02d.", name, m, d)
				text = renderBirthdayCommandMessage(channelLogin, "!addbday", text, map[string]string{
					"name":  name,
					"month": fmt.Sprintf("%02d", m),
					"day":   fmt.Sprintf("%02d", d),
				})
				if err := sendHelixChatMessage(channelLogin, text); err != nil {
					log.Println("failed to send !addbday response:", err)
				}
				return
			}

			// !addmybday MM DD — add or refuse if already set.
			if strings.HasPrefix(lower, "!addmybday") {
				if !isDefaultCommandEnabled(channelLogin, "!addmybday") {
					return
				}
				args := strings.Fields(msg)
				if len(args) < 3 {
					_ = sendHelixChatMessage(channelLogin, "Usage: !addmybday MM DD")
					return
				}
				m, d, err := parseMonthDay(args[1:3])
				if err != nil {
					_ = sendHelixChatMessage(channelLogin, "Invalid date. Use MM DD, e.g. 02 14")
					return
				}
				existing, err := GetBirthdayForUser(channelLogin, chatterLogin)
				if err != nil {
					log.Println("GetBirthdayForUser failed:", err)
					return
				}
				if existing != nil {
					_ = sendHelixChatMessage(channelLogin, "You already have a birthday saved. Ask a mod to use !editbday if it needs to change.")
					return
				}
				if err := UpsertBirthday(channelLogin, chatterLogin, chatterLogin, m, d); err != nil {
					log.Println("UpsertBirthday(!addmybday) failed:", err)
					return
				}
				text := fmt.Sprintf("Saved your birthday as %02d/%02d.", m, d)
				text = renderBirthdayCommandMessage(channelLogin, "!addmybday", text, map[string]string{
					"month": fmt.Sprintf("%02d", m),
					"day":   fmt.Sprintf("%02d", d),
				})
				if err := sendHelixChatMessage(channelLogin, text); err != nil {
					log.Println("failed to send !addmybday response:", err)
				}
				return
			}

			// !delbday NAME — delete a saved birthday by name (mods only).
			if strings.HasPrefix(lower, "!delbday") {
				if !isDefaultCommandEnabled(channelLogin, "!delbday") {
					return
				}
				parts := strings.Fields(msg)
				if len(parts) < 2 {
					_ = sendHelixChatMessage(channelLogin, "Usage: !delbday NAME")
					return
				}
				isMod, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
				if err != nil || !isMod {
					return
				}
				name := strings.ToLower(parts[1])
				if err := DeleteBirthday(channelLogin, name); err != nil {
					log.Println("DeleteBirthday failed:", err)
					return
				}
				text := fmt.Sprintf("Deleted birthday for %s if it existed.", parts[1])
				text = renderBirthdayCommandMessage(channelLogin, "!delbday", text, map[string]string{
					"name": parts[1],
				})
				if err := sendHelixChatMessage(channelLogin, text); err != nil {
					log.Println("failed to send !delbday response:", err)
				}
				return
			}

			// !editbday USER MM DD — change a user's birthday (mods/broadcaster).
			if strings.HasPrefix(lower, "!editbday") {
				if !isDefaultCommandEnabled(channelLogin, "!editbday") {
					return
				}
				args := strings.Fields(msg)
				if len(args) < 4 {
					_ = sendHelixChatMessage(channelLogin, "Usage: !editbday USER MM DD")
					return
				}
				isMod, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
				if err != nil || !isMod {
					return
				}
				target := args[1]
				m, d, err := parseMonthDay(args[2:4])
				if err != nil {
					_ = sendHelixChatMessage(channelLogin, "Invalid date. Use MM DD, e.g. 02 14")
					return
				}
				if err := UpsertBirthday(channelLogin, strings.ToLower(target), target, m, d); err != nil {
					log.Println("UpsertBirthday(!editbday) failed:", err)
					return
				}
				text := fmt.Sprintf("Updated birthday for %s to %02d/%02d.", target, m, d)
				text = renderBirthdayCommandMessage(channelLogin, "!editbday", text, map[string]string{
					"name":  target,
					"month": fmt.Sprintf("%02d", m),
					"day":   fmt.Sprintf("%02d", d),
				})
				if err := sendHelixChatMessage(channelLogin, text); err != nil {
					log.Println("failed to send !editbday response:", err)
				}
				return
			}
		}
	}

	// !commands - link to the broadcaster's custom commands page on the dashboard
	if isChatCommand(message, "!commands") {
		if !isDefaultCommandEnabled(channelLogin, "!commands") {
			return
		}
		base := getFrontendBaseURL()
		link := fmt.Sprintf("%s/commands/%s", base, url.PathEscape(channelLogin))
		text := fmt.Sprintf("All of %s's custom commands can be found here %s", channelLogin, link)
		if err := sendHelixChatMessage(channelLogin, text, messageID); err != nil {
			log.Println("failed to send !commands response:", err)
		}
		return
	}

	// Custom commands: if the first token matches a stored trigger, send its response.
	msgTrimmed := strings.TrimSpace(message)
	if strings.HasPrefix(msgTrimmed, "!") && db != nil {
		fields := strings.Fields(msgTrimmed)
		if len(fields) > 0 {
			trigger := strings.ToLower(fields[0])
			if resp, role, err := GetCustomCommandResponse(channelLogin, trigger); err != nil {
				log.Println("failed to look up custom command:", err)
			} else if resp != "" {
				if canUseCustomCommand(channelLogin, chatterLogin, role) {
					// Increment the per-command usage counter used by the $(count)
					// template variable. Errors here should not block command usage.
					usageCount, err := IncrementCustomCommandCount(channelLogin, trigger)
					if err != nil {
						log.Println("failed to increment custom command count:", err)
					}
					if usageCount <= 0 {
						usageCount = 1
					}

					// Render template variables like $(user), $(touser), $(random.chatter),
					// and $(count).
					// For $(touser), use the text after the trigger word, e.g.
					//   !hug someName  => touser = "someName".
					toUser := ""
					if len(fields) > 1 {
						toUser = strings.TrimSpace(strings.Join(fields[1:], " "))
						toUser = strings.TrimPrefix(toUser, "@")
					}
					text := renderCustomCommandResponse(channelLogin, chatterLogin, toUser, resp, usageCount)
					if err := sendHelixChatMessage(channelLogin, text); err != nil {
						log.Println("failed to send custom command response:", err)
					}
				}
			}
		}
	}

}

// isBroadcasterOrModerator checks whether chatterLogin is the broadcaster for
// channelLogin or a moderator in that channel. It uses the broadcaster's
// stored user access token (via GetUserAccessToken) together with the Helix
// Get Moderators endpoint. This satisfies Twitch's requirement that the
// broadcaster_id in the request match the user ID in the OAuth token.
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

	// Resolve broadcaster id via Helix /users using the broadcaster's token
	usersReqBroadcaster, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(channelLogin), nil)
	if err != nil {
		return false, err
	}
	usersReqBroadcaster.Header.Set("Client-ID", clientID)
	usersReqBroadcaster.Header.Set("Authorization", "Bearer "+access)
	client := &http.Client{Timeout: 10 * time.Second}
	usersRespBroadcaster, err := client.Do(usersReqBroadcaster)
	if err != nil {
		return false, err
	}
	defer usersRespBroadcaster.Body.Close()
	if usersRespBroadcaster.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(usersRespBroadcaster.Body)
		return false, fmt.Errorf("helix users status %s: %s", usersRespBroadcaster.Status, string(b))
	}
	var usersResBroadcaster struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(usersRespBroadcaster.Body).Decode(&usersResBroadcaster); err != nil {
		return false, err
	}
	if len(usersResBroadcaster.Data) == 0 {
		return false, fmt.Errorf("broadcaster not found: %s", channelLogin)
	}
	broadcasterID := usersResBroadcaster.Data[0].ID

	// Resolve chatter user id via /users
	usersReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(chatterLogin), nil)
	if err != nil {
		return false, err
	}
	usersReq.Header.Set("Client-ID", clientID)
	usersReq.Header.Set("Authorization", "Bearer "+access)
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
		// If the broadcaster token is missing moderation scopes, treat the user as
		// not a moderator instead of failing the command, but log once for
		// visibility.
		if modsResp.StatusCode == http.StatusUnauthorized &&
			strings.Contains(string(b), "Missing scope") {
			log.Println("isBroadcasterOrModerator: missing moderation scope on broadcaster token; treating as not-moderator")
			return false, nil
		}
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

// StartBirthdayScheduler runs a per-broadcaster goroutine that fires at
// midnight in each broadcaster's configured timezone. It announces today's
// birthdays to Twitch chat and (if Discord is configured) to the Discord
// birthday channel.
func StartBirthdayScheduler() {
	// Give the DB a moment to be ready on cold-start.
	time.Sleep(5 * time.Second)

	// Keep a set of channels we've already spawned a watcher for, so that
	// when new channels join we can pick them up on the next daily rescan.
	spawned := map[string]bool{}
	spawnWatcher := func(login string) {
		spawned[login] = true
		go func(login string) {
			for {
				loc := getBroadcasterLocation(login)
				now := time.Now().In(loc)
				// Next midnight in this broadcaster's timezone.
				nextMidnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, loc)
				sleepDur := time.Until(nextMidnight)
				log.Printf("birthday scheduler: %s sleeping %s until midnight (%s)", login, sleepDur.Round(time.Second), loc)
				time.Sleep(sleepDur)

				// Fire birthday check exactly at midnight.
				fireBirthdayAnnouncement(login)
			}
		}(login)
	}

	// Initial seed: spawn watchers for every currently-joined channel.
	if channels, err := GetJoinedChannels(); err == nil {
		for _, ch := range channels {
			spawnWatcher(ch)
		}
	}

	// Re-check every hour for newly joined channels.
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		channels, err := GetJoinedChannels()
		if err != nil {
			continue
		}
		for _, ch := range channels {
			if !spawned[ch] {
				spawnWatcher(ch)
			}
		}
	}
}

// fireBirthdayAnnouncement looks up today's birthdays for login (in their
// configured timezone) and sends announcements to Twitch chat and Discord.
func fireBirthdayAnnouncement(channelLogin string) {
	// Only fire if the birthdays module is enabled for this channel.
	enabled, err := GetModuleEnabled(channelLogin, "birthdays")
	if err != nil {
		log.Printf("birthday scheduler: GetModuleEnabled(%s): %v", channelLogin, err)
		return
	}
	if !enabled {
		return
	}

	loc := getBroadcasterLocation(channelLogin)
	now := time.Now().In(loc)
	mm := int(now.Month())
	dd := now.Day()

	birthdays, err := ListBirthdays(channelLogin)
	if err != nil {
		log.Printf("birthday scheduler: ListBirthdays(%s): %v", channelLogin, err)
		return
	}

	var today []string
	for _, b := range birthdays {
		if b.Month == mm && b.Day == dd {
			name := strings.TrimSpace(b.DisplayName)
			if name == "" {
				name = b.UserLogin
			}
			today = append(today, name)
		}
	}
	if len(today) == 0 {
		return
	}

	namesStr := strings.Join(today, ", ")

	// Twitch chat announcement.
	var text string
	if len(today) == 1 {
		text = fmt.Sprintf("Today's birthday is %s!", namesStr)
	} else {
		text = fmt.Sprintf("Today's birthdays are %s!", namesStr)
	}
	text = renderBirthdayCommandMessage(channelLogin, "!birthday", text, map[string]string{
		"names": namesStr,
		"count": strconv.Itoa(len(today)),
	})
	if err := sendHelixChatMessage(channelLogin, text); err != nil {
		log.Printf("birthday scheduler: send chat (%s): %v", channelLogin, err)
	}

	// Discord announcement.
	PostDiscordBirthdayAnnouncement(channelLogin, namesStr)
}

// getBroadcasterLocation returns the time.Location to use for a given
// broadcaster when computing date-based features like birthdays. For now it
// falls back to a global default timezone (BIRTHDAY_DEFAULT_TZ) when set, or
// the server's local time zone otherwise. This can be extended later to use
// a per-broadcaster setting stored in the database.
func getBroadcasterLocation(broadcasterLogin string) *time.Location {
	// Prefer a per-broadcaster setting from the database when available.
	if db != nil {
		if tzName, err := GetBroadcasterTimezone(broadcasterLogin); err == nil && strings.TrimSpace(tzName) != "" {
			if loc, err := time.LoadLocation(tzName); err == nil {
				return loc
			}
		}
	}
	// Optional global override so deploys can pick a consistent timezone.
	if tz := strings.TrimSpace(os.Getenv("BIRTHDAY_DEFAULT_TZ")); tz != "" {
		if loc, err := time.LoadLocation(tz); err == nil {
			return loc
		}
	}
	return time.Local
}

// isChannelVIP determines whether chatterLogin is a VIP in channelLogin
// using the broadcaster's stored user access token together with the Helix
// Get VIPs endpoint. This avoids the "broadcaster_id must match the user ID
// in the request's OAuth token" 401 that occurs when using a separate bot
// account token.
func isChannelVIP(channelLogin, chatterLogin string) (bool, error) {
	channelLogin = strings.ToLower(channelLogin)
	chatterLogin = strings.ToLower(chatterLogin)
	if channelLogin == chatterLogin {
		// Treat the broadcaster as allowed when a command is restricted to VIPs.
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

	// Resolve broadcaster id via Helix /users using the broadcaster's token
	usersReqBroadcaster, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(channelLogin), nil)
	if err != nil {
		return false, err
	}
	usersReqBroadcaster.Header.Set("Client-ID", clientID)
	usersReqBroadcaster.Header.Set("Authorization", "Bearer "+access)
	client := &http.Client{Timeout: 10 * time.Second}
	usersRespBroadcaster, err := client.Do(usersReqBroadcaster)
	if err != nil {
		return false, err
	}
	defer usersRespBroadcaster.Body.Close()
	if usersRespBroadcaster.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(usersRespBroadcaster.Body)
		return false, fmt.Errorf("helix users status %s: %s", usersRespBroadcaster.Status, string(b))
	}
	var usersResBroadcaster struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(usersRespBroadcaster.Body).Decode(&usersResBroadcaster); err != nil {
		return false, err
	}
	if len(usersResBroadcaster.Data) == 0 {
		return false, fmt.Errorf("broadcaster not found: %s", channelLogin)
	}
	broadcasterID := usersResBroadcaster.Data[0].ID

	// Resolve chatter user id via /users
	usersReq, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+url.QueryEscape(chatterLogin), nil)
	if err != nil {
		return false, err
	}
	usersReq.Header.Set("Client-ID", clientID)
	usersReq.Header.Set("Authorization", "Bearer "+access)
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

	// Query VIP list for this specific user
	vipsURL := fmt.Sprintf("https://api.twitch.tv/helix/channels/vips?broadcaster_id=%s&user_id=%s", url.QueryEscape(broadcasterID), url.QueryEscape(chatterID))
	vipsReq, err := http.NewRequest("GET", vipsURL, nil)
	if err != nil {
		return false, err
	}
	vipsReq.Header.Set("Client-ID", clientID)
	vipsReq.Header.Set("Authorization", "Bearer "+access)
	vipsResp, err := client.Do(vipsReq)
	if err != nil {
		return false, err
	}
	defer vipsResp.Body.Close()
	if vipsResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(vipsResp.Body)
		// If the broadcaster token is missing VIP scopes, treat the user as not a
		// VIP instead of failing the command, but log once for visibility.
		if vipsResp.StatusCode == http.StatusUnauthorized &&
			strings.Contains(string(b), "Missing scope") {
			log.Println("isChannelVIP: missing VIP scope on broadcaster token; treating as not-VIP")
			return false, nil
		}
		return false, fmt.Errorf("helix vips status %s: %s", vipsResp.Status, string(b))
	}
	var vipsRes struct {
		Data []struct {
			UserID string `json:"user_id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(vipsResp.Body).Decode(&vipsRes); err != nil {
		return false, err
	}
	return len(vipsRes.Data) > 0, nil
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
	go PostDiscordModAlert(channelLogin, "AxyraBot's Moderation Settings", targetLogin, "timeout", reason)
	return nil
}

// deleteHelixMessage deletes a single chat message using the Helix
// DELETE /helix/chat/messages endpoint (requires moderator:manage:chat_messages).
// The broadcaster's stored token is used as both broadcaster and moderator.
func deleteHelixMessage(channelLogin, messageID string) error {
	channelLogin = strings.ToLower(channelLogin)
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	access, err := GetUserAccessToken(channelLogin)
	if err != nil || access == "" {
		return fmt.Errorf("no user token for channel %s: %w", channelLogin, err)
	}
	// Resolve broadcaster ID directly from the token (same pattern as timeoutUser/banUser).
	broadcasterID, err := getUserIDFromToken(access)
	if err != nil {
		return fmt.Errorf("getUserIDFromToken failed for delete: %w", err)
	}
	if broadcasterID == "" {
		return fmt.Errorf("empty broadcaster ID for channel %s", channelLogin)
	}
	endpoint := fmt.Sprintf(
		"https://api.twitch.tv/helix/chat/messages?broadcaster_id=%s&moderator_id=%s&message_id=%s",
		url.QueryEscape(broadcasterID), url.QueryEscape(broadcasterID), url.QueryEscape(messageID),
	)
	req, err := http.NewRequest("DELETE", endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+access)
	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	log.Printf("[DELETE MSG] broadcasterID=%s messageID=%s status=%s body=%s", broadcasterID, messageID, res.Status, string(b))
	if res.StatusCode != http.StatusNoContent && res.StatusCode/100 != 2 {
		return fmt.Errorf("helix delete message status %s: %s", res.Status, string(b))
	}
	return nil
}

// banUser permanently bans a user from the channel using the Helix
// POST /helix/moderation/bans endpoint (requires moderator:manage:banned_users).
func banUser(channelLogin, targetLogin, reason string) error {
	channelLogin = strings.ToLower(channelLogin)
	targetLogin = strings.ToLower(targetLogin)
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID not set")
	}
	access, err := GetUserAccessToken(channelLogin)
	if err != nil || access == "" {
		return fmt.Errorf("no user token for channel %s: %w", channelLogin, err)
	}
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
	httpClient := &http.Client{Timeout: 10 * time.Second}
	usersResp, err := httpClient.Do(usersReq)
	if err != nil {
		return err
	}
	defer usersResp.Body.Close()
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
			"user_id": targetID,
			"reason":  reason,
		},
	}
	buf, _ := json.Marshal(body)
	endpoint := fmt.Sprintf("https://api.twitch.tv/helix/moderation/bans?broadcaster_id=%s&moderator_id=%s",
		url.QueryEscape(broadcasterID), url.QueryEscape(broadcasterID))
	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("helix ban status %s: %s", resp.Status, string(b))
	}
	go PostDiscordModAlert(channelLogin, "AxyraBot's Moderation Settings", targetLogin, "ban", reason)
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

	// Record the change in the audit log as a stream_update event so the
	// dashboard's Recent Activity feed shows title/category changes that
	// originated from chat commands (!title / !game).
	descParts := []string{}
	if strings.TrimSpace(title) != "" {
		descParts = append(descParts, fmt.Sprintf("title=\"%s\"", title))
	}
	if strings.TrimSpace(category) != "" {
		descParts = append(descParts, fmt.Sprintf("category=\"%s\"", category))
	}
	if len(descParts) > 0 {
		desc := "Updated stream settings from chat: " + strings.Join(descParts, ", ")
		if err := InsertAuditLog(channelLogin, "bot", "stream_update", desc); err != nil {
			log.Println("failed to insert audit log for chat-based stream update:", err)
		}
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

// isModuleEnabled returns whether a given module is enabled for the
// specified broadcaster. If there is any error or no row, the module is
// treated as enabled.
func isModuleEnabled(channelLogin, moduleName string) bool {
	enabled, err := GetModuleEnabled(channelLogin, moduleName)
	if err != nil {
		log.Println("failed to read module setting:", err)
		return true
	}
	return enabled
}

// noteChatterSeen records that a user has sent a message in a channel at the
// given time. This is used to power template variables like $(random.chatter)
// in custom command responses.
func noteChatterSeen(channelLogin, chatterLogin string) {
	channelLogin = strings.ToLower(strings.TrimSpace(channelLogin))
	chatterLogin = strings.ToLower(strings.TrimSpace(chatterLogin))
	if channelLogin == "" || chatterLogin == "" {
		return
	}
	chattersMu.Lock()
	defer chattersMu.Unlock()
	m, ok := chattersByChannel[channelLogin]
	if !ok {
		m = map[string]time.Time{}
		chattersByChannel[channelLogin] = m
	}
	m[chatterLogin] = time.Now().UTC()
}

// getRandomChatter returns the login of a random recent chatter in the given
// channel. It considers only users who have spoken within the last few
// minutes. If no such user is found, it returns an empty string.
func getRandomChatter(channelLogin string) string {
	const window = 10 * time.Minute
	channelLogin = strings.ToLower(strings.TrimSpace(channelLogin))
	if channelLogin == "" {
		return ""
	}
	now := time.Now().UTC()
	chattersMu.Lock()
	defer chattersMu.Unlock()
	m, ok := chattersByChannel[channelLogin]
	if !ok || len(m) == 0 {
		return ""
	}
	// collect eligible chatters and prune old entries
	eligible := make([]string, 0, len(m))
	for user, ts := range m {
		if now.Sub(ts) <= window {
			eligible = append(eligible, user)
		} else {
			delete(m, user)
		}
	}
	if len(eligible) == 0 {
		return ""
	}
	return eligible[rand.Intn(len(eligible))]
}

// getRandomChatterFromAPI uses Twitch's Get Chatters endpoint to select a
// random user currently in chat for the given channel. It uses the
// broadcaster's stored user access token (which must include the
// moderator:read:chatters scope). On error or if no chatters are returned,
// it returns an empty string.
func getRandomChatterFromAPI(channelLogin string) string {
	channelLogin = strings.ToLower(strings.TrimSpace(channelLogin))
	if channelLogin == "" {
		return ""
	}
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	if clientID == "" {
		return ""
	}
	access, err := GetUserAccessToken(channelLogin)
	if err != nil || access == "" {
		return ""
	}

	// Derive broadcaster ID from the user token
	userID, err := getUserIDFromToken(access)
	if err != nil || userID == "" {
		return ""
	}

	// Use the broadcaster as both broadcaster_id and moderator_id so their
	// token can read chatters for their own channel.
	endpoint := fmt.Sprintf("https://api.twitch.tv/helix/chat/chatters?broadcaster_id=%s&moderator_id=%s&first=1000", url.QueryEscape(userID), url.QueryEscape(userID))
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", "Bearer "+access)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return ""
	}
	var data struct {
		Data []struct {
			UserLogin string `json:"user_login"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ""
	}
	if len(data.Data) == 0 {
		return ""
	}
	// pick a random chatter from the returned list
	idx := rand.Intn(len(data.Data))
	return strings.ToLower(strings.TrimSpace(data.Data[idx].UserLogin))
}

// renderCustomCommandResponse applies simple template substitutions to a
// stored custom command response string. Supported placeholders:
//
//	$(user)           - the login of the user who triggered the command
//	$(channel)        - the channel's login
//	$(touser)         - the argument text after the trigger, e.g. for
//	                    "!hug someName" this would be "someName" (without @)
//	$(random.chatter) - a random current chatter in the channel (falls back
//	                    to $(user) if none are available)
//	$(count)          - a per-command counter that increments each time the
//	                    command is successfully used in that channel
func renderCustomCommandResponse(channelLogin, chatterLogin, toUser, template string, usageCount int64) string {
	channelLogin = strings.ToLower(strings.TrimSpace(channelLogin))
	chatterLogin = strings.TrimSpace(chatterLogin)
	toUser = strings.TrimSpace(toUser)
	if template == "" {
		return ""
	}
	out := template
	// Detect whether the template referenced $(user). Instead of inserting the
	// username into the message text, we will reply to the user by mentioning
	// them (e.g. "@nicko ..."). This keeps responses cleaner while still
	// targeting the user who triggered the command.
	hadUserPlaceholder := strings.Contains(out, "$(user)")
	// Remove $(user) from the template text; the reply targeting is handled via
	// the mention prefix added below.
	out = strings.ReplaceAll(out, "$(user)", "")
	// simple replacement for channel
	out = strings.ReplaceAll(out, "$(channel)", channelLogin)
	if toUser == "" {
		toUser = chatterLogin
	}
	out = strings.ReplaceAll(out, "$(touser)", toUser)
	// random chatter: compute once per render so multiple occurrences are
	// consistent within a single message.
	rc := getRandomChatterFromAPI(channelLogin)
	if rc == "" {
		// fall back to our in-memory recent chatter list if the API fails or
		// returns no data
		rc = getRandomChatter(channelLogin)
	}
	if rc == "" {
		rc = chatterLogin
	}
	out = strings.ReplaceAll(out, "$(random.chatter)", rc)

	// $(count) - per-command usage counter
	if strings.Contains(out, "$(count)") {
		if usageCount < 0 {
			usageCount = 0
		}
		out = strings.ReplaceAll(out, "$(count)", strconv.FormatInt(usageCount, 10))
	}
	// If the original template referenced $(user), reply directly to the
	// triggering user by prefixing the final message with an @mention rather
	// than including their name inside the template text.
	if hadUserPlaceholder && chatterLogin != "" {
		trimmed := strings.TrimSpace(out)
		if trimmed == "" {
			return "@" + chatterLogin
		}
		return "@" + chatterLogin + " " + trimmed
	}
	return out
}

// canUseCustomCommand returns true if a user with chatterLogin is allowed to
// invoke a custom command in channelLogin based on the stored role string.
// Supported roles: "all", "broadcaster", "moderator", "vip".
func canUseCustomCommand(channelLogin, chatterLogin, role string) bool {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" || role == "all" {
		return true
	}
	// broadcaster always allowed for any role
	if strings.EqualFold(channelLogin, chatterLogin) {
		return true
	}
	switch role {
	case "broadcaster":
		// only broadcaster, which we've already checked above
		return false
	case "moderator":
		ok, err := isBroadcasterOrModerator(channelLogin, chatterLogin)
		if err != nil {
			// If the error is due to missing moderation scopes on the bot token,
			// we've already logged that in isBroadcasterOrModerator; just treat
			// the user as not a moderator without spamming logs here.
			if !strings.Contains(err.Error(), "Missing scope") {
				log.Println("canUseCustomCommand moderator check failed:", err)
			}
		}
		return ok
	case "vip":
		// allow moderators and broadcaster via existing helper; otherwise check VIP list
		if ok, err := isBroadcasterOrModerator(channelLogin, chatterLogin); err == nil && ok {
			return true
		}
		ok, err := isChannelVIP(channelLogin, chatterLogin)
		if err != nil {
			// Likewise, avoid double-logging missing-scope errors for VIP checks.
			if !strings.Contains(err.Error(), "Missing scope") {
				log.Println("canUseCustomCommand vip check failed:", err)
			}
		}
		return ok
	default:
		// unknown role: fail closed
		return false
	}
}

// getFrontendBaseURL returns the base URL for the frontend dashboard used in
// responses like !commands. Prefer FRONTEND_URL, then FRONTEND_ORIGIN, and
// finally default to http://localhost:3000 for local development.
func getFrontendBaseURL() string {
	if u := os.Getenv("FRONTEND_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	if u := os.Getenv("FRONTEND_ORIGIN"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "https://axyrabot.com"
}

// getAIResponse calls an external AI provider (such as OpenAI) to generate
// a short answer for the given prompt. It is used by the !ai default
// command. If the provider is not configured or an error occurs, an error
// is returned and the caller should handle a fallback message.
func getAIResponse(channelLogin, chatterLogin, prompt string) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not set")
	}

	// Build a concise prompt so responses fit comfortably in Twitch chat.
	system := "You are AxyraBot's AI assistant answering questions from Twitch chat. Respond concisely in one or two sentences, suitable for a fast-moving chat."

	body := map[string]interface{}{
		"model": "gpt-4.1-mini",
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": prompt},
		},
		"max_tokens": 120,
	}

	buf, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openai status %s: %s", resp.Status, string(b))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("no choices from openai")
	}
	text := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if text == "" {
		return "", fmt.Errorf("empty response from openai")
	}
	// Twitch messages have practical length limits; trim overly long outputs.
	const maxChars = 350
	if len([]rune(text)) > maxChars {
		runes := []rune(text)
		text = string(runes[:maxChars]) + "…"
	}
	return text, nil
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

// sendHelixChatMessage calls Twitch's Helix /helix/chat/messages endpoint to
// send a message into the specified channel. It uses an app access token so
// the bot shows the chatbot badge in chat. The app token works as long as the
// bot account has granted user:bot and the broadcaster has granted channel:bot
// via the OAuth flow.
//
// If replyParentMessageID is provided and non-empty, the message is sent as
// a true reply to that chat message via the reply_parent_message_id field.
func sendHelixChatMessage(channelLogin, message string, replyParentMessageID ...string) error {
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

	replyID := ""
	if len(replyParentMessageID) > 0 {
		replyID = replyParentMessageID[0]
	}

	body := map[string]interface{}{
		"broadcaster_id": broadcasterID,
		"sender_id":      botID,
		"message":        message,
	}
	if replyID != "" {
		body["reply_parent_message_id"] = replyID
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

	// bot user access token for WebSocket-based subscriptions (channel.follow, stream.online)
	botToken := ""
	if bt := os.Getenv("TWITCH_BOT_OAUTH"); bt != "" {
		botToken = strings.TrimPrefix(bt, "oauth:")
	}

	// resolve bot user id (needed as moderator_user_id for channel.follow)
	botLogin := os.Getenv("TWITCH_BOT_USERNAME")
	if botLogin == "" {
		botLogin = "AxyraBot"
	}
	botID := ""
	if appToken != "" {
		if id, err := getUserID(strings.ToLower(botLogin), appToken, clientID); err != nil {
			log.Println("failed to resolve bot id:", err)
		} else {
			botID = id
		}
	}

	// Webhook secret for channel.chat.message subscriptions.
	webhookSecret := os.Getenv("TWITCH_EVENTSUB_SECRET")
	// Public callback URL that Twitch will POST notifications to.
	callbackURL := os.Getenv("TWITCH_EVENTSUB_CALLBACK_URL") // e.g. https://yourdomain.com/eventsub/callback

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

	// ── Webhook subscriptions (channel.chat.message) ─────────────────────────
	// Using webhook + app token is what qualifies the bot for the "Chat Bots"
	// section in the Users in Chat viewer list.
	if webhookSecret != "" && callbackURL != "" && appToken != "" && botID != "" {
		for _, ch := range channels {
			broadcasterID, err := getUserID(ch, appToken, clientID)
			if err != nil {
				log.Println("failed to resolve broadcaster id for webhook sub", ch, ":", err)
				continue
			}
			cond := map[string]string{
				"broadcaster_user_id": broadcasterID,
				"user_id":             botID,
			}
			if err := createEventSubSubscription(appToken, clientID, "channel.chat.message", "1", cond, "", "webhook", callbackURL, webhookSecret); err != nil {
				log.Println("failed creating webhook channel.chat.message for", ch, ":", err)
			}
			time.Sleep(300 * time.Millisecond)
		}
	} else {
		log.Println("webhook channel.chat.message skipped; set TWITCH_EVENTSUB_SECRET, TWITCH_EVENTSUB_CALLBACK_URL, and ensure app token + bot ID are available")
	}

	// ── WebSocket subscriptions (channel.follow, stream.online) ──────────────
	// These stay on the WebSocket transport. Twitch requires a user access token
	// for WebSocket EventSub; app tokens only work with webhook transport.
	if botToken == "" {
		log.Println("skipping WebSocket EventSub subscriptions; TWITCH_BOT_OAUTH not set")
		return
	}

	// Wait for the WebSocket session ID before registering WebSocket subs.
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		eventSubMu.Lock()
		sid := eventSubSessionID
		eventSubMu.Unlock()
		if sid != "" {
			for _, ch := range channels {
				broadcasterID, err := getUserID(ch, appToken, clientID)
				if err != nil {
					log.Println("failed to resolve broadcaster id for WS sub", ch, ":", err)
					continue
				}

				// channel.follow (version 2, requires moderator_user_id)
				if botID != "" {
					followCond := map[string]string{
						"broadcaster_user_id": broadcasterID,
						"moderator_user_id":   botID,
					}
					if err := createEventSubSubscription(botToken, clientID, "channel.follow", "2", followCond, sid, "websocket", "", ""); err != nil {
						log.Println("failed creating channel.follow for", ch, ":", err)
					}
					time.Sleep(300 * time.Millisecond)
				}

				// stream.online
				streamCond := map[string]string{"broadcaster_user_id": broadcasterID}
				if err := createEventSubSubscription(botToken, clientID, "stream.online", "1", streamCond, sid, "websocket", "", ""); err != nil {
					log.Println("failed creating stream.online for", ch, ":", err)
				}
				time.Sleep(300 * time.Millisecond)
			}
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
	log.Println("timed out waiting for EventSub session id; WebSocket subscriptions not registered")
}

// refreshUserToken calls the Twitch token endpoint to exchange a refresh
// token for a new access token. Returns the new access token, the (possibly
// rotated) refresh token, and any error.
func refreshUserToken(clientID, clientSecret, refreshToken string) (string, string, error) {
	v := url.Values{}
	v.Set("grant_type", "refresh_token")
	v.Set("refresh_token", refreshToken)
	v.Set("client_id", clientID)
	v.Set("client_secret", clientSecret)
	resp, err := http.Post("https://id.twitch.tv/oauth2/token", "application/x-www-form-urlencoded", strings.NewReader(v.Encode()))
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	var r struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		Error        string `json:"error"`
		Message      string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return "", "", err
	}
	if r.Error != "" {
		return "", "", fmt.Errorf("token refresh: %s — %s", r.Error, r.Message)
	}
	newRefresh := r.RefreshToken
	if newRefresh == "" {
		newRefresh = refreshToken // keep old token if server didn't rotate it
	}
	return r.AccessToken, newRefresh, nil
}

// recoverBotToken tries to obtain a valid bot user access token when the
// value stored in TWITCH_BOT_OAUTH is expired or missing. It checks sources
// in this order:
//  1. TWITCH_BOT_REFRESH_TOKEN environment variable (set this in your cloud
//     service's config to allow automatic refresh without a file system).
//  2. The users table in the DB, keyed by botLogin (populated the first time
//     the bot account logs in via /auth/callback).
//
// On success it returns the token in "oauth:TOKEN" form, the resolved login,
// and nil. It also persists the refreshed token back to the DB so subsequent
// restarts stay fresh.
func recoverBotToken(botLogin, clientID, clientSecret string) (string, string, error) {
	// 1. Env-provided refresh token (preferred for cloud deployments)
	if rt := os.Getenv("TWITCH_BOT_REFRESH_TOKEN"); rt != "" {
		newAccess, newRefresh, err := refreshUserToken(clientID, clientSecret, rt)
		if err == nil && newAccess != "" {
			os.Setenv("TWITCH_BOT_REFRESH_TOKEN", newRefresh)
			if db != nil && botLogin != "" {
				_ = SaveUserTokens(strings.ToLower(botLogin), newAccess, newRefresh)
			}
			login, _ := getLoginFromToken(newAccess)
			return "oauth:" + newAccess, login, nil
		}
		log.Println("TWITCH_BOT_REFRESH_TOKEN refresh failed:", err)
	}

	// 2. DB lookup by bot login (populated via /auth/callback)
	if db != nil && botLogin != "" {
		access, refresh, err := GetUserTokens(strings.ToLower(botLogin))
		if err == nil && access != "" {
			// Try the stored access token first
			if login, err := getLoginFromToken(access); err == nil && login != "" {
				return "oauth:" + access, login, nil
			}
			// Access token expired; try refreshing with stored refresh token
			if refresh != "" {
				newAccess, newRefresh, err := refreshUserToken(clientID, clientSecret, refresh)
				if err == nil && newAccess != "" {
					_ = SaveUserTokens(strings.ToLower(botLogin), newAccess, newRefresh)
					login, _ := getLoginFromToken(newAccess)
					return "oauth:" + newAccess, login, nil
				}
				log.Println("DB bot token refresh failed:", err)
			}
		}
	}

	return "", "", fmt.Errorf("no valid bot token source available (set TWITCH_BOT_REFRESH_TOKEN or have the bot account log in via /auth/callback)")
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
			// tokens.json missing or empty (common on cloud with ephemeral storage).
			// Fall back to the DB so the in-process token stays fresh.
			if db != nil {
				botLogin := strings.ToLower(os.Getenv("TWITCH_BOT_USERNAME"))
				if botLogin == "" {
					botLogin = "axyrabot"
				}
				if access, refresh, dbErr := GetUserTokens(botLogin); dbErr == nil && refresh != "" {
					t = tokenFile{AccessToken: access, RefreshToken: refresh, Expiry: 0}
					err = nil
				}
			}
			if err != nil || t.RefreshToken == "" {
				time.Sleep(30 * time.Second)
				continue
			}
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

		// Persist refreshed token to DB so it survives cloud redeployments where
		// tokens.json is on ephemeral storage.
		if db != nil {
			botLogin := strings.ToLower(os.Getenv("TWITCH_BOT_USERNAME"))
			if botLogin == "" {
				botLogin = "axyrabot"
			}
			if err := SaveUserTokens(botLogin, t.AccessToken, t.RefreshToken); err != nil {
				log.Println("failed to save refreshed bot token to db:", err)
			}
		}

		// sleep a short while before next check
		time.Sleep(5 * time.Second)
	}
}
