package main

import (
	"bytes"
	"encoding/json"
	"fmt"
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
)

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
		if err := listEventSubSubscriptions(token, clientID); err != nil {
			log.Println("failed listing subscriptions:", err)
		}

		// attempt to register EventSub subscriptions for the configured channel
		go registerEventSubSubscriptions(token, clientID, channel, tokensPath)
	}

	// Start IRC WebSocket bot (reads channels from DB if present)
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
			// try to decode and capture session id from session_welcome
			var m map[string]interface{}
			if err := json.Unmarshal(message, &m); err == nil {
				if metadata, ok := m["metadata"].(map[string]interface{}); ok {
					if mt, ok := metadata["message_type"].(string); ok && mt == "session_welcome" {
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
					}
				}
			}
			log.Printf("[EventSub WS] %s\n", string(message))
		}

		// reconnect
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

// sendChat sends a visible chat message as a PRIVMSG and logs the outgoing line
func sendChat(c *websocket.Conn, channel, msg string) {
	line := fmt.Sprintf("PRIVMSG #%s :%s", channel, msg)
	log.Printf("[SENT] %s\n", line)
	writeIRC(c, line)
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

// createEventSubSubscription creates a single EventSub subscription using websocket transport
func createEventSubSubscription(authToken, clientID, subType string, condition map[string]string, sessionID string, transportMethod string, callbackURL string, secret string) error {
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
		"version":   "1",
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

// registerEventSubSubscriptions waits for an EventSub session and registers subscriptions for the given channel login
func registerEventSubSubscriptions(appToken, clientID, channel, tokensPath string) {
	// Allow disabling EventSub registration entirely via env to avoid
	// errors like "invalid transport and auth combination" when not
	// fully configured.
	if os.Getenv("TWITCH_EVENTSUB_ENABLED") != "1" {
		log.Println("EventSub registration disabled; set TWITCH_EVENTSUB_ENABLED=1 to enable")
		return
	}

	// wait for session id to be set
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		eventSubMu.Lock()
		sid := eventSubSessionID
		eventSubMu.Unlock()
		if sid != "" {
			// resolve broadcaster id for channel
			broadcasterID, err := getUserID(channel, appToken, clientID)
			if err != nil {
				log.Println("failed to resolve broadcaster id:", err)
				return
			}

			// list of subscription types that require broadcaster_user_id
			// Note: some legacy types (e.g. channel.follow via websocket) are no longer
			// available and will return 410 Gone. We avoid requesting those here.
			subs := []string{
				"stream.online",
				"stream.offline",
				"channel.update",
			}

			// get webhook callback and secret from env (if provided)
			callback := os.Getenv("TWITCH_EVENTSUB_CALLBACK")
			secret := os.Getenv("TWITCH_EVENTSUB_SECRET")

			// channel.subscribe is only valid with certain transports; prefer webhook
			// when a callback is configured, and avoid attempting it over websocket
			// without a callback to prevent "invalid transport and auth combination".
			if callback != "" {
				subs = append(subs, "channel.subscribe")
			}

			// choose broadcaster token for EventSub if provided explicitly; this must
			// be a user access token for the broadcaster account with the proper
			// EventSub scopes (e.g. channel:read:subscriptions for subscription events).
			broadToken := ""
			if bt := os.Getenv("TWITCH_EVENTSUB_BROADCASTER_TOKEN"); bt != "" {
				broadToken = strings.TrimPrefix(bt, "oauth:")
			} else if t, err := loadTokens(tokensPath); err == nil && t.AccessToken != "" {
				// fallback to tokens.json if present (typically local/dev)
				broadToken = t.AccessToken
			}

			for _, st := range subs {
				cond := map[string]string{"broadcaster_user_id": broadcasterID}
				// choose auth: use broadcaster token if available for broadcaster-related events, otherwise app token
				auth := appToken
				if broadToken != "" {
					auth = broadToken
				}

				// For channel.subscribe, prefer webhook transport if callback provided
				if st == "channel.subscribe" && callback != "" {
					if err := createEventSubSubscription(auth, clientID, st, cond, "", "webhook", callback, secret); err != nil {
						log.Println("failed creating webhook subscription", st, err)
					}
				} else {
					// websocket transport for other events (requires session id)
					if err := createEventSubSubscription(auth, clientID, st, cond, sid, "websocket", "", ""); err != nil {
						log.Println("failed creating subscription", st, err)
					}
				}

				// avoid hitting rate limits too quickly
				time.Sleep(500 * time.Millisecond)
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
