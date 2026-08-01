package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Giveaway in-memory state
// ---------------------------------------------------------------------------

type GiveawayEntry struct {
	Login        string    `json:"login"`
	DisplayName  string    `json:"displayName"`
	IsSubscriber bool      `json:"isSubscriber"`
	IsVIP        bool      `json:"isVip"`
	IsMod        bool      `json:"isMod"`
	EnteredAt    time.Time `json:"enteredAt"`
	LastSeen     time.Time `json:"-"`
}

type GiveawayState struct {
	mu            sync.Mutex
	Active        bool                      `json:"active"`
	Type          string                    `json:"type"` // "active" or "keyword"
	Keyword       string                    `json:"keyword"`
	InactivitySec int                       `json:"inactivitySec"`
	SubMultiplier int                       `json:"subMultiplier"`
	ChatAnnounce  bool                      `json:"chatAnnounce"`
	StartedAt     time.Time                 `json:"startedAt"`
	Entries       map[string]*GiveawayEntry `json:"entries"`
	Winner        *GiveawayEntry            `json:"winner"`
}

var (
	giveaways   = map[string]*GiveawayState{}
	giveawaysMu sync.RWMutex
)

func getOrCreateGiveaway(login string) *GiveawayState {
	giveawaysMu.Lock()
	defer giveawaysMu.Unlock()
	if g, ok := giveaways[login]; ok {
		return g
	}
	g := &GiveawayState{
		Type:          "active",
		SubMultiplier: 1,
		ChatAnnounce:  true,
		Entries:       map[string]*GiveawayEntry{},
	}
	giveaways[login] = g
	return g
}

// RecordGiveawayEntry is called from the chat message handler to add a chatter
// to the active giveaway for their channel, if any.
func RecordGiveawayEntry(channelLogin, chatterLogin, displayName string, isSubscriber, isVIP, isMod bool) {
	channelLogin = strings.ToLower(strings.TrimSpace(channelLogin))
	giveawaysMu.RLock()
	g, ok := giveaways[channelLogin]
	giveawaysMu.RUnlock()
	if !ok {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if !g.Active {
		return
	}
	if g.Type == "keyword" {
		// keyword matching is handled at call site after checking message text
		return
	}
	// Active-users mode: record/refresh the entry
	chatterLogin = strings.ToLower(chatterLogin)
	if e, exists := g.Entries[chatterLogin]; exists {
		e.LastSeen = time.Now()
		e.IsSubscriber = isSubscriber
		e.IsVIP = isVIP
		e.IsMod = isMod
	} else {
		g.Entries[chatterLogin] = &GiveawayEntry{
			Login:        chatterLogin,
			DisplayName:  displayName,
			IsSubscriber: isSubscriber,
			IsVIP:        isVIP,
			IsMod:        isMod,
			EnteredAt:    time.Now(),
		}
	}
}

// RecordGiveawayKeyword is called for every message; records entry only if
// the giveaway is active in keyword mode and the message matches the keyword.
func RecordGiveawayKeyword(channelLogin, chatterLogin, displayName, msgText string, isSubscriber, isVIP, isMod bool) {
	channelLogin = strings.ToLower(strings.TrimSpace(channelLogin))
	giveawaysMu.RLock()
	g, ok := giveaways[channelLogin]
	giveawaysMu.RUnlock()
	if !ok {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if !g.Active || g.Type != "keyword" || g.Keyword == "" {
		return
	}
	// Exact case-sensitive match: message must equal keyword exactly
	if strings.TrimSpace(msgText) != g.Keyword {
		return
	}
	chatterLogin = strings.ToLower(chatterLogin)
	if _, exists := g.Entries[chatterLogin]; !exists {
		g.Entries[chatterLogin] = &GiveawayEntry{
			Login:        chatterLogin,
			DisplayName:  displayName,
			IsSubscriber: isSubscriber,
			IsVIP:        isVIP,
			IsMod:        isMod,
			EnteredAt:    time.Now(),
		}
	}
}

// GiveawayEntry needs a LastSeen field used internally.

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
	mux.HandleFunc("/commands/custom/add", withCORS(handleCustomCommandsAdd))
	mux.HandleFunc("/commands/custom/update", withCORS(handleCustomCommandsUpdate))
	mux.HandleFunc("/commands/custom/delete", withCORS(handleCustomCommandsDelete))
	mux.HandleFunc("/commands/import", withCORS(handleCustomCommandsImport))
	mux.HandleFunc("/moderation/blocked-terms", withCORS(handleBlockedTerms))
	mux.HandleFunc("/moderation/blocked-terms/delete", withCORS(handleBlockedTermsDelete))
	mux.HandleFunc("/moderation/spam-filters", withCORS(handleSpamFilters))
	mux.HandleFunc("/moderation/spam-filters/delete", withCORS(handleSpamFiltersDelete))
	mux.HandleFunc("/roles", withCORS(handleRoles))
	mux.HandleFunc("/roles/delete", withCORS(handleRolesDelete))
	mux.HandleFunc("/roles/editor-channels", withCORS(handleEditorChannels))
	mux.HandleFunc("/user/avatar", withCORS(handleUserAvatar(clientID, clientSecret)))
	mux.HandleFunc("/modules/settings", withCORS(handleModuleSettings))
	mux.HandleFunc("/birthdays/list", withCORS(handleBirthdaysList))
	mux.HandleFunc("/birthdays/add", withCORS(handleBirthdaysAdd))
	mux.HandleFunc("/birthdays/delete", withCORS(handleBirthdaysDelete))
	mux.HandleFunc("/birthdays/settings", withCORS(handleBirthdaysSettings))
	mux.HandleFunc("/birthdays/command-messages", withCORS(handleBirthdayCommandMessages))
	mux.HandleFunc("/discord/settings", withCORS(handleDiscordSettings))
	mux.HandleFunc("/discord/guilds", withCORS(handleDiscordGuilds))
	mux.HandleFunc("/discord/channels", withCORS(handleDiscordChannels))
	mux.HandleFunc("/discord/roles", withCORS(handleDiscordRoles))
	mux.HandleFunc("/discord/role-mappings", withCORS(handleDiscordRoleMappings))
	mux.HandleFunc("/discord/notification-templates", withCORS(handleDiscordNotificationTemplates))
	mux.HandleFunc("/discord/guild-modules", withCORS(handleDiscordGuildModules))
	mux.HandleFunc("/discord/command-settings", withCORS(handleDiscordCommandSettings))
	mux.HandleFunc("/discord/guild-managers", withCORS(handleDiscordGuildManagers))
	mux.HandleFunc("/discord/tickets/config", withCORS(handleDiscordTicketConfig))
	mux.HandleFunc("/discord/tickets/send-panel", withCORS(handleDiscordSendTicketPanel))
	mux.HandleFunc("/discord/reaction-roles", withCORS(handleDiscordReactionRoles))
	mux.HandleFunc("/discord/reaction-roles/send", withCORS(handleDiscordReactionRolesSend))
	mux.HandleFunc("/discord/welcome-settings", withCORS(handleDiscordWelcomeSettings))

	// Optional Nightbot OAuth integration for importing commands without
	// copy/paste. These handlers are only registered when all required
	// environment variables are present.
	nbClientID := strings.TrimSpace(os.Getenv("NIGHTBOT_CLIENT_ID"))
	nbClientSecret := strings.TrimSpace(os.Getenv("NIGHTBOT_CLIENT_SECRET"))
	nbRedirectURL := strings.TrimSpace(os.Getenv("NIGHTBOT_REDIRECT_URL"))
	if nbClientID != "" && nbClientSecret != "" && nbRedirectURL != "" {
		mux.HandleFunc("/nightbot/auth/start", handleNightbotAuthStart(nbClientID, nbRedirectURL))
		mux.HandleFunc("/nightbot/auth/callback", handleNightbotAuthCallback(nbClientID, nbClientSecret, nbRedirectURL))
	} else {
		log.Println("Nightbot OAuth not configured; set NIGHTBOT_CLIENT_ID, NIGHTBOT_CLIENT_SECRET, and NIGHTBOT_REDIRECT_URL to enable Nightbot import")
	}

	mux.HandleFunc("/audit/logs", withCORS(handleAuditLogs))
	mux.HandleFunc("/chat/stats", withCORS(handleChatStats))
	mux.HandleFunc("/categories/search", withCORS(handleCategorySearch(clientID)))
	mux.HandleFunc("/giveaway/state", withCORS(handleGiveawayState))
	mux.HandleFunc("/giveaway/start", withCORS(handleGiveawayStart))
	mux.HandleFunc("/giveaway/stop", withCORS(handleGiveawayStop))
	mux.HandleFunc("/giveaway/pick-winner", withCORS(handleGiveawayPickWinner))
	mux.HandleFunc("/giveaway/clear", withCORS(handleGiveawayClear))
	mux.HandleFunc("/giveaway/remove-entry", withCORS(handleGiveawayRemoveEntry))
	mux.HandleFunc("/eventsub/callback", handleEventSubWebhook)
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

		// If the broadcaster toggles the !birthday command, keep the
		// birthdays module in sync. Disabling !birthday disables the
		// birthdays module; enabling it turns the module back on and
		// ensures all birthday-related commands default to enabled.
		if strings.EqualFold(cmd, "!birthday") {
			if err := SetModuleEnabled(login, "birthdays", body.Enabled); err != nil {
				log.Println("failed to sync birthdays module from !birthday toggle:", err)
			} else if body.Enabled {
				for _, bcmd := range birthdayCommandNames {
					if err := SetDefaultCommandEnabled(login, bcmd, true); err != nil {
						log.Println("failed to enable birthday default command from !birthday toggle:", bcmd, err)
					}
				}
			}
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

// handleCustomCommandsImport bulk-imports custom commands for a broadcaster
// from another bot. The caller is expected to have already parsed the
// provider-specific format into a simple list of name/response pairs.
func handleCustomCommandsImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login    string `json:"login"`
		Provider string `json:"provider"`
		Commands []struct {
			Name     string `json:"name"`
			Response string `json:"response"`
		} `json:"commands"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	provider := strings.TrimSpace(body.Provider)
	if provider == "" {
		provider = "other"
	}
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	if len(body.Commands) == 0 {
		http.Error(w, "no commands provided", http.StatusBadRequest)
		return
	}

	imported := 0
	for _, c := range body.Commands {
		name := strings.TrimSpace(c.Name)
		resp := strings.TrimSpace(c.Response)
		if name == "" || resp == "" {
			continue
		}
		if !strings.HasPrefix(name, "!") {
			name = "!" + name
		}
		if err := UpsertCustomCommand(login, "import:"+strings.ToLower(provider), name, resp, "all"); err != nil {
			log.Println("failed to import custom command:", name, err)
			continue
		}
		imported++
	}

	if imported == 0 {
		http.Error(w, "no commands imported", http.StatusBadRequest)
		return
	}

	if err := InsertAuditLog(login, "bot", "custom_command_import", fmt.Sprintf("Imported %d commands from %s", imported, provider)); err != nil {
		log.Println("failed to insert audit log for custom command import:", err)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Imported int    `json:"imported"`
		Provider string `json:"provider"`
	}{Imported: imported, Provider: provider})
}

// handleNightbotAuthStart redirects the user to Nightbot's OAuth
// authorization page so we can fetch their custom commands directly
// via the Nightbot API. The login and desired frontend redirect are
// encoded into the OAuth state parameter.
func handleNightbotAuthStart(clientID, redirectURI string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		frontendRedirect := strings.TrimSpace(r.URL.Query().Get("redirect"))
		if frontendRedirect == "" {
			frontendRedirect = getFrontendBaseURL() + "/import"
		}

		statePayload := struct {
			Login    string `json:"login"`
			Redirect string `json:"redirect"`
		}{
			Login:    login,
			Redirect: frontendRedirect,
		}
		stateJSON, err := json.Marshal(statePayload)
		if err != nil {
			log.Println("failed to marshal nightbot state:", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		state := base64.URLEncoding.EncodeToString(stateJSON)

		authURL, err := url.Parse("https://api.nightbot.tv/oauth2/authorize")
		if err != nil {
			log.Println("failed to parse nightbot authorize url:", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		q := authURL.Query()
		q.Set("response_type", "code")
		q.Set("client_id", clientID)
		q.Set("redirect_uri", redirectURI)
		q.Set("scope", "commands")
		q.Set("state", state)
		authURL.RawQuery = q.Encode()

		http.Redirect(w, r, authURL.String(), http.StatusFound)
	}
}

// handleNightbotAuthCallback exchanges the authorization code for an
// access token, fetches the user's Nightbot custom commands, imports
// them as Axyra custom commands, and then redirects back to the
// frontend import page with a status indicator.
func handleNightbotAuthCallback(clientID, clientSecret, redirectURI string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		code := strings.TrimSpace(q.Get("code"))
		stateParam := q.Get("state")
		var statePayload struct {
			Login    string `json:"login"`
			Redirect string `json:"redirect"`
		}
		if stateParam != "" {
			if decoded, err := base64.URLEncoding.DecodeString(stateParam); err == nil {
				if err := json.Unmarshal(decoded, &statePayload); err != nil {
					log.Println("failed to unmarshal nightbot state:", err)
				}
			} else {
				log.Println("failed to decode nightbot state:", err)
			}
		}

		login := strings.ToLower(strings.TrimSpace(statePayload.Login))
		frontendRedirect := strings.TrimSpace(statePayload.Redirect)
		if frontendRedirect == "" {
			frontendRedirect = getFrontendBaseURL() + "/import"
		}

		redirectWithStatus := func(status string, count int) {
			u, err := url.Parse(frontendRedirect)
			if err != nil {
				log.Println("failed to parse frontend redirect for nightbot callback:", err)
				http.Error(w, "nightbot import complete", http.StatusOK)
				return
			}
			params := u.Query()
			params.Set("provider", "nightbot")
			params.Set("nightbot", status)
			if count > 0 {
				params.Set("count", strconv.Itoa(count))
			}
			u.RawQuery = params.Encode()
			http.Redirect(w, r, u.String(), http.StatusFound)
		}

		// If Nightbot returned an error (e.g., access_denied), just
		// bounce back to the frontend with an error flag.
		if errParam := strings.TrimSpace(q.Get("error")); errParam != "" {
			log.Println("nightbot oauth error:", errParam)
			redirectWithStatus("error", 0)
			return
		}

		if code == "" {
			redirectWithStatus("error", 0)
			return
		}

		// Exchange authorization code for access token.
		form := url.Values{}
		form.Set("client_id", clientID)
		form.Set("client_secret", clientSecret)
		form.Set("grant_type", "authorization_code")
		form.Set("redirect_uri", redirectURI)
		form.Set("code", code)
		resp, err := http.PostForm("https://api.nightbot.tv/oauth2/token", form)
		if err != nil {
			log.Println("nightbot token exchange failed:", err)
			redirectWithStatus("error", 0)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			log.Println("nightbot token exchange non-200:", resp.StatusCode)
			redirectWithStatus("error", 0)
			return
		}
		var tokenResp struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
			log.Println("failed to decode nightbot token response:", err)
			redirectWithStatus("error", 0)
			return
		}
		accessToken := strings.TrimSpace(tokenResp.AccessToken)
		if accessToken == "" {
			log.Println("nightbot token response missing access_token")
			redirectWithStatus("error", 0)
			return
		}

		// Fetch custom commands from Nightbot.
		req, err := http.NewRequest(http.MethodGet, "https://api.nightbot.tv/1/commands", nil)
		if err != nil {
			log.Println("failed to build nightbot commands request:", err)
			redirectWithStatus("error", 0)
			return
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		cmdResp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Println("nightbot commands request failed:", err)
			redirectWithStatus("error", 0)
			return
		}
		defer cmdResp.Body.Close()
		if cmdResp.StatusCode != http.StatusOK {
			log.Println("nightbot commands non-200:", cmdResp.StatusCode)
			redirectWithStatus("error", 0)
			return
		}
		var nb struct {
			Status   int `json:"status"`
			Commands []struct {
				Name    string `json:"name"`
				Message string `json:"message"`
			} `json:"commands"`
		}
		if err := json.NewDecoder(cmdResp.Body).Decode(&nb); err != nil {
			log.Println("failed to decode nightbot commands response:", err)
			redirectWithStatus("error", 0)
			return
		}

		if login == "" {
			log.Println("nightbot import missing login in state; skipping import")
			redirectWithStatus("error", 0)
			return
		}

		imported := 0
		for _, c := range nb.Commands {
			name := strings.TrimSpace(c.Name)
			respText := strings.TrimSpace(c.Message)
			if name == "" || respText == "" {
				continue
			}
			if !strings.HasPrefix(name, "!") {
				name = "!" + name
			}
			if err := UpsertCustomCommand(login, "import:nightbot", name, respText, "all"); err != nil {
				log.Println("failed to import nightbot command:", name, err)
				continue
			}
			imported++
		}

		if imported > 0 {
			if err := InsertAuditLog(login, "bot", "custom_command_import", fmt.Sprintf("Imported %d commands from nightbot via oauth", imported)); err != nil {
				log.Println("failed to insert audit log for nightbot import:", err)
			}
		}

		status := "none"
		if imported > 0 {
			status = "success"
		} else {
			status = "error"
		}
		redirectWithStatus(status, imported)
	}
}

// handleCustomCommandsAdd creates a new custom command for a broadcaster.
func handleCustomCommandsAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login    string `json:"login"`
		Command  string `json:"command"`
		Response string `json:"response"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	cmd := strings.TrimSpace(body.Command)
	resp := strings.TrimSpace(body.Response)
	role := strings.TrimSpace(body.Role)
	if role == "" {
		role = "all"
	}
	if login == "" || cmd == "" || resp == "" {
		http.Error(w, "missing login, command, or response", http.StatusBadRequest)
		return
	}
	if err := UpsertCustomCommand(login, login, cmd, resp, role); err != nil {
		log.Println("failed to add custom command:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if err := InsertAuditLog(login, "bot", "custom_command_add", fmt.Sprintf("Added custom command %s", cmd)); err != nil {
		log.Println("failed to insert audit log for custom command add:", err)
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
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
		// When the birthdays module is enabled, ensure all birthday
		// commands are defaulted to enabled for this broadcaster.
		if strings.EqualFold(module, "birthdays") && body.Enabled {
			for _, bcmd := range birthdayCommandNames {
				if err := SetDefaultCommandEnabled(login, bcmd, true); err != nil {
					log.Println("failed to enable birthday default command from module toggle:", bcmd, err)
				}
			}
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
		hint := r.URL.Query().Get("hint")

		// Quick re-login: if the frontend supplies a previously-used login name
		// and that user's stored token is still valid, skip the OAuth consent
		// screen entirely and redirect straight back to the frontend.
		if hint != "" && db != nil {
			if access, _, err := GetUserTokens(strings.ToLower(hint)); err == nil && access != "" {
				if login, err := getLoginFromToken(access); err == nil && strings.EqualFold(login, hint) {
					avatarURL, _ := getUserProfileImage(access, clientID)
					if redirect != "" {
						if dest, err := url.Parse(redirect); err == nil {
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
			}
		}

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
			// Channel management
			"channel:manage:broadcast",
			"channel:edit:commercial",
			"channel:manage:redemptions",
			"channel:manage:moderators",

			// Channel read
			"channel:read:ads",
			"channel:read:charity",
			"channel:read:hype_train",
			"channel:read:polls",
			"channel:read:predictions",
			"channel:read:subscriptions",
			"channel:read:vips",

			// User
			"user:read:email",
			"user:read:follows",

			// Moderation
			"channel:moderate",
			"moderation:read",

			// Moderator read
			"moderator:read:banned_users",
			"moderator:read:blocked_terms",
			"moderator:read:chat_messages",
			"moderator:read:chat_settings",
			"moderator:read:chatters",
			"moderator:read:followers",
			"moderator:read:moderators",
			"moderator:read:suspicious_users",
			"moderator:read:unban_requests",
			"moderator:read:vips",
			"moderator:read:warnings",

			// Moderator manage
			"moderator:manage:automod",
			"moderator:manage:banned_users",
			"moderator:manage:chat_messages",
			"moderator:manage:chat_settings",

			// Bot
			"channel:bot",
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
		q.Set("force_verify", "true") // always show consent screen so new scopes are granted
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

// handleCategorySearch proxies Twitch's /helix/search/categories endpoint so
// the frontend can show an autocomplete dropdown without exposing tokens.
func handleCategorySearch(clientID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if query == "" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"data":[]}`))
			return
		}
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		_, access, err := ensureValidUserToken(login)
		if err != nil {
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}
		req, err := http.NewRequest("GET",
			"https://api.twitch.tv/helix/search/categories?query="+url.QueryEscape(query)+"&first=8", nil)
		if err != nil {
			http.Error(w, "request build failed", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Client-ID", clientID)
		req.Header.Set("Authorization", "Bearer "+access)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, "helix error", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()
		var result struct {
			Data []struct {
				ID        string `json:"id"`
				Name      string `json:"name"`
				BoxArtURL string `json:"box_art_url"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			http.Error(w, "decode error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
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

func handleChatStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	msgsPerMin, uniqueChatters, history := getChatStats(login)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"msgs_per_min":    msgsPerMin,
		"unique_chatters": uniqueChatters,
		"history":         history,
	}); err != nil {
		log.Println("encode chat stats:", err)
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

// handleBirthdaysAdd accepts a POST with a list of birthday entries and upserts
// them all. Each entry is "NAME MM DD" on its own line.
func handleBirthdaysAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login   string `json:"login"`
		Entries string `json:"entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	type result struct {
		Line  string `json:"line"`
		Error string `json:"error,omitempty"`
	}
	var results []result
	for _, rawLine := range strings.Split(body.Entries, "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) != 3 {
			results = append(results, result{Line: line, Error: "expected: NAME MM DD"})
			continue
		}
		name := parts[0]
		month, err1 := strconv.Atoi(parts[1])
		day, err2 := strconv.Atoi(parts[2])
		if err1 != nil || err2 != nil || month < 1 || month > 12 || day < 1 || day > 31 {
			results = append(results, result{Line: line, Error: "month must be 1-12, day must be 1-31"})
			continue
		}
		if err := UpsertBirthday(login, strings.ToLower(name), name, month, day); err != nil {
			log.Println("handleBirthdaysAdd UpsertBirthday:", err)
			results = append(results, result{Line: line, Error: "db error"})
			continue
		}
		results = append(results, result{Line: line})
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(struct {
		Results []result `json:"results"`
	}{Results: results}); err != nil {
		log.Println("encode birthdays add:", err)
	}
}

// handleBirthdaysDelete deletes a single birthday entry by broadcaster login
// and user login.
func handleBirthdaysDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login     string `json:"login"`
		UserLogin string `json:"userLogin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	userLogin := strings.ToLower(strings.TrimSpace(body.UserLogin))
	if login == "" || userLogin == "" {
		http.Error(w, "missing login or userLogin", http.StatusBadRequest)
		return
	}
	if err := DeleteBirthday(login, userLogin); err != nil {
		log.Println("handleBirthdaysDelete:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

// handleBirthdayCommandMessages manages per-command custom messages for the
// birthday-related built-in commands. GET returns the current templates for
// each birthday command; POST updates or resets a single command template.
func handleBirthdayCommandMessages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		// For each known birthday command, load any stored custom message.
		var rows []struct {
			Name    string `json:"name"`
			Message string `json:"message"`
		}
		for _, cmd := range birthdayCommandNames {
			msg, err := GetBirthdayCommandMessage(login, cmd)
			if err != nil {
				log.Println("failed to load birthday command message:", cmd, err)
				msg = ""
			}
			rows = append(rows, struct {
				Name    string `json:"name"`
				Message string `json:"message"`
			}{Name: cmd, Message: msg})
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(struct {
			Commands interface{} `json:"commands"`
		}{Commands: rows}); err != nil {
			log.Println("encode birthday command messages:", err)
		}
	case http.MethodPost:
		var body struct {
			Login          string `json:"login"`
			Command        string `json:"command"`
			Message        string `json:"message"`
			ResetToDefault bool   `json:"resetToDefault"`
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
		if body.ResetToDefault {
			if err := DeleteBirthdayCommandMessage(login, cmd); err != nil {
				log.Println("failed to delete birthday command message:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
		} else {
			trimmed := strings.TrimSpace(body.Message)
			if trimmed == "" {
				// Empty message when not resetting is treated as a no-op to avoid
				// accidentally blanking responses.
				http.Error(w, "message cannot be empty", http.StatusBadRequest)
				return
			}
			if err := SetBirthdayCommandMessage(login, cmd, trimmed); err != nil {
				log.Println("failed to save birthday command message:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
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
	userID, scopes, err := validateTokenFull(access)
	if err == nil && userID != "" {
		log.Printf("[TOKEN] %s scopes: %v", login, scopes)
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
	userID, scopes, err = validateTokenFull(tr.AccessToken)
	if err != nil || userID == "" {
		if err == nil {
			return "", "", fmt.Errorf("validate after refresh returned empty user id")
		}
		return "", "", err
	}
	log.Printf("[TOKEN] %s scopes after refresh: %v", login, scopes)
	return userID, tr.AccessToken, nil
}

// --- Blocked Terms ------------------------------------------------------------

// handleEditorChannels returns all broadcaster channels where the given user
// has been assigned the "Editor" role.
func handleEditorChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := EnsureRolesTable(); err != nil {
		log.Println("roles table ensure failed:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	channels, err := ListEditorChannels(login)
	if err != nil {
		log.Println("list editor channels:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if channels == nil {
		channels = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"channels": channels})
}

// handleUserAvatar returns the Twitch profile picture URL for a given login name.
// It uses an app access token so no user-specific credentials are needed.
func handleUserAvatar(clientID, clientSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		appToken, err := getAppAccessToken(clientID, clientSecret)
		if err != nil {
			log.Println("handleUserAvatar: get app token:", err)
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}
		req, err := http.NewRequest("GET", "https://api.twitch.tv/helix/users?login="+login, nil)
		if err != nil {
			http.Error(w, "request error", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Client-ID", clientID)
		req.Header.Set("Authorization", "Bearer "+appToken)
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			http.Error(w, "twitch api error", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		var res struct {
			Data []struct {
				ProfileImageURL string `json:"profile_image_url"`
			} `json:"data"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil || len(res.Data) == 0 {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"avatar_url": res.Data[0].ProfileImageURL})
	}
}

// handleRoles handles GET (list) and POST (add/update) for user role assignments.
func handleRoles(w http.ResponseWriter, r *http.Request) {
	if err := EnsureRolesTable(); err != nil {
		log.Println("roles table ensure failed:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		roles, err := ListUserRoles(login)
		if err != nil {
			log.Println("list user roles:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		type row struct {
			ID       int64  `json:"id"`
			Username string `json:"username"`
			Role     string `json:"role"`
		}
		out := make([]row, len(roles))
		for i, r := range roles {
			out[i] = row{ID: r.ID, Username: r.Username, Role: r.Role}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"roles": out})
	case http.MethodPost:
		var body struct {
			Login    string `json:"login"`
			Username string `json:"username"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		username := strings.TrimSpace(body.Username)
		role := strings.TrimSpace(body.Role)
		if login == "" || username == "" {
			http.Error(w, "missing login or username", http.StatusBadRequest)
			return
		}
		switch role {
		case "Editor", "Mod", "Regular":
		default:
			role = "Regular"
		}
		id, err := AddUserRole(login, username, role)
		if err != nil {
			log.Println("add user role:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"id": id})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleRolesDelete deletes a role assignment by ID.
func handleRolesDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
		ID    int64  `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" || body.ID == 0 {
		http.Error(w, "missing login or id", http.StatusBadRequest)
		return
	}
	if err := DeleteUserRole(login, body.ID); err != nil {
		log.Println("delete user role:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

// handleDiscordGuilds returns the list of Discord servers the bot is currently
// in. When viewer_login and channel_login differ (an editor viewing someone
// else's channel), only guilds the viewer is explicitly listed as a manager
// of are returned.
func handleDiscordGuilds(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	viewerLogin := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("viewer_login")))
	channelLogin := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("channel_login")))

	allGuilds := GetBotGuilds()
	if allGuilds == nil {
		allGuilds = []BotGuild{}
	}

	// If the viewer is the channel owner (or no context provided), return everything.
	if viewerLogin == "" || channelLogin == "" || viewerLogin == channelLogin {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"guilds": allGuilds})
		return
	}

	// Viewer is an editor — filter to guilds they are explicitly authorised for.
	authorisedIDs, err := GetGuildsForManager(viewerLogin)
	if err != nil {
		log.Println("get guilds for manager:", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"guilds": []BotGuild{}})
		return
	}
	allowed := make(map[string]bool, len(authorisedIDs))
	for _, id := range authorisedIDs {
		allowed[id] = true
	}
	var filtered []BotGuild
	for _, g := range allGuilds {
		if allowed[g.ID] {
			filtered = append(filtered, g)
		}
	}
	if filtered == nil {
		filtered = []BotGuild{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"guilds": filtered})
}

// handleDiscordGuildManagers manages per-guild dashboard access for Twitch editors.
// GET    ?guild_id=   → {"managers":["login1","login2"]}
// POST   {guild_id, login}  → grants access
// DELETE {guild_id, login}  → revokes access
func handleDiscordGuildManagers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		managers, err := GetDiscordGuildManagers(guildID)
		if err != nil {
			log.Println("get discord guild managers:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		if managers == nil {
			managers = []string{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"managers": managers})

	case http.MethodPost:
		var body struct {
			GuildID string `json:"guild_id"`
			Login   string `json:"login"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if body.GuildID == "" || body.Login == "" {
			http.Error(w, "missing guild_id or login", http.StatusBadRequest)
			return
		}
		if err := AddDiscordGuildManager(body.GuildID, body.Login); err != nil {
			log.Println("add discord guild manager:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")

	case http.MethodDelete:
		var body struct {
			GuildID string `json:"guild_id"`
			Login   string `json:"login"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if body.GuildID == "" || body.Login == "" {
			http.Error(w, "missing guild_id or login", http.StatusBadRequest)
			return
		}
		if err := RemoveDiscordGuildManager(body.GuildID, body.Login); err != nil {
			log.Println("remove discord guild manager:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordChannels returns all text channels in a Discord guild the bot
// is in. Requires guild_id query param.
func handleDiscordChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
	if guildID == "" {
		http.Error(w, "missing guild_id", http.StatusBadRequest)
		return
	}
	// all=true returns every channel type including categories (type=4)
	if r.URL.Query().Get("all") == "true" {
		channels, err := GetGuildAllChannels(guildID)
		if err != nil {
			log.Println("get guild all channels:", err)
			http.Error(w, "failed to fetch channels", http.StatusInternalServerError)
			return
		}
		if channels == nil {
			channels = []GuildChannelWithType{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"channels": channels})
		return
	}
	channels, err := GetGuildTextChannels(guildID)
	if err != nil {
		log.Println("get guild channels:", err)
		http.Error(w, "failed to fetch channels", http.StatusInternalServerError)
		return
	}
	if channels == nil {
		channels = []GuildChannel{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"channels": channels})
}

// handleDiscordNotificationTemplates handles GET and POST for per-guild
// custom Discord notification message templates.
// GET  ?login=&guild_id=   → {"live":"...","mod":"...","birthday":"..."}
// POST {login, guild_id, templates:{live,mod,birthday}}
func handleDiscordNotificationTemplates(w http.ResponseWriter, r *http.Request) {
	validTypes := map[string]bool{"live": true, "mod": true, "birthday": true}
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if login == "" || guildID == "" {
			http.Error(w, "missing login or guild_id", http.StatusBadRequest)
			return
		}
		out := map[string]string{}
		for t := range validTypes {
			tmpl, err := GetDiscordNotificationTemplate(login, guildID, t)
			if err != nil {
				log.Printf("get discord notification template (%s/%s/%s): %v", login, guildID, t, err)
			}
			out[t] = tmpl
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)

	case http.MethodPost:
		var body struct {
			Login     string            `json:"login"`
			GuildID   string            `json:"guild_id"`
			Templates map[string]string `json:"templates"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		if login == "" || body.GuildID == "" {
			http.Error(w, "missing login or guild_id", http.StatusBadRequest)
			return
		}
		for t, tmpl := range body.Templates {
			if !validTypes[t] {
				continue
			}
			if err := SaveDiscordNotificationTemplate(login, body.GuildID, t, tmpl); err != nil {
				log.Printf("save discord notification template (%s/%s/%s): %v", login, body.GuildID, t, err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordRoles returns all non-managed roles in a Discord guild.
func handleDiscordRoles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
	if guildID == "" {
		http.Error(w, "missing guild_id", http.StatusBadRequest)
		return
	}
	roles, err := GetGuildRoles(guildID)
	if err != nil {
		log.Println("get guild roles:", err)
		http.Error(w, "failed to fetch roles", http.StatusInternalServerError)
		return
	}
	if roles == nil {
		roles = []GuildRole{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"roles": roles})
}

// handleDiscordRoleMappings handles GET and POST for per-(broadcaster,guild)
// Twitch-level → Discord-role mappings.
func handleDiscordRoleMappings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if login == "" || guildID == "" {
			http.Error(w, "missing login or guild_id", http.StatusBadRequest)
			return
		}
		mappings, err := GetDiscordRoleMappings(login, guildID)
		if err != nil {
			log.Println("get discord role mappings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Build a level→{id,name} map for easy consumption by the frontend.
		out := map[string]map[string]string{}
		for _, m := range mappings {
			out[m.TwitchLevel] = map[string]string{
				"discord_role_id":   m.DiscordRoleID,
				"discord_role_name": m.DiscordRoleName,
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)

	case http.MethodPost:
		var body struct {
			Login    string            `json:"login"`
			GuildID  string            `json:"guild_id"`
			Mappings map[string]string `json:"mappings"` // level → discord_role_id
			Roles    map[string]string `json:"roles"`    // discord_role_id → discord_role_name
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		guildID := strings.TrimSpace(body.GuildID)
		if login == "" || guildID == "" {
			http.Error(w, "missing login or guild_id", http.StatusBadRequest)
			return
		}
		validLevels := map[string]bool{"everyone": true, "vip": true, "moderator": true, "owner": true}
		for level, roleID := range body.Mappings {
			if !validLevels[level] {
				continue
			}
			roleName := body.Roles[roleID]
			if err := SaveDiscordRoleMapping(DiscordRoleMapping{
				BroadcasterLogin: login,
				GuildID:          guildID,
				TwitchLevel:      level,
				DiscordRoleID:    roleID,
				DiscordRoleName:  roleName,
			}); err != nil {
				log.Println("save discord role mapping:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordSettings handles GET and POST for per-broadcaster Discord
// channel configuration.
func handleDiscordSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if login == "" || guildID == "" {
			http.Error(w, "missing login or guild_id", http.StatusBadRequest)
			return
		}
		settings, err := GetDiscordSettings(login, guildID)
		if err != nil {
			log.Println("get discord settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		if settings == nil {
			settings = &DiscordSettings{BroadcasterLogin: login, GuildID: guildID}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"guild_id":        settings.GuildID,
			"live_channel_id": settings.LiveChannelID,
			"mod_channel_id":  settings.ModChannelID,
			"bday_channel_id": settings.BdayChannelID,
		})
	case http.MethodPost:
		var body struct {
			Login         string `json:"login"`
			GuildID       string `json:"guild_id"`
			LiveChannelID string `json:"live_channel_id"`
			ModChannelID  string `json:"mod_channel_id"`
			BdayChannelID string `json:"bday_channel_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		if err := SaveDiscordSettings(DiscordSettings{
			BroadcasterLogin: login,
			GuildID:          strings.TrimSpace(body.GuildID),
			LiveChannelID:    strings.TrimSpace(body.LiveChannelID),
			ModChannelID:     strings.TrimSpace(body.ModChannelID),
			BdayChannelID:    strings.TrimSpace(body.BdayChannelID),
		}); err != nil {
			log.Println("save discord settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordGuildModules handles GET and POST for per-guild bot module
// enable/disable settings.
func handleDiscordGuildModules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		modules, err := GetDiscordGuildModules(guildID)
		if err != nil {
			log.Println("get discord guild modules:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		// Ensure all 7 known modules are represented (default true if not in DB).
		allModules := []string{"moderation", "manager", "roles", "info", "fun", "tags", "giveaway"}
		out := make(map[string]bool, len(allModules))
		for _, m := range allModules {
			if v, ok := modules[m]; ok {
				out[m] = v
			} else {
				out[m] = true
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"modules": out})
	case http.MethodPost:
		var body struct {
			GuildID string `json:"guild_id"`
			Module  string `json:"module"`
			Enabled bool   `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		guildID := strings.TrimSpace(body.GuildID)
		module := strings.ToLower(strings.TrimSpace(body.Module))
		if guildID == "" || module == "" {
			http.Error(w, "missing guild_id or module", http.StatusBadRequest)
			return
		}
		if err := SetDiscordGuildModuleEnabled(guildID, module, body.Enabled); err != nil {
			log.Println("set discord guild module:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordCommandSettings handles GET and POST for per-guild per-command
// string configuration values (e.g. default durations, message templates).
func handleDiscordCommandSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		settings, err := GetDiscordCommandSettings(guildID)
		if err != nil {
			log.Println("get discord command settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"settings": settings})
	case http.MethodPost:
		var body struct {
			GuildID string `json:"guild_id"`
			Key     string `json:"key"`
			Value   string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		guildID := strings.TrimSpace(body.GuildID)
		key := strings.TrimSpace(body.Key)
		if guildID == "" || key == "" {
			http.Error(w, "missing guild_id or key", http.StatusBadRequest)
			return
		}
		if err := SetDiscordCommandSetting(guildID, key, body.Value); err != nil {
			log.Println("set discord command setting:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleBlockedTerms handles GET (list) and POST (add/update) for blocked terms.
func handleBlockedTerms(w http.ResponseWriter, r *http.Request) {
	if err := EnsureBlockedTermsTable(); err != nil {
		log.Println("blocked terms table ensure failed:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		terms, err := ListBlockedTerms(login)
		if err != nil {
			log.Println("list blocked terms:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		type row struct {
			ID             int64  `json:"id"`
			Term           string `json:"term"`
			Action         string `json:"action"`
			TimeoutSeconds int    `json:"timeout_seconds"`
		}
		out := make([]row, len(terms))
		for i, t := range terms {
			out[i] = row{ID: t.ID, Term: t.Term, Action: t.Action, TimeoutSeconds: t.TimeoutSeconds}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"terms": out})
	case http.MethodPost:
		var body struct {
			Login          string `json:"login"`
			Term           string `json:"term"`
			Action         string `json:"action"`
			TimeoutSeconds int    `json:"timeout_seconds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		term := strings.TrimSpace(body.Term)
		action := strings.TrimSpace(body.Action)
		if login == "" || term == "" {
			http.Error(w, "missing login or term", http.StatusBadRequest)
			return
		}
		if action == "" {
			action = "delete"
		}
		id, err := AddBlockedTerm(login, term, action, body.TimeoutSeconds)
		if err != nil {
			log.Println("add blocked term:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		if err := InsertAuditLog(login, "bot", "blocked_term_add", fmt.Sprintf("Added blocked term: %s (%s)", term, action)); err != nil {
			log.Println("audit log blocked term add:", err)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"id": id})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleBlockedTermsDelete deletes a blocked term by ID.
func handleBlockedTermsDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
		ID    int64  `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" || body.ID == 0 {
		http.Error(w, "missing login or id", http.StatusBadRequest)
		return
	}
	if err := DeleteBlockedTerm(login, body.ID); err != nil {
		log.Println("delete blocked term:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if err := InsertAuditLog(login, "bot", "blocked_term_delete", fmt.Sprintf("Deleted blocked term id %d", body.ID)); err != nil {
		log.Println("audit log blocked term delete:", err)
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

// handleEventSubWebhook receives Twitch EventSub webhook notifications.
// It is used exclusively for channel.chat.message so the bot is subscribed
// with an App Access Token + webhook transport, which is the requirement for
// the bot to appear in the "Chat Bots" section of Users in Chat.
//
// Required env var: TWITCH_EVENTSUB_SECRET  (set this to the secret you pass
// when creating the subscription; min 10 chars, max 100 chars).
func handleEventSubWebhook(w http.ResponseWriter, r *http.Request) {
	// Read the full body so we can verify the HMAC signature.
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB limit
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	secret := os.Getenv("TWITCH_EVENTSUB_SECRET")
	if secret == "" {
		http.Error(w, "webhook secret not configured", http.StatusInternalServerError)
		return
	}

	// Verify HMAC-SHA256 signature: HMAC(secret, msgID + msgTimestamp + body)
	msgID := r.Header.Get("Twitch-Eventsub-Message-Id")
	msgTS := r.Header.Get("Twitch-Eventsub-Message-Timestamp")
	sigHeader := r.Header.Get("Twitch-Eventsub-Message-Signature") // "sha256=<hex>"

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(msgID))
	mac.Write([]byte(msgTS))
	mac.Write(body)
	expected := "sha256=" + fmt.Sprintf("%x", mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(sigHeader)) {
		http.Error(w, "invalid signature", http.StatusForbidden)
		return
	}

	msgType := r.Header.Get("Twitch-Eventsub-Message-Type")

	switch msgType {
	case "webhook_callback_verification":
		// Twitch sends this once to confirm the endpoint. Echo the challenge.
		var payload struct {
			Challenge string `json:"challenge"`
		}
		if err := json.Unmarshal(body, &payload); err != nil || payload.Challenge == "" {
			http.Error(w, "invalid challenge payload", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, payload.Challenge)

	case "notification":
		// Process the event asynchronously so Twitch gets a fast 200 OK.
		go func(b []byte) {
			var envelope struct {
				Subscription struct {
					Type string `json:"type"`
				} `json:"subscription"`
				Event map[string]interface{} `json:"event"`
			}
			if err := json.Unmarshal(b, &envelope); err != nil {
				log.Println("[webhook] failed to parse notification:", err)
				return
			}
			if envelope.Subscription.Type != "channel.chat.message" {
				return
			}
			event := envelope.Event
			channelLogin, _ := event["broadcaster_user_login"].(string)
			chatterLogin, _ := event["chatter_user_login"].(string)
			chatterID, _ := event["chatter_user_id"].(string)
			chatterName, _ := event["chatter_user_name"].(string)
			messageID, _ := event["message_id"].(string)
			msgText := ""
			if msgObj, ok := event["message"].(map[string]interface{}); ok {
				msgText, _ = msgObj["text"].(string)
			}
			// Extract badges for giveaway role tracking
			isSub, isVIP, isMod := false, false, false
			if badges, ok := event["badges"].([]interface{}); ok {
				for _, b := range badges {
					if bm, ok := b.(map[string]interface{}); ok {
						switch sid, _ := bm["set_id"].(string); sid {
						case "subscriber", "founder":
							isSub = true
						case "vip":
							isVIP = true
						case "moderator", "broadcaster":
							isMod = true
						}
					}
				}
			}
			if chatterName == "" {
				chatterName = chatterLogin
			}
			if channelLogin != "" && msgText != "" {
				handleChatMessageEvent(channelLogin, chatterLogin, chatterID, messageID, msgText)
				RecordGiveawayEntry(channelLogin, chatterLogin, chatterName, isSub, isVIP, isMod)
				RecordGiveawayKeyword(channelLogin, chatterLogin, chatterName, msgText, isSub, isVIP, isMod)
			}
		}(body)
		w.WriteHeader(http.StatusNoContent)

	case "revocation":
		log.Println("[webhook] subscription revoked:", r.Header.Get("Twitch-Eventsub-Subscription-Type"))
		w.WriteHeader(http.StatusNoContent)

	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

// handleSpamFilters handles GET (list) and POST (add) for spam filters.
func handleSpamFilters(w http.ResponseWriter, r *http.Request) {
	if err := EnsureSpamFiltersTable(); err != nil {
		log.Println("spam filters table ensure failed:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	switch r.Method {
	case http.MethodGet:
		login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
		if login == "" {
			http.Error(w, "missing login", http.StatusBadRequest)
			return
		}
		filters, err := ListSpamFilters(login)
		if err != nil {
			log.Println("list spam filters:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		type row struct {
			ID             int64  `json:"id"`
			Type           string `json:"type"`
			Action         string `json:"action"`
			TimeoutSeconds int    `json:"timeout_seconds"`
		}
		out := make([]row, len(filters))
		for i, f := range filters {
			out[i] = row{ID: f.ID, Type: f.Type, Action: f.Action, TimeoutSeconds: f.TimeoutSeconds}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"filters": out})
	case http.MethodPost:
		var body struct {
			Login          string `json:"login"`
			Type           string `json:"type"`
			Action         string `json:"action"`
			TimeoutSeconds int    `json:"timeout_seconds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		login := strings.ToLower(strings.TrimSpace(body.Login))
		filterType := strings.ToLower(strings.TrimSpace(body.Type))
		action := strings.TrimSpace(body.Action)
		if login == "" || filterType == "" {
			http.Error(w, "missing login or type", http.StatusBadRequest)
			return
		}
		validTypes := map[string]bool{"caps": true, "link": true, "length": true, "emotes": true}
		if !validTypes[filterType] {
			http.Error(w, "invalid filter type", http.StatusBadRequest)
			return
		}
		if action == "" {
			action = "delete"
		}
		id, err := AddSpamFilter(login, filterType, action, body.TimeoutSeconds)
		if err != nil {
			log.Println("add spam filter:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		if err := InsertAuditLog(login, "bot", "spam_filter_add", fmt.Sprintf("Added spam filter: %s (%s)", filterType, action)); err != nil {
			log.Println("audit log spam filter add:", err)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"id": id})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleSpamFiltersDelete deletes a spam filter by ID.
func handleSpamFiltersDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
		ID    int64  `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" || body.ID == 0 {
		http.Error(w, "missing login or id", http.StatusBadRequest)
		return
	}
	if err := DeleteSpamFilter(login, body.ID); err != nil {
		log.Println("delete spam filter:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if err := InsertAuditLog(login, "bot", "spam_filter_delete", fmt.Sprintf("Deleted spam filter id %d", body.ID)); err != nil {
		log.Println("audit log spam filter delete:", err)
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

// ---------------------------------------------------------------------------
// Giveaway HTTP handlers
// ---------------------------------------------------------------------------

// handleGiveawayState returns the current giveaway state for a broadcaster.
func handleGiveawayState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	login := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("login")))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	g := getOrCreateGiveaway(login)
	g.mu.Lock()
	defer g.mu.Unlock()

	type entryOut struct {
		Login        string    `json:"login"`
		DisplayName  string    `json:"displayName"`
		IsSubscriber bool      `json:"isSubscriber"`
		IsVIP        bool      `json:"isVip"`
		IsMod        bool      `json:"isMod"`
		EnteredAt    time.Time `json:"enteredAt"`
	}
	entries := make([]entryOut, 0, len(g.Entries))
	for _, e := range g.Entries {
		// Evict inactive entries if timeout is set
		if g.InactivitySec > 0 && !e.LastSeen.IsZero() && time.Since(e.LastSeen) > time.Duration(g.InactivitySec)*time.Second {
			delete(g.Entries, e.Login)
			continue
		}
		entries = append(entries, entryOut{e.Login, e.DisplayName, e.IsSubscriber, e.IsVIP, e.IsMod, e.EnteredAt})
	}

	var winner *entryOut
	if g.Winner != nil {
		w2 := entryOut{g.Winner.Login, g.Winner.DisplayName, g.Winner.IsSubscriber, g.Winner.IsVIP, g.Winner.IsMod, g.Winner.EnteredAt}
		winner = &w2
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"active":        g.Active,
		"type":          g.Type,
		"keyword":       g.Keyword,
		"inactivitySec": g.InactivitySec,
		"subMultiplier": g.SubMultiplier,
		"chatAnnounce":  g.ChatAnnounce,
		"entries":       entries,
		"winner":        winner,
	}); err != nil {
		log.Println("encode giveaway state:", err)
	}
}

// handleGiveawayStart starts or updates settings of a giveaway.
func handleGiveawayStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login         string `json:"login"`
		Type          string `json:"type"`
		Keyword       string `json:"keyword"`
		InactivitySec int    `json:"inactivitySec"`
		SubMultiplier int    `json:"subMultiplier"`
		ChatAnnounce  bool   `json:"chatAnnounce"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	if body.SubMultiplier < 1 {
		body.SubMultiplier = 1
	}
	g := getOrCreateGiveaway(login)
	g.mu.Lock()
	g.Active = true
	g.Type = body.Type
	g.Keyword = strings.TrimSpace(body.Keyword)
	g.InactivitySec = body.InactivitySec
	g.SubMultiplier = body.SubMultiplier
	g.ChatAnnounce = body.ChatAnnounce
	g.StartedAt = time.Now()
	g.Winner = nil
	g.Entries = map[string]*GiveawayEntry{}
	g.mu.Unlock()

	if body.ChatAnnounce {
		msg := "🎉 A giveaway has started!"
		if body.Type == "keyword" && body.Keyword != "" {
			msg = fmt.Sprintf("🎉 A giveaway has started! Type \"%s\" to enter!", body.Keyword)
		}
		if err := sendHelixChatMessage(login, msg); err != nil {
			log.Println("giveaway start announce:", err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleGiveawayStop stops the active giveaway.
func handleGiveawayStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	g := getOrCreateGiveaway(login)
	g.mu.Lock()
	g.Active = false
	g.mu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}

// handleGiveawayPickWinner picks a random winner from current entries using
// the subscriber luck multiplier as extra tickets for subscribers.
func handleGiveawayPickWinner(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	g := getOrCreateGiveaway(login)
	g.mu.Lock()
	defer g.mu.Unlock()

	if len(g.Entries) == 0 {
		http.Error(w, "no entries", http.StatusBadRequest)
		return
	}

	multiplier := g.SubMultiplier
	if multiplier < 1 {
		multiplier = 1
	}

	// Build weighted ticket pool
	var pool []*GiveawayEntry
	for _, e := range g.Entries {
		tickets := 1
		if e.IsSubscriber && multiplier > 1 {
			tickets = multiplier
		}
		for i := 0; i < tickets; i++ {
			pool = append(pool, e)
		}
	}

	winner := pool[rand.Intn(len(pool))]
	g.Winner = winner

	if g.ChatAnnounce {
		displayName := winner.DisplayName
		if displayName == "" {
			displayName = winner.Login
		}
		msg := fmt.Sprintf("🎉 Congratulations @%s, you won the giveaway!", displayName)
		if err := sendHelixChatMessage(login, msg); err != nil {
			log.Println("giveaway winner announce:", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"login":        winner.Login,
		"displayName":  winner.DisplayName,
		"isSubscriber": winner.IsSubscriber,
	}); err != nil {
		log.Println("encode giveaway winner:", err)
	}
}

// handleGiveawayClear clears all entries and the winner.
func handleGiveawayClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	if login == "" {
		http.Error(w, "missing login", http.StatusBadRequest)
		return
	}
	g := getOrCreateGiveaway(login)
	g.mu.Lock()
	g.Entries = map[string]*GiveawayEntry{}
	g.Winner = nil
	g.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// handleGiveawayRemoveEntry removes a single user from the giveaway entries.
func handleGiveawayRemoveEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login     string `json:"login"`
		UserLogin string `json:"userLogin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	login := strings.ToLower(strings.TrimSpace(body.Login))
	userLogin := strings.ToLower(strings.TrimSpace(body.UserLogin))
	if login == "" || userLogin == "" {
		http.Error(w, "missing login or userLogin", http.StatusBadRequest)
		return
	}
	g := getOrCreateGiveaway(login)
	g.mu.Lock()
	delete(g.Entries, userLogin)
	g.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Discord Ticket HTTP handlers
// ---------------------------------------------------------------------------

// handleDiscordTicketConfig handles GET (fetch config) and POST (save config).
func handleDiscordTicketConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		cfg, err := GetTicketConfig(guildID)
		if err != nil {
			log.Println("get ticket config:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"guild_id":         cfg.GuildID,
			"panel_channel_id": cfg.PanelChannelID,
			"log_channel_id":   cfg.LogChannelID,
			"category_id":      cfg.CategoryID,
			"support_role_ids": cfg.SupportRoleIDs,
			"panel_message_id": cfg.PanelMessageID,
			"panel_title":      cfg.PanelTitle,
			"panel_body":       cfg.PanelBody,
			"button_label":     cfg.ButtonLabel,
		})

	case http.MethodPost:
		var body struct {
			GuildID        string   `json:"guild_id"`
			PanelChannelID string   `json:"panel_channel_id"`
			LogChannelID   string   `json:"log_channel_id"`
			CategoryID     string   `json:"category_id"`
			SupportRoleIDs []string `json:"support_role_ids"`
			PanelTitle     string   `json:"panel_title"`
			PanelBody      string   `json:"panel_body"`
			ButtonLabel    string   `json:"button_label"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if body.GuildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		if body.SupportRoleIDs == nil {
			body.SupportRoleIDs = []string{}
		}
		if body.PanelTitle == "" {
			body.PanelTitle = "Support Tickets"
		}
		if body.PanelBody == "" {
			body.PanelBody = "Click the button below to open a support ticket."
		}
		if body.ButtonLabel == "" {
			body.ButtonLabel = "🎫 Open Ticket"
		}
		cfg := &DiscordTicketConfig{
			GuildID:        body.GuildID,
			PanelChannelID: body.PanelChannelID,
			LogChannelID:   body.LogChannelID,
			CategoryID:     body.CategoryID,
			SupportRoleIDs: body.SupportRoleIDs,
			PanelTitle:     body.PanelTitle,
			PanelBody:      body.PanelBody,
			ButtonLabel:    body.ButtonLabel,
		}
		// Preserve the existing panel_message_id (don't overwrite it from the form).
		if existing, err := GetTicketConfig(body.GuildID); err == nil {
			cfg.PanelMessageID = existing.PanelMessageID
		}
		if err := SaveTicketConfig(cfg); err != nil {
			log.Println("save ticket config:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordSendTicketPanel sends the ticket panel embed+button to the
// configured channel, or re-sends it if the channel/message changed.
func handleDiscordSendTicketPanel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		GuildID string `json:"guild_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.GuildID == "" {
		http.Error(w, "missing guild_id", http.StatusBadRequest)
		return
	}
	if discordSession == nil {
		http.Error(w, "discord bot not connected", http.StatusServiceUnavailable)
		return
	}
	cfg, err := GetTicketConfig(body.GuildID)
	if err != nil {
		log.Println("send ticket panel: get config:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if cfg.PanelChannelID == "" {
		http.Error(w, "panel_channel_id not configured", http.StatusBadRequest)
		return
	}
	msgID, err := sendTicketPanel(discordSession, cfg)
	if err != nil {
		log.Println("send ticket panel:", err)
		http.Error(w, "failed to send panel: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"panel_message_id": msgID})
}

// handleDiscordReactionRoles handles GET (list) and DELETE (remove) for reaction-role panels.
// GET  ?guild_id=
// DELETE ?guild_id=&id=
func handleDiscordReactionRoles(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		panels, err := GetReactionRolePanels(guildID)
		if err != nil {
			log.Println("get reaction role panels:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		// Normalise nil slices to empty arrays for JSON.
		type entryOut struct {
			ID       int64  `json:"id"`
			Emoji    string `json:"emoji"`
			RoleID   string `json:"role_id"`
			RoleName string `json:"role_name"`
		}
		type panelOut struct {
			ID          int64      `json:"id"`
			ChannelID   string     `json:"channel_id"`
			MessageID   string     `json:"message_id"`
			Title       string     `json:"title"`
			Description string     `json:"description"`
			Entries     []entryOut `json:"entries"`
		}
		out := []panelOut{}
		for _, p := range panels {
			po := panelOut{
				ID: p.ID, ChannelID: p.ChannelID, MessageID: p.MessageID,
				Title: p.Title, Description: p.Description, Entries: []entryOut{},
			}
			for _, e := range p.Entries {
				po.Entries = append(po.Entries, entryOut{ID: e.ID, Emoji: e.Emoji, RoleID: e.RoleID, RoleName: e.RoleName})
			}
			out = append(out, po)
		}
		json.NewEncoder(w).Encode(map[string]any{"panels": out})

	case http.MethodDelete:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		idStr := r.URL.Query().Get("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || guildID == "" {
			http.Error(w, "missing guild_id or id", http.StatusBadRequest)
			return
		}
		if err := DeleteReactionRolePanel(guildID, id); err != nil {
			log.Println("delete reaction role panel:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleDiscordReactionRolesSend creates/updates a panel in the DB, posts the
// embed to Discord, and adds bot reactions for each emoji.
// POST { guild_id, panel_id?, channel_id, title, description, entries:[{emoji,role_id,role_name}] }
func handleDiscordReactionRolesSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		GuildID     string `json:"guild_id"`
		PanelID     int64  `json:"panel_id"`
		ChannelID   string `json:"channel_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Entries     []struct {
			Emoji    string `json:"emoji"`
			RoleID   string `json:"role_id"`
			RoleName string `json:"role_name"`
		} `json:"entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if body.GuildID == "" || body.ChannelID == "" {
		http.Error(w, "missing guild_id or channel_id", http.StatusBadRequest)
		return
	}
	if len(body.Entries) == 0 {
		http.Error(w, "at least one entry required", http.StatusBadRequest)
		return
	}
	if discordSession == nil {
		http.Error(w, "discord not connected", http.StatusServiceUnavailable)
		return
	}

	title := body.Title
	if title == "" {
		title = "React for Roles"
	}
	desc := body.Description
	if desc == "" {
		desc = "React below to assign yourself a role."
	}

	// Save panel config to DB.
	panelID, err := CreateOrUpdateReactionRolePanel(body.GuildID, body.ChannelID, title, desc, body.PanelID)
	if err != nil {
		log.Println("create reaction role panel:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	entries := make([]*ReactionRoleEntry, 0, len(body.Entries))
	for _, e := range body.Entries {
		entries = append(entries, &ReactionRoleEntry{Emoji: e.Emoji, RoleID: e.RoleID, RoleName: e.RoleName})
	}
	if err := SetReactionRoleEntries(panelID, body.GuildID, entries); err != nil {
		log.Println("set reaction role entries:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// Post the embed to Discord (helper in discord_commands.go uses discordgo types).
	msgID, err := sendReactionRolePanel(discordSession, body.ChannelID, title, desc, entries)
	if err != nil {
		log.Println("send reaction role panel:", err)
		http.Error(w, "failed to post message: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := UpdateReactionRolePanelMessageID(panelID, msgID); err != nil {
		log.Println("update panel message id:", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"panel_id": panelID, "message_id": msgID})
}

// handleDiscordWelcomeSettings handles GET and POST for per-guild welcome
// channel, welcome message, and auto-role assignment on member join.
// GET  ?guild_id=  → {"welcome_channel_id":"...","welcome_message":"...","auto_role_ids":["...",...]}
// POST {guild_id, welcome_channel_id, welcome_message, auto_role_ids:[...]}
func handleDiscordWelcomeSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		s, err := GetDiscordWelcomeSettings(guildID)
		if err != nil {
			// No row yet — return empty defaults
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"welcome_channel_id":     "",
				"welcome_message":        "",
				"auto_role_ids":          []string{},
				"leave_channel_id":       "",
				"welcome_banner_enabled": false,
			})
			return
		}
		roleIDs := []string{}
		for _, id := range strings.Split(s.AutoRoleIDs, ",") {
			id = strings.TrimSpace(id)
			if id != "" {
				roleIDs = append(roleIDs, id)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"welcome_channel_id":     s.WelcomeChannelID,
			"welcome_message":        s.WelcomeMessage,
			"auto_role_ids":          roleIDs,
			"leave_channel_id":       s.LeaveChannelID,
			"welcome_banner_enabled": s.WelcomeBannerEnabled,
		})

	case http.MethodPost:
		var body struct {
			GuildID              string   `json:"guild_id"`
			WelcomeChannelID     string   `json:"welcome_channel_id"`
			WelcomeMessage       string   `json:"welcome_message"`
			AutoRoleIDs          []string `json:"auto_role_ids"`
			LeaveChannelID       string   `json:"leave_channel_id"`
			WelcomeBannerEnabled bool     `json:"welcome_banner_enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if body.GuildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		autoRoleStr := strings.Join(body.AutoRoleIDs, ",")
		if err := SaveDiscordWelcomeSettings(DiscordWelcomeSettings{
			GuildID:              body.GuildID,
			WelcomeChannelID:     body.WelcomeChannelID,
			WelcomeMessage:       body.WelcomeMessage,
			AutoRoleIDs:          autoRoleStr,
			LeaveChannelID:       body.LeaveChannelID,
			WelcomeBannerEnabled: body.WelcomeBannerEnabled,
		}); err != nil {
			log.Println("save discord welcome settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
