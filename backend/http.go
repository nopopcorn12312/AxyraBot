package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func startHTTPServer(clientID, clientSecret string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/start", handleAuthStart(clientID))
	mux.HandleFunc("/auth/callback", handleAuthCallback(clientID, clientSecret))
	mux.HandleFunc("/join", withCORS(handleJoin))
	mux.HandleFunc("/part", withCORS(handlePart))
	mux.HandleFunc("/channels", withCORS(handleChannels))
	mux.HandleFunc("/stream/info", withCORS(handleStreamInfo(clientID)))
	mux.HandleFunc("/stream/update", withCORS(handleStreamUpdate(clientID)))
	mux.HandleFunc("/commands/default-settings", withCORS(handleDefaultCommandSettings))
	mux.HandleFunc("/commands/custom", withCORS(handleCustomCommands))
	mux.HandleFunc("/commands/custom/update", withCORS(handleCustomCommandsUpdate))
	mux.HandleFunc("/commands/custom/delete", withCORS(handleCustomCommandsDelete))
	mux.HandleFunc("/modules/settings", withCORS(handleModuleSettings))
	mux.HandleFunc("/birthdays/list", withCORS(handleBirthdaysList))
	mux.HandleFunc("/birthdays/settings", withCORS(handleBirthdaysSettings))
	mux.HandleFunc("/audit/logs", withCORS(handleAuditLogs))
	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Println("starting HTTP server on", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Println("http server error:", err)
	}
}

// handleDefaultCommandSettings exposes per-broadcaster enable flags for
// built-in commands. GET returns the full list for a broadcaster; POST
// updates a single command flag.
func handleDefaultCommandSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		settings, err := GetDefaultCommandSettings(login)
		if err != nil {
			log.Println("failed to load default command settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Ensure every known default command is present, defaulting to enabled.
		var out []struct {
			Name    string `json:"name"`
			Enabled bool   `json:"enabled"`
		}
		for _, cmd := range defaultCommandNames {
			enabled, ok := settings[strings.ToLower(cmd)]
			if !ok {
				enabled = true
			}
			out = append(out, struct {
				Name    string `json:"name"`
				Enabled bool   `json:"enabled"`
			}{Name: cmd, Enabled: enabled})
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(struct {
			Commands interface{} `json:"commands"`
		}{Commands: out}); err != nil {
			log.Println("encode default command settings:", err)
		}
	case http.MethodPost:
		var body struct {
			Login   string `json:"login"`
			Command string `json:"command"`
			Enabled bool   `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		cmd := strings.TrimSpace(body.Command)
		if login == "" || cmd == "" {
			http.Error(w, "missing login or command", http.StatusBadRequest)
			return
		}
		if err := SetDefaultCommandEnabled(login, cmd, body.Enabled); err != nil {
			log.Println("failed to save default command setting:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Audit the default command toggle.
		state := "disabled"
		if body.Enabled {
			state = "enabled"
		}
		if err := InsertAuditLog(login, "bot", "default_command", fmt.Sprintf("Set %s %s", cmd, state)); err != nil {
			log.Println("failed to insert audit log for default command:", err)
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleCustomCommands manages custom commands for a broadcaster.
// GET returns the list of commands; POST updates the enabled flag for a
// single command. It is used by the dashboard commands page when the
// "Custom commands" tab is selected.
func handleCustomCommands(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		cmds, err := ListCustomCommands(login)
		if err != nil {
			log.Println("failed to list custom commands:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		out := []struct {
			Name      string `json:"name"`
			Response  string `json:"response"`
			CreatedBy string `json:"createdBy"`
			Enabled   bool   `json:"enabled"`
			Role      string `json:"role"`
		}{}
		for _, c := range cmds {
			out = append(out, struct {
				Name      string `json:"name"`
				Response  string `json:"response"`
				CreatedBy string `json:"createdBy"`
				Enabled   bool   `json:"enabled"`
				Role      string `json:"role"`
			}{
				Name:      c.Command,
				Response:  c.Response,
				CreatedBy: c.CreatedBy,
				Enabled:   c.Enabled,
				Role:      c.Role,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(struct {
			Commands interface{} `json:"commands"`
		}{Commands: out}); err != nil {
			log.Println("encode custom commands:", err)
		}
	case http.MethodPost:
		var body struct {
			Login   string `json:"login"`
			Command string `json:"command"`
			Enabled bool   `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		cmd := strings.TrimSpace(body.Command)
		if login == "" || cmd == "" {
			http.Error(w, "missing login or command", http.StatusBadRequest)
			return
		}
		if err := SetCustomCommandEnabled(login, cmd, body.Enabled); err != nil {
			log.Println("failed to save custom command setting:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Audit the custom command toggle.
		state := "disabled"
		if body.Enabled {
			state = "enabled"
		}
		if err := InsertAuditLog(login, "bot", "custom_command", fmt.Sprintf("Set custom command %s %s", cmd, state)); err != nil {
			log.Println("failed to insert audit log for custom command toggle:", err)
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleCustomCommandsUpdate updates the name, response text, and role for a
// single custom command. It is intended for use by the broadcaster from the
// dashboard UI.
func handleCustomCommandsUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login           string `json:"login"`
		OriginalCommand string `json:"originalCommand"`
		Command         string `json:"command"`
		Response        string `json:"response"`
		Role            string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	orig := strings.TrimSpace(body.OriginalCommand)
	cmd := strings.TrimSpace(body.Command)
	resp := strings.TrimSpace(body.Response)
	role := strings.TrimSpace(body.Role)
	if login == "" || orig == "" || cmd == "" {
		http.Error(w, "missing login, originalCommand, or command", http.StatusBadRequest)
		return
	}
	if err := UpdateCustomCommand(login, orig, cmd, resp, role); err != nil {
		log.Println("failed to update custom command:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	// Audit the custom command update.
	desc := fmt.Sprintf("Updated custom command %s (role=%s)", cmd, role)
	if err := InsertAuditLog(login, "bot", "custom_command_update", desc); err != nil {
		log.Println("failed to insert audit log for custom command update:", err)
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

// handleCustomCommandsDelete deletes a single custom command for a
// broadcaster. It is intended to be called from the dashboard when the
// broadcaster confirms deletion in the UI.
func handleCustomCommandsDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login   string `json:"login"`
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	cmd := strings.TrimSpace(body.Command)
	if login == "" || cmd == "" {
		http.Error(w, "missing login or command", http.StatusBadRequest)
		return
	}
	if err := DeleteCustomCommand(login, cmd); err != nil {
		log.Println("failed to delete custom command from HTTP:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if err := InsertAuditLog(login, "bot", "custom_command_delete", fmt.Sprintf("Deleted custom command %s", cmd)); err != nil {
		log.Println("failed to insert audit log for custom command delete:", err)
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

// handleModuleSettings exposes per-broadcaster enable flags for optional
// modules like the "go live" chat announcement. GET returns the full list
// for a broadcaster; POST updates a single module flag.
func handleModuleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		// For now we have a single module, but structure the response so we
		// can add more later.
		modules := []struct {
			Name        string `json:"name"`
			Label       string `json:"label"`
			Description string `json:"description"`
			Enabled     bool   `json:"enabled"`
			Message     string `json:"message"`
		}{}
		// Live announcement when the broadcaster goes live
		enabled, err := GetModuleEnabled(login, "live_announcement")
		if err != nil {
			log.Println("failed to load module setting:", err)
			// treat as enabled on error
			enabled = true
		}
		msgTmpl := defaultLiveAnnouncementTemplate
		if msg, err := GetModuleMessage(login, "live_announcement"); err != nil {
			log.Println("failed to load live_announcement template in HTTP handler:", err)
		} else if strings.TrimSpace(msg) != "" {
			msgTmpl = msg
		}
		modules = append(modules, struct {
			Name        string `json:"name"`
			Label       string `json:"label"`
			Description string `json:"description"`
			Enabled     bool   `json:"enabled"`
			Message     string `json:"message"`
		}{
			Name:        "live_announcement",
			Label:       "Go live announcement",
			Description: "Send a chat message when your stream goes live.",
			Enabled:     enabled,
			Message:     msgTmpl,
		})

		// Birthdays module controlling all birthday-related chat commands.
		bdayEnabled, err := GetModuleEnabled(login, "birthdays")
		if err != nil {
			log.Println("failed to load birthdays module setting:", err)
			// treat as enabled on error
			bdayEnabled = true
		}
		modules = append(modules, struct {
			Name        string `json:"name"`
			Label       string `json:"label"`
			Description string `json:"description"`
			Enabled     bool   `json:"enabled"`
			Message     string `json:"message"`
		}{
			Name:        "birthdays",
			Label:       "Birthdays",
			Description: "Enable birthday chat commands like !birthday and !nextbday.",
			Enabled:     bdayEnabled,
			Message:     "",
		})
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(struct {
			Modules interface{} `json:"modules"`
		}{Modules: modules}); err != nil {
			log.Println("encode module settings:", err)
		}
	case http.MethodPost:
		var body struct {
			Login          string `json:"login"`
			Module         string `json:"module"`
			Enabled        bool   `json:"enabled"`
			Message        string `json:"message"`
			ResetToDefault bool   `json:"resetToDefault"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		module := strings.TrimSpace(body.Module)
		if login == "" || module == "" {
			http.Error(w, "missing login or module", http.StatusBadRequest)
			return
		}
		if err := SetModuleEnabled(login, module, body.Enabled); err != nil {
			log.Println("failed to save module setting:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// If the caller requested restoring the default template, clear any
		// stored custom message so the backend falls back to its default.
		if body.ResetToDefault {
			if err := SetModuleMessage(login, module, ""); err != nil {
				log.Println("failed to reset module message to default:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
		} else {
			// If a non-empty message was provided, update the module's message
			// template as well. The UI that only toggles enabled will omit this
			// field so existing messages are preserved.
			if strings.TrimSpace(body.Message) != "" {
				if err := SetModuleMessage(login, module, body.Message); err != nil {
					log.Println("failed to save module message:", err)
					http.Error(w, "db error", http.StatusInternalServerError)
					return
				}
			}
		}
		// Audit the module configuration change.
		status := "disabled"
		if body.Enabled {
			status = "enabled"
		}
		action := "updated"
		if body.ResetToDefault {
			action = "reset to default"
		}
		desc := fmt.Sprintf("Module %s %s (status=%s)", module, action, status)
		if strings.TrimSpace(body.Message) != "" && !body.ResetToDefault {
			desc += " with custom message"
		}
		if err := InsertAuditLog(login, "bot", "module_settings", desc); err != nil {
			log.Println("failed to insert audit log for module settings:", err)
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// withCORS wraps an HTTP handler and adds CORS headers so that the frontend
// hosted on a different origin (e.g. Vercel) can call the Render backend.
// If FRONTEND_ORIGIN is set, only that origin is allowed; otherwise any
// origin is permitted.
func withCORS(h http.HandlerFunc) http.HandlerFunc {
	allowedOrigin := os.Getenv("FRONTEND_ORIGIN")
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if allowedOrigin == "" || origin == allowedOrigin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
}

func handleAuthStart(clientID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		redirect := r.URL.Query().Get("redirect")
		state := "state123" // TODO: generate/validate and include CSRF protection
		// If the frontend provided a redirect target, encode it into the state
		// parameter so it survives the Twitch OAuth roundtrip and can be used in
		// the callback handler.
		if redirect != "" {
			state = "redir:" + url.QueryEscape(redirect)
		}
		// Broadcaster authorization scopes. This is intentionally expansive so
		// that when a broadcaster authorizes the app, the token can manage and
		// read most aspects of their channel. Bot/chat identity scopes are
		// deliberately excluded here; those are handled by the separate bot
		// token you generated earlier.
		scopes := strings.Join([]string{
			// Channel / stream management
			"channel:manage:ads",
			"channel:manage:broadcast",
			"channel:manage:extensions",
			"channel:manage:moderators",
			"channel:manage:polls",
			"channel:manage:predictions",
			"channel:manage:raids",
			"channel:manage:redemptions",
			"channel:manage:videos",
			"channel:manage:vips",

			// Channel read / analytics
			"channel:read:ads",
			"channel:read:charity",
			"channel:read:editors",
			"channel:read:goals",
			"channel:read:hype_train",
			"channel:read:polls",
			"channel:read:predictions",
			"channel:read:redemptions",
			"channel:read:subscriptions",
			"channel:read:vips",
			"analytics:read:extensions",
			"analytics:read:games",
			"bits:read",
			"channel:moderate",

			// Moderation / VIP / warnings
			"moderation:read",
			"moderator:manage:announcements",
			"moderator:manage:automod",
			"moderator:manage:automod_settings",
			"moderator:manage:banned_users",
			"moderator:manage:blocked_terms",
			"moderator:manage:chat_messages",
			"moderator:manage:chat_settings",
			"moderator:manage:shield_mode",
			"moderator:manage:shoutouts",
			"moderator:manage:unban_requests",
			"moderator:manage:warnings",
			"moderator:read:blocked_terms",
			"moderator:read:chat_settings",
			"moderator:read:followers",
			"moderator:read:automod_settings",
			"moderator:read:shield_mode",
			"moderator:read:unban_requests",
			"moderator:read:suspicious_users",
			"moderator:read:warnings",
			"moderator:read:moderators",
			"moderator:read:vips",
			"moderator:read:banned_users",
			"moderator:read:chat_messages",

			// Channel points / polls / predictions / goals / charity
			"channel:read:redemptions",
			"channel:manage:redemptions",
			"channel:read:polls",
			"channel:manage:polls",
			"channel:read:predictions",
			"channel:manage:predictions",
			"channel:read:goals",
			"channel:read:charity",

			// User/account-level (broadcaster account)
			"user:read:broadcast",
			"user:read:email",
			"user:read:follows",
		}, " ")
		u := url.URL{
			Scheme: "https",
			Host:   "id.twitch.tv",
			Path:   "/oauth2/authorize",
		}
		q := u.Query()
		q.Set("client_id", clientID)
		q.Set("redirect_uri", getRedirectURI(r))
		q.Set("response_type", "code")
		q.Set("scope", scopes)
		q.Set("state", state)
		if redirect != "" {
			q.Set("redirect", redirect)
		}
		u.RawQuery = q.Encode()
		http.Redirect(w, r, u.String(), http.StatusFound)
	}
}

func handleAuthCallback(clientID, clientSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			return
		}
		state := r.URL.Query().Get("state")
		// exchange code for token
		v := url.Values{}
		v.Set("client_id", clientID)
		v.Set("client_secret", clientSecret)
		v.Set("code", code)
		v.Set("grant_type", "authorization_code")
		v.Set("redirect_uri", getRedirectURI(r))
		resp, err := http.PostForm("https://id.twitch.tv/oauth2/token", v)
		if err != nil {
			log.Println("token exchange failed:", err)
			http.Error(w, "token exchange failed", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		var t map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&t); err != nil {
			log.Println("decode token response:", err)
			http.Error(w, "invalid token response", http.StatusInternalServerError)
			return
		}
		// store tokens and user info minimal: derive login using /oauth2/validate
		access, _ := t["access_token"].(string)
		refresh, _ := t["refresh_token"].(string)
		login, err := getLoginFromToken(access)
		if err != nil || login == "" {
			log.Println("failed to validate user token:", err)
			http.Error(w, "failed get user info", http.StatusInternalServerError)
			return
		}
		// Optionally fetch the user's Twitch profile image so the frontend can show
		// it when the user is logged in.
		avatarURL, _ := getUserProfileImage(access, clientID)

		// store in DB: save user tokens only. Joining the channel is controlled
		// explicitly from the dashboard "Join channel" button.
		if db != nil {
			if err := SaveUserTokens(login, access, refresh); err != nil {
				log.Println("failed save user tokens:", err)
			}
		}

		// If a redirect URL was provided via the state parameter, send the user
		// back to the frontend with the login (and avatar, when available)
		// attached as query parameters.
		if strings.HasPrefix(state, "redir:") {
			if raw, err := url.QueryUnescape(strings.TrimPrefix(state, "redir:")); err == nil {
				if dest, err := url.Parse(raw); err == nil {
					q := dest.Query()
					q.Set("login", login)
					if avatarURL != "" {
						q.Set("avatar", avatarURL)
					}
					dest.RawQuery = q.Encode()
					http.Redirect(w, r, dest.String(), http.StatusFound)
					return
				}
			}
		}

		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "success: %s", login)
	}
}

func handleJoin(w http.ResponseWriter, r *http.Request) {
	// expects JSON {"login":"channel"}
	var body struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.Login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	if db != nil {
		// Use the original AddOrUpdateChannel helper so the row appears
		// in the channels table and is marked joined=true.
		if err := AddOrUpdateChannel(body.Login, body.Login); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Immediately refresh active channels and EventSub subscriptions so the
		// bot joins this channel without requiring a redeploy or waiting for the
		// Postgres LISTEN/NOTIFY loop.
		handleChannelsChanged(body.Login)
		// Record in the audit log that the bot joined this channel.
		if err := InsertAuditLog(body.Login, "bot", "channel_join", "Bot joined the channel"); err != nil {
			log.Println("failed to insert audit log for join:", err)
		}
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

// handlePart marks a channel as parted (joined=false) so the bot leaves the
// chat for that channel.
func handlePart(w http.ResponseWriter, r *http.Request) {
	// expects JSON {"login":"channel"}
	var body struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.Login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	if db != nil {
		if err := SetChannelJoined(body.Login, false); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}
	if err := InsertAuditLog(body.Login, "bot", "channel_part", "Bot left the channel"); err != nil {
		log.Println("failed to insert audit log for part:", err)
	}
	// active channel bookkeeping for EventSub-based chat handling
	unmarkActiveChannel(body.Login)
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

func handleChannels(w http.ResponseWriter, r *http.Request) {
	chans := []string{}
	if db != nil {
		if cs, err := GetJoinedChannels(); err == nil {
			chans = cs
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"channels": chans})
}

// handleStreamInfo returns the current stream title and category for a
// broadcaster, using the stored user access token.
func handleStreamInfo(clientID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		login := r.URL.Query().Get("login")
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		userID, access, err := ensureValidUserToken(login)
		if err != nil {
			log.Println("ensureValidUserToken failed:", err)
			http.Error(w, "validate token failed", http.StatusInternalServerError)
			return
		}
		req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/channels?broadcaster_id="+url.QueryEscape(userID), nil)
		if err != nil {
			http.Error(w, "request build failed", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Client-ID", clientID)
		req.Header.Set("Authorization", "Bearer "+access)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Println("helix channels get failed:", err)
			http.Error(w, "helix error", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode/100 != 2 {
			log.Println("helix channels status:", resp.Status)
			http.Error(w, "helix error", http.StatusBadGateway)
			return
		}
		var data struct {
			Data []struct {
				Title    string `json:"title"`
				GameName string `json:"game_name"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
			log.Println("decode channels response:", err)
			http.Error(w, "decode error", http.StatusInternalServerError)
			return
		}
		out := map[string]string{"title": "", "category": ""}
		if len(data.Data) > 0 {
			out["title"] = data.Data[0].Title
			out["category"] = data.Data[0].GameName
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}
}

// handleStreamUpdate updates a channel's stream title and category using the
// broadcaster's stored user access token.
func handleStreamUpdate(clientID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Login    string `json:"login"`
			Title    string `json:"title"`
			Category string `json:"category"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if body.Login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		userID, access, err := ensureValidUserToken(body.Login)
		if err != nil {
			log.Println("ensureValidUserToken failed:", err)
			http.Error(w, "validate token failed", http.StatusInternalServerError)
			return
		}

		payload := map[string]string{}
		if strings.TrimSpace(body.Title) != "" {
			payload["title"] = body.Title
		}
		// Resolve category name to game_id if provided.
		if strings.TrimSpace(body.Category) != "" {
			req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/games?name="+url.QueryEscape(body.Category), nil)
			if err == nil {
				req.Header.Set("Client-ID", clientID)
				req.Header.Set("Authorization", "Bearer "+access)
				resp, err := http.DefaultClient.Do(req)
				if err == nil {
					defer resp.Body.Close()
					if resp.StatusCode/100 == 2 {
						var g struct {
							Data []struct {
								ID string `json:"id"`
							} `json:"data"`
						}
						if err := json.NewDecoder(resp.Body).Decode(&g); err == nil {
							if len(g.Data) > 0 {
								payload["game_id"] = g.Data[0].ID
							}
						}
					}
				}
			}
		}

		if len(payload) == 0 {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		buf, _ := json.Marshal(payload)
		req, err := http.NewRequest("PATCH", "https://api.twitch.tv/helix/channels?broadcaster_id="+url.QueryEscape(userID), bytes.NewReader(buf))
		if err != nil {
			http.Error(w, "request build failed", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Client-ID", clientID)
		req.Header.Set("Authorization", "Bearer "+access)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Println("helix channels patch failed:", err)
			http.Error(w, "helix error", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode/100 != 2 {
			log.Println("helix channels patch status:", resp.Status)
			http.Error(w, "helix error", http.StatusBadGateway)
			return
		}
		// Audit the stream update request.
		desc := fmt.Sprintf("Updated stream settings: title=%q, category=%q", body.Title, body.Category)
		if err := InsertAuditLog(body.Login, "bot", "stream_update", desc); err != nil {
			log.Println("failed to insert audit log for stream update:", err)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// handleAuditLogs returns the most recent audit log entries for a given
// broadcaster so the dashboard can display a recent activity feed.
func handleAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	limit := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	logs, err := GetRecentAuditLogs(login, limit)
	if err != nil {
		log.Println("failed to load audit logs:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	out := []struct {
		Source      string    `json:"source"`
		Category    string    `json:"category"`
		Description string    `json:"description"`
		Timestamp   time.Time `json:"timestamp"`
	}{}
	for _, e := range logs {
		out = append(out, struct {
			Source      string    `json:"source"`
			Category    string    `json:"category"`
			Description string    `json:"description"`
			Timestamp   time.Time `json:"timestamp"`
		}{
			Source:      e.Source,
			Category:    e.Category,
			Description: e.Description,
			Timestamp:   e.CreatedAt,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(struct {
		Logs interface{} `json:"logs"`
	}{Logs: out}); err != nil {
		log.Println("encode audit logs:", err)
	}
}

// handleBirthdaysList returns all stored birthdays for a broadcaster so the
// dashboard vanity page can display and manage them.
func handleBirthdaysList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	birthdays, err := ListBirthdays(login)
	if err != nil {
		log.Println("failed to list birthdays:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	out := []struct {
		UserLogin   string `json:"userLogin"`
		DisplayName string `json:"displayName"`
		Month       int    `json:"month"`
		Day         int    `json:"day"`
	}{}
	for _, b := range birthdays {
		out = append(out, struct {
			UserLogin   string `json:"userLogin"`
			DisplayName string `json:"displayName"`
			Month       int    `json:"month"`
			Day         int    `json:"day"`
		}{
			UserLogin:   b.UserLogin,
			DisplayName: b.DisplayName,
			Month:       b.Month,
			Day:         b.Day,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(struct {
		Birthdays interface{} `json:"birthdays"`
	}{Birthdays: out}); err != nil {
		log.Println("encode birthdays list:", err)
	}
}

// handleBirthdaysSettings exposes birthday-related settings for a
// broadcaster, currently just the timezone used for computing "today" and
// "next" birthdays.
func handleBirthdaysSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		tz, err := GetBroadcasterTimezone(login)
		if err != nil {
			log.Println("failed to load broadcaster timezone:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(struct {
			Timezone string `json:"timezone"`
		}{Timezone: tz}); err != nil {
			log.Println("encode birthday settings:", err)
		}
	case http.MethodPost:
		var body struct {
			Login    string `json:"login"`
			Timezone string `json:"timezone"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		tzName := strings.TrimSpace(body.Timezone)
		if login == "" || tzName == "" {
			http.Error(w, "missing login or timezone", http.StatusBadRequest)
			return
		}
		// Validate that the timezone is a known IANA name before storing it.
		if _, err := time.LoadLocation(tzName); err != nil {
			http.Error(w, "invalid timezone", http.StatusBadRequest)
			return
		}
		if err := SetBroadcasterTimezone(login, tzName); err != nil {
			log.Println("failed to save broadcaster timezone:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Audit the timezone change for visibility on the activity feed.
		if err := InsertAuditLog(login, "bot", "birthday_settings", fmt.Sprintf("Set birthday timezone to %s", tzName)); err != nil {
			log.Println("failed to insert audit log for birthday settings:", err)
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func getRedirectURI(r *http.Request) string {
	// prefer env TWITCH_OAUTH_REDIRECT
	if u := os.Getenv("TWITCH_OAUTH_REDIRECT"); u != "" {
		return u
	}
	// build from request
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}
	return scheme + "://" + r.Host + "/auth/callback"
}

// ensureValidUserToken makes sure the stored user token for a login is valid
// for Helix calls. If validation fails, it attempts to refresh the token
// using the stored refresh_token and updates the database on success.
func ensureValidUserToken(login string) (string, string, error) {
	login = strings.ToLower(strings.TrimSpace(login))
	if login == "" {
		return "", "", fmt.Errorf("missing login")
	}
	access, refresh, err := GetUserTokens(login)
	if err != nil || access == "" {
		if err == nil {
			return "", "", fmt.Errorf("no user token")
		}
		return "", "", err
	}
	userID, err := getUserIDFromToken(access)
	if err == nil && userID != "" {
		return userID, access, nil
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" || refresh == "" {
		return "", "", fmt.Errorf("cannot refresh token; missing client credentials or refresh token")
	}

	v := url.Values{}
	v.Set("client_id", clientID)
	v.Set("client_secret", clientSecret)
	v.Set("grant_type", "refresh_token")
	v.Set("refresh_token", refresh)
	resp, err := http.PostForm("https://id.twitch.tv/oauth2/token", v)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", "", fmt.Errorf("refresh failed: %s", resp.Status)
	}
	var tr struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return "", "", err
	}
	if tr.AccessToken == "" {
		return "", "", fmt.Errorf("refresh response missing access_token")
	}
	if err := SaveUserTokens(login, tr.AccessToken, tr.RefreshToken); err != nil {
		log.Println("failed to save refreshed user tokens:", err)
	}
	userID, err = getUserIDFromToken(tr.AccessToken)
	if err != nil || userID == "" {
		if err == nil {
			return "", "", fmt.Errorf("validate after refresh returned empty user id")
		}
		return "", "", err
	}
	return userID, tr.AccessToken, nil
}
