package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
)

func startHTTPServer(clientID, clientSecret string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/start", handleAuthStart(clientID))
	mux.HandleFunc("/auth/callback", handleAuthCallback(clientID, clientSecret))
	mux.HandleFunc("/join", handleJoin)
	mux.HandleFunc("/channels", handleChannels)
	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Println("starting HTTP server on", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Println("http server error:", err)
	}
}

func handleAuthStart(clientID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		redirect := r.URL.Query().Get("redirect")
		state := "state123" // TODO: generate/validate
		// For broadcaster authorization, only request channel:bot so Twitch
		// shows a single permission: "Join your channel's chat as a bot user."
		scopes := "channel:bot"
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
		// store in DB: add channel and save tokens
		if db != nil {
			if err := AddOrUpdateChannel(login, login); err != nil {
				log.Println("failed add channel to db:", err)
			}
			if err := SaveUserTokens(login, access, refresh); err != nil {
				log.Println("failed save user tokens:", err)
			}
			// Immediately ensure the bot joins this channel without waiting
			// for the Postgres LISTEN/NOTIFY loop.
			handleChannelsChanged(login)
		}

		// If a redirect URL was provided (and preserved through the Twitch OAuth
		// roundtrip), send the user back to the frontend with the login attached
		// as a query parameter.
		if redir := r.URL.Query().Get("redirect"); redir != "" {
			if dest, err := url.Parse(redir); err == nil {
				q := dest.Query()
				q.Set("login", login)
				dest.RawQuery = q.Encode()
				http.Redirect(w, r, dest.String(), http.StatusFound)
				return
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
		if err := AddOrUpdateChannel(body.Login, "web"); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}
	// signal bot to join: for simplicity, spawn a goroutine
	// NOTE: this creates a new bot connection per channel
	botName := os.Getenv("TWITCH_BOT_USERNAME")
	oauth := os.Getenv("TWITCH_BOT_OAUTH")
	go startIrcBot(botName, oauth, body.Login)
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
