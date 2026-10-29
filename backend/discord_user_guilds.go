package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Which Discord servers a dashboard user can manage comes from one
// /users/@me/guilds call with their own OAuth token (the "guilds" scope),
// instead of asking Discord about their membership in every server the bot
// is in. The answer is cached briefly so a dashboard load, which fires many
// guild-scoped requests at once, costs a single Discord call.

const manageableGuildsTTL = time.Minute

const (
	discordPermAdministrator = 1 << 3
	discordPermManageGuild   = 1 << 5
)

type manageableGuildsEntry struct {
	ids     map[string]bool
	expires time.Time
}

var (
	manageableGuildsMu    sync.Mutex
	manageableGuildsCache = map[string]manageableGuildsEntry{}
	// manageableGuildsLocks makes concurrent requests for the same user wait
	// for one Discord call instead of each making their own.
	manageableGuildsLocks = map[string]*sync.Mutex{}
)

// GetManageableDiscordGuilds returns the IDs of servers where the Twitch
// user's linked Discord account is the owner or has Administrator / Manage
// Server. linked is false when they haven't linked a Discord account.
func GetManageableDiscordGuilds(twitchLogin string) (ids map[string]bool, linked bool) {
	twitchLogin = strings.ToLower(twitchLogin)

	manageableGuildsMu.Lock()
	if e, ok := manageableGuildsCache[twitchLogin]; ok && time.Now().Before(e.expires) {
		manageableGuildsMu.Unlock()
		return e.ids, true
	}
	userLock, ok := manageableGuildsLocks[twitchLogin]
	if !ok {
		userLock = &sync.Mutex{}
		manageableGuildsLocks[twitchLogin] = userLock
	}
	manageableGuildsMu.Unlock()

	userLock.Lock()
	defer userLock.Unlock()

	// Another request may have filled the cache while we waited.
	manageableGuildsMu.Lock()
	if e, ok := manageableGuildsCache[twitchLogin]; ok && time.Now().Before(e.expires) {
		manageableGuildsMu.Unlock()
		return e.ids, true
	}
	manageableGuildsMu.Unlock()

	link, err := GetDiscordUserLink(twitchLogin)
	if err != nil {
		log.Printf("load discord link for %s: %v", twitchLogin, err)
		return nil, false
	}
	if link == nil || link.AccessToken == "" {
		return nil, false
	}

	if time.Now().Add(time.Minute).After(link.ExpiresAt) {
		if err := refreshDiscordUserToken(twitchLogin, link); err != nil {
			log.Printf("refresh discord token for %s: %v", twitchLogin, err)
			return nil, true
		}
	}

	ids, status, err := fetchManageableGuilds(link.AccessToken)
	if status == http.StatusUnauthorized {
		// The user revoked access in Discord; make them link again.
		if err := DeleteDiscordUserLink(twitchLogin); err != nil {
			log.Printf("delete revoked discord link for %s: %v", twitchLogin, err)
		}
		return nil, false
	}
	if err != nil {
		log.Printf("list discord guilds for %s: %v", twitchLogin, err)
		return nil, true
	}

	manageableGuildsMu.Lock()
	manageableGuildsCache[twitchLogin] = manageableGuildsEntry{ids: ids, expires: time.Now().Add(manageableGuildsTTL)}
	manageableGuildsMu.Unlock()
	return ids, true
}

// InvalidateManageableDiscordGuilds drops the cached server list so the next
// lookup sees a just-added bot or a newly linked account.
func InvalidateManageableDiscordGuilds(twitchLogin string) {
	manageableGuildsMu.Lock()
	delete(manageableGuildsCache, strings.ToLower(twitchLogin))
	manageableGuildsMu.Unlock()
}

func fetchManageableGuilds(accessToken string) (map[string]bool, int, error) {
	ids := map[string]bool{}
	after := ""
	for {
		u := "https://discord.com/api/users/@me/guilds?limit=200"
		if after != "" {
			u += "&after=" + after
		}
		req, _ := http.NewRequest(http.MethodGet, u, nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, 0, err
		}
		var page []struct {
			ID          string `json:"id"`
			Owner       bool   `json:"owner"`
			Permissions string `json:"permissions"`
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, resp.StatusCode, fmt.Errorf("status %d", resp.StatusCode)
		}
		err = json.NewDecoder(resp.Body).Decode(&page)
		resp.Body.Close()
		if err != nil {
			return nil, resp.StatusCode, err
		}
		for _, g := range page {
			perms, _ := strconv.ParseInt(g.Permissions, 10, 64)
			if g.Owner || perms&discordPermAdministrator != 0 || perms&discordPermManageGuild != 0 {
				ids[g.ID] = true
			}
		}
		if len(page) < 200 {
			return ids, http.StatusOK, nil
		}
		after = page[len(page)-1].ID
	}
}

// discordTokenResponse is the shape of Discord's /oauth2/token response.
type discordTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	Guild        *struct {
		ID string `json:"id"`
	} `json:"guild"`
}

func exchangeDiscordToken(v url.Values) (*discordTokenResponse, error) {
	v.Set("client_id", discordOAuthClientID())
	v.Set("client_secret", os.Getenv("DISCORD_CLIENT_SECRET"))
	resp, err := http.PostForm("https://discord.com/api/oauth2/token", v)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var tok discordTokenResponse
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, err
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("empty access token")
	}
	return &tok, nil
}

func refreshDiscordUserToken(twitchLogin string, link *DiscordUserLink) error {
	if link.RefreshToken == "" {
		return fmt.Errorf("no refresh token")
	}
	v := url.Values{}
	v.Set("grant_type", "refresh_token")
	v.Set("refresh_token", link.RefreshToken)
	tok, err := exchangeDiscordToken(v)
	if err != nil {
		return err
	}
	link.AccessToken = tok.AccessToken
	if tok.RefreshToken != "" {
		link.RefreshToken = tok.RefreshToken
	}
	link.ExpiresAt = time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second)
	return SetDiscordUserLink(twitchLogin, *link)
}
