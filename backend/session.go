package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Session tokens prove which Twitch user a dashboard request comes from. They
// are issued after Twitch OAuth and signed with SESSION_SECRET, so a request
// can no longer act as a channel just by putting its login in the URL.

const sessionTTL = 30 * 24 * time.Hour

var (
	sessionKeyOnce sync.Once
	sessionKey     []byte
)

func getSessionKey() []byte {
	sessionKeyOnce.Do(func() {
		if s := os.Getenv("SESSION_SECRET"); s != "" {
			sessionKey = []byte(s)
			return
		}
		sessionKey = make([]byte, 32)
		if _, err := crand.Read(sessionKey); err != nil {
			log.Fatal("[auth] failed to generate session key:", err)
		}
		log.Println("[auth] SESSION_SECRET not set; using a random key, so everyone is logged out on restart")
	})
	return sessionKey
}

// signValue returns "<payload>.<signature>" with both parts base64url-encoded.
// kind is mixed into the signature so a token of one kind (e.g. an OAuth
// state) can never be replayed as another (e.g. a session).
func signValue(kind, payload string, ttl time.Duration) string {
	body := payload + "|" + strconv.FormatInt(time.Now().Add(ttl).Unix(), 10)
	mac := hmac.New(sha256.New, getSessionKey())
	mac.Write([]byte(kind + "|" + body))
	return base64.RawURLEncoding.EncodeToString([]byte(body)) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// verifySigned checks a value produced by signValue and returns its payload.
func verifySigned(kind, token string) (string, bool) {
	bodyPart, sigPart, ok := strings.Cut(token, ".")
	if !ok {
		return "", false
	}
	body, err := base64.RawURLEncoding.DecodeString(bodyPart)
	if err != nil {
		return "", false
	}
	sig, err := base64.RawURLEncoding.DecodeString(sigPart)
	if err != nil {
		return "", false
	}
	mac := hmac.New(sha256.New, getSessionKey())
	mac.Write([]byte(kind + "|"))
	mac.Write(body)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return "", false
	}
	idx := bytes.LastIndexByte(body, '|')
	if idx < 0 {
		return "", false
	}
	exp, err := strconv.ParseInt(string(body[idx+1:]), 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return "", false
	}
	return string(body[:idx]), true
}

func issueSession(login string) string {
	return signValue("session", strings.ToLower(login), sessionTTL)
}

// sessionFromRequest returns the logged-in Twitch login, or "" if the request
// has no valid session token.
func sessionFromRequest(r *http.Request) string {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok {
		return ""
	}
	login, ok := verifySigned("session", strings.TrimSpace(token))
	if !ok {
		return ""
	}
	return login
}

type sessionLoginKey struct{}

// sessionLogin returns the viewer that withAuth verified for this request.
func sessionLogin(r *http.Request) string {
	login, _ := r.Context().Value(sessionLoginKey{}).(string)
	return login
}

type authMode int

const (
	// authChannel: any "login" must be the viewer or a channel they're an Editor of.
	authChannel authMode = iota
	// authSelf: any "login" must be the viewer themselves.
	authSelf
	// authGuild: "login" names someone else (e.g. a manager being added), so
	// only guild_id is checked.
	authGuild
	// authPublicRead: GETs are open to anyone (e.g. a channel's command list
	// shared via !commands); other methods are checked like authChannel.
	authPublicRead
)

// withAuth wraps a dashboard handler with CORS plus session checks. It looks
// at the login, viewer_login and guild_id values in the query string and JSON
// body and rejects the request unless the session's viewer may act on them.
func withAuth(mode authMode, h http.HandlerFunc) http.HandlerFunc {
	return withCORS(func(w http.ResponseWriter, r *http.Request) {
		if mode == authPublicRead && r.Method == http.MethodGet {
			h(w, r)
			return
		}
		viewer := sessionFromRequest(r)
		if viewer == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		logins, viewerLogins, guildIDs, err := requestTargets(r)
		if err != nil {
			http.Error(w, "bad request body", http.StatusBadRequest)
			return
		}
		for _, v := range viewerLogins {
			if v != viewer {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		if mode != authGuild {
			for _, login := range logins {
				allowed := login == viewer
				if !allowed && mode != authSelf {
					isEditor, err := IsEditorOf(viewer, login)
					if err != nil {
						log.Println("check editor role:", err)
					}
					allowed = isEditor
				}
				if !allowed {
					http.Error(w, "forbidden", http.StatusForbidden)
					return
				}
			}
		}
		for _, guildID := range guildIDs {
			if !CanAccessGuild(viewer, guildID) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		h(w, r.WithContext(context.WithValue(r.Context(), sessionLoginKey{}, viewer)))
	})
}

// requestTargets collects the identity fields a request refers to. The JSON
// body is read and then restored so the wrapped handler can decode it again.
func requestTargets(r *http.Request) (logins, viewerLogins, guildIDs []string, err error) {
	add := func(list []string, v string) []string {
		v = strings.ToLower(strings.TrimSpace(v))
		if v == "" {
			return list
		}
		return append(list, v)
	}
	q := r.URL.Query()
	logins = add(logins, q.Get("login"))
	viewerLogins = add(viewerLogins, q.Get("viewer_login"))
	guildIDs = add(guildIDs, q.Get("guild_id"))

	if r.Body == nil || r.Method == http.MethodGet {
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 10<<20))
	r.Body.Close()
	if err != nil {
		return nil, nil, nil, err
	}
	r.Body = io.NopCloser(bytes.NewReader(raw))
	if len(bytes.TrimSpace(raw)) == 0 {
		return
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		// Not a JSON object; the handler will reject it on its own.
		return
	}
	str := func(key string) string {
		var s string
		if v, ok := fields[key]; ok {
			json.Unmarshal(v, &s)
		}
		return s
	}
	logins = add(logins, str("login"))
	viewerLogins = add(viewerLogins, str("viewer_login"))
	guildIDs = add(guildIDs, str("guild_id"))
	return
}

// CanAccessGuild reports whether the viewer may manage a Discord server's
// dashboard settings: they were granted access as a manager, or their linked
// Discord account owns it or has Administrator / Manage Server there.
func CanAccessGuild(viewer, guildID string) bool {
	ids, err := GetGuildsForManager(viewer)
	if err != nil {
		log.Println("get guilds for manager:", err)
	}
	for _, id := range ids {
		if id == guildID {
			return true
		}
	}
	manageable, _ := GetManageableDiscordGuilds(viewer)
	return manageable[guildID]
}

// safeFrontendRedirect only allows redirects back to our own frontend (or a
// local dev server) so the OAuth flows can't be used as open redirects.
func safeFrontendRedirect(raw, fallbackPath string) string {
	fallback := getFrontendBaseURL() + fallbackPath
	if raw == "" {
		return fallback
	}
	dest, err := url.Parse(raw)
	if err != nil || (dest.Scheme != "http" && dest.Scheme != "https") {
		return fallback
	}
	if base, err := url.Parse(getFrontendBaseURL()); err == nil && strings.EqualFold(dest.Host, base.Host) {
		return dest.String()
	}
	if h := dest.Hostname(); h == "localhost" || h == "127.0.0.1" {
		return dest.String()
	}
	return fallback
}
