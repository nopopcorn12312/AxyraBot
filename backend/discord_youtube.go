package main

// YouTube upload notifications: a server connects one YouTube channel and picks
// the Discord channel that hears about new videos.
//
// YouTube publishes a public feed of each channel's 15 newest videos (including
// Shorts and streams, but not Community posts), so no API key is needed. The
// bot checks it every few minutes:
//   - Videos already on the channel when it's connected are never announced
//     (the baseline), and neither are videos uploaded while the setting was off.
//   - Video IDs that have been handled are saved, so restarts can't re-post them.
//   - A video that fails to post stays unhandled and is retried on the next check.
//   - At most youtubeMaxPostsPerCheck videos post per check, newest first, so
//     coming back from downtime can't flood the channel.

import (
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	youtubeCheckInterval    = 5 * time.Minute
	youtubeMaxPostsPerCheck = 3
	youtubeSeenLimit        = 50
	youtubeMaxPageBytes     = 3 << 20 // channel pages name their ID within the first megabyte or so
	youtubeMaxFeedBytes     = 2 << 20

	// discordDefaultYouTubeTemplate is the default upload message. The dashboard
	// shows the same text (frontend/app/discord/settings/page.tsx).
	discordDefaultYouTubeTemplate = "📺 **$(channel)** posted a new video!\n$(title)\n$(url)"
)

// youtubeBaseURL is replaced in tests.
var youtubeBaseURL = "https://www.youtube.com"

var (
	youtubeHTTPClient = &http.Client{Timeout: 15 * time.Second}
	youtubeChannelID  = regexp.MustCompile(`^UC[A-Za-z0-9_-]{22}$`)
	youtubeName       = regexp.MustCompile(`^[\p{L}\p{N}._·-]{1,100}$`)
	youtubeCanonical  = regexp.MustCompile(`<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[A-Za-z0-9_-]{22})"`)

	errYouTubeNotFound = errors.New("we couldn't find that YouTube channel. Paste your channel's link, like youtube.com/@yourname")
	errYouTubeBadInput = errors.New("that doesn't look like a YouTube channel. Paste your channel's link, like youtube.com/@yourname")
)

// parseYouTubeChannelInput reads what someone pasted: a channel link, an
// @handle, or a channel ID. It returns either the channel ID or the page path
// to look the ID up from. Only values that can't escape youtube.com get through.
func parseYouTubeChannelInput(input string) (channelID, pagePath string, err error) {
	s := strings.TrimSpace(input)
	lower := strings.ToLower(s)
	for _, prefix := range []string{"https://", "http://"} {
		if strings.HasPrefix(lower, prefix) {
			s = s[len(prefix):]
			lower = lower[len(prefix):]
			break
		}
	}
	for _, prefix := range []string{"www.", "m."} {
		if strings.HasPrefix(lower, prefix) {
			s = s[len(prefix):]
			lower = lower[len(prefix):]
			break
		}
	}
	if strings.HasPrefix(lower, "youtube.com/") {
		s = s[len("youtube.com/"):]
		if i := strings.IndexAny(s, "?#"); i >= 0 {
			s = s[:i]
		}
		parts := strings.Split(strings.Trim(s, "/"), "/")
		for _, part := range parts {
			if part == "." || part == ".." {
				return "", "", errYouTubeBadInput
			}
		}
		switch {
		case len(parts) >= 2 && parts[0] == "channel" && youtubeChannelID.MatchString(parts[1]):
			return parts[1], "", nil
		case len(parts) >= 2 && (parts[0] == "c" || parts[0] == "user") && validYouTubeName(parts[1]):
			return "", parts[0] + "/" + url.PathEscape(parts[1]), nil
		case len(parts) >= 1 && strings.HasPrefix(parts[0], "@") && validYouTubeName(parts[0][1:]):
			return "", "@" + url.PathEscape(parts[0][1:]), nil
		}
		return "", "", errYouTubeBadInput
	}
	if youtubeChannelID.MatchString(s) {
		return s, "", nil
	}
	// Without an @, text with a dot is more likely a website than a handle.
	if name := strings.TrimPrefix(s, "@"); validYouTubeName(name) && (name != s || !strings.Contains(s, ".")) {
		return "", "@" + url.PathEscape(name), nil
	}
	return "", "", errYouTubeBadInput
}

// validYouTubeName accepts handle characters, but not names made only of
// punctuation like "..".
func validYouTubeName(name string) bool {
	return youtubeName.MatchString(name) && strings.Trim(name, "._·-") != ""
}

type youtubeVideo struct {
	ID        string
	Title     string
	URL       string
	Published time.Time
}

type youtubeFeed struct {
	ChannelName string
	Videos      []youtubeVideo
}

func parseYouTubeFeed(data []byte) (*youtubeFeed, error) {
	var raw struct {
		Title   string `xml:"title"`
		Entries []struct {
			VideoID string `xml:"videoId"`
			Title   string `xml:"title"`
			Links   []struct {
				Href string `xml:"href,attr"`
			} `xml:"link"`
			Published string `xml:"published"`
		} `xml:"entry"`
	}
	if err := xml.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	feed := &youtubeFeed{ChannelName: strings.TrimSpace(raw.Title)}
	for _, e := range raw.Entries {
		published, err := time.Parse(time.RFC3339, strings.TrimSpace(e.Published))
		if err != nil || e.VideoID == "" {
			continue
		}
		video := youtubeVideo{ID: e.VideoID, Title: strings.TrimSpace(e.Title), Published: published,
			URL: "https://www.youtube.com/watch?v=" + url.QueryEscape(e.VideoID)}
		// Shorts link to their own /shorts/ page.
		for _, link := range e.Links {
			if strings.HasPrefix(link.Href, "https://www.youtube.com/") {
				video.URL = link.Href
				break
			}
		}
		feed.Videos = append(feed.Videos, video)
	}
	return feed, nil
}

func youtubeGet(path string, limit int64) ([]byte, int, error) {
	req, err := http.NewRequest(http.MethodGet, youtubeBaseURL+path, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; AxyraBot)")
	// Skips the cookie consent page YouTube shows in some regions.
	req.Header.Set("Cookie", "SOCS=CAI")
	resp, err := youtubeHTTPClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit))
	return body, resp.StatusCode, err
}

func fetchYouTubeFeed(channelID string) (*youtubeFeed, error) {
	body, status, err := youtubeGet("/feeds/videos.xml?channel_id="+url.QueryEscape(channelID), youtubeMaxFeedBytes)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, errYouTubeNotFound
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("youtube feed status %d", status)
	}
	return parseYouTubeFeed(body)
}

// resolveYouTubeChannel turns what someone pasted into a channel ID and its
// current feed, which also proves the channel exists.
func resolveYouTubeChannel(input string) (string, *youtubeFeed, error) {
	channelID, pagePath, err := parseYouTubeChannelInput(input)
	if err != nil {
		return "", nil, err
	}
	if channelID == "" {
		page, status, err := youtubeGet("/"+pagePath, youtubeMaxPageBytes)
		if err != nil {
			return "", nil, err
		}
		if status == http.StatusNotFound {
			return "", nil, errYouTubeNotFound
		}
		if status != http.StatusOK {
			return "", nil, fmt.Errorf("youtube page status %d", status)
		}
		match := youtubeCanonical.FindSubmatch(page)
		if match == nil {
			return "", nil, errYouTubeNotFound
		}
		channelID = string(match[1])
	}
	feed, err := fetchYouTubeFeed(channelID)
	if err != nil {
		return "", nil, err
	}
	return channelID, feed, nil
}

// planYouTubePosts decides what a check should do. It returns the videos to
// post, oldest first, and the IDs to mark handled without posting.
func planYouTubePosts(videos []youtubeVideo, seen []string, baseline time.Time) (post []youtubeVideo, skip []string) {
	known := make(map[string]bool, len(seen))
	for _, id := range seen {
		known[id] = true
	}
	for _, v := range videos {
		switch {
		case known[v.ID]:
		case v.Published.After(baseline):
			post = append(post, v)
		default:
			// An older video resurfacing, e.g. because a newer one was deleted.
			skip = append(skip, v.ID)
		}
	}
	sort.SliceStable(post, func(i, j int) bool { return post[i].Published.Before(post[j].Published) })
	if extra := len(post) - youtubeMaxPostsPerCheck; extra > 0 {
		for _, v := range post[:extra] {
			skip = append(skip, v.ID)
		}
		post = post[extra:]
	}
	return post, skip
}

// youtubeTemplateVars makes the video's details safe to quote: titles are
// written by whoever owns the channel, so they must not ping anyone or be read
// as Discord formatting. The server's own template can still mention people.
func youtubeTemplateVars(channelName string, v youtubeVideo) map[string]string {
	safe := func(s string) string {
		return strings.ReplaceAll(discordEscapeMarkdown(s), "@", "@​")
	}
	return map[string]string{"channel": safe(channelName), "title": safe(v.Title), "url": v.URL}
}

// mergeYouTubeSeen adds handled IDs, keeping the newest youtubeSeenLimit.
func mergeYouTubeSeen(seen []string, ids ...string) []string {
	seen = append(seen, ids...)
	if extra := len(seen) - youtubeSeenLimit; extra > 0 {
		seen = seen[extra:]
	}
	return seen
}

// newYouTubeBaseline returns the starting point for a newly connected channel:
// everything in the feed right now counts as already handled.
func newYouTubeBaseline(feed *youtubeFeed, now time.Time) ([]string, time.Time) {
	seen := []string{}
	baseline := now
	for i, v := range feed.Videos {
		seen = append(seen, v.ID)
		if i == 0 || v.Published.After(baseline) {
			baseline = v.Published
		}
	}
	return mergeYouTubeSeen(seen), baseline
}

// ── Database ────────────────────────────────────────────────────────────────

// DiscordYouTubeSettings is a server's YouTube upload notification setup.
type DiscordYouTubeSettings struct {
	GuildID          string
	YouTubeChannelID string
	YouTubeName      string
	DiscordChannelID string // empty means notifications are off
	Seen             []string
	Baseline         time.Time
}

// EnsureDiscordYouTubeTable creates the settings table if it does not exist.
func EnsureDiscordYouTubeTable() error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS discord_youtube_settings (
		guild_id           TEXT        PRIMARY KEY,
		youtube_channel_id TEXT        NOT NULL,
		youtube_name       TEXT        NOT NULL DEFAULT '',
		discord_channel_id TEXT        NOT NULL DEFAULT '',
		seen_video_ids     TEXT        NOT NULL DEFAULT '[]',
		baseline_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
		updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
	);`)
	return err
}

const discordYouTubeColumns = `guild_id, youtube_channel_id, youtube_name, discord_channel_id, seen_video_ids, baseline_at`

func scanDiscordYouTube(scan func(...any) error) (*DiscordYouTubeSettings, error) {
	var s DiscordYouTubeSettings
	var seen string
	if err := scan(&s.GuildID, &s.YouTubeChannelID, &s.YouTubeName, &s.DiscordChannelID, &seen, &s.Baseline); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(seen), &s.Seen); err != nil {
		log.Printf("discord youtube settings for %s have unreadable video IDs: %v", s.GuildID, err)
	}
	return &s, nil
}

// GetDiscordYouTubeSettings returns a server's settings, or nil if it has none.
func GetDiscordYouTubeSettings(guildID string) (*DiscordYouTubeSettings, error) {
	if db == nil {
		return nil, nil
	}
	s, err := scanDiscordYouTube(db.QueryRow(`SELECT `+discordYouTubeColumns+` FROM discord_youtube_settings WHERE guild_id = $1`, guildID).Scan)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return s, err
}

// ListActiveDiscordYouTubeSettings returns every server with notifications on.
func ListActiveDiscordYouTubeSettings() ([]*DiscordYouTubeSettings, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT ` + discordYouTubeColumns + ` FROM discord_youtube_settings WHERE discord_channel_id <> ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []*DiscordYouTubeSettings
	for rows.Next() {
		s, err := scanDiscordYouTube(rows.Scan)
		if err != nil {
			return nil, err
		}
		res = append(res, s)
	}
	return res, rows.Err()
}

// SaveDiscordYouTubeSettings stores a server's settings.
func SaveDiscordYouTubeSettings(s *DiscordYouTubeSettings) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	seen, _ := json.Marshal(s.Seen)
	_, err := db.Exec(`
	INSERT INTO discord_youtube_settings (guild_id, youtube_channel_id, youtube_name, discord_channel_id, seen_video_ids, baseline_at)
	VALUES ($1, $2, $3, $4, $5, $6)
	ON CONFLICT (guild_id) DO UPDATE SET
		youtube_channel_id = EXCLUDED.youtube_channel_id,
		youtube_name       = EXCLUDED.youtube_name,
		discord_channel_id = EXCLUDED.discord_channel_id,
		seen_video_ids     = EXCLUDED.seen_video_ids,
		baseline_at        = EXCLUDED.baseline_at,
		updated_at         = now()`,
		s.GuildID, s.YouTubeChannelID, s.YouTubeName, s.DiscordChannelID, string(seen), s.Baseline)
	return err
}

// DeleteDiscordYouTubeSettings disconnects a server's YouTube channel.
func DeleteDiscordYouTubeSettings(guildID string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_youtube_settings WHERE guild_id = $1`, guildID)
	return err
}

// saveDiscordYouTubeProgress stores only the handled videos and channel name,
// so a check running during a dashboard save can't undo the new settings.
func saveDiscordYouTubeProgress(s *DiscordYouTubeSettings) error {
	if db == nil {
		return nil
	}
	seen, _ := json.Marshal(s.Seen)
	_, err := db.Exec(`UPDATE discord_youtube_settings SET seen_video_ids = $3, youtube_name = $4 WHERE guild_id = $1 AND youtube_channel_id = $2`,
		s.GuildID, s.YouTubeChannelID, string(seen), s.YouTubeName)
	return err
}

// ── Checking for new videos ─────────────────────────────────────────────────

// StartDiscordYouTubeNotifier checks for new videos on a timer.
func StartDiscordYouTubeNotifier() {
	if err := EnsureDiscordYouTubeTable(); err != nil {
		log.Println("failed to ensure discord_youtube_settings table:", err)
	}
	ticker := time.NewTicker(youtubeCheckInterval)
	defer ticker.Stop()
	for range ticker.C {
		checkDiscordYouTubeChannels()
	}
}

func checkDiscordYouTubeChannels() {
	if discordSession == nil {
		return
	}
	settings, err := ListActiveDiscordYouTubeSettings()
	if err != nil {
		log.Println("[YouTube] load settings:", err)
		return
	}
	// Servers sharing a YouTube channel share one feed request.
	feeds := map[string]*youtubeFeed{}
	for _, s := range settings {
		feed, fetched := feeds[s.YouTubeChannelID]
		if !fetched {
			if feed, err = fetchYouTubeFeed(s.YouTubeChannelID); err != nil {
				log.Printf("[YouTube] feed for %s: %v", s.YouTubeChannelID, err)
			}
			feeds[s.YouTubeChannelID] = feed
		}
		if feed != nil && ChannelInGuild(s.GuildID, s.DiscordChannelID) {
			postNewYouTubeVideos(s, feed)
		}
	}
}

func postNewYouTubeVideos(s *DiscordYouTubeSettings, feed *youtubeFeed) {
	post, skip := planYouTubePosts(feed.Videos, s.Seen, s.Baseline)
	changed := len(skip) > 0
	seen := mergeYouTubeSeen(s.Seen, skip...)
	if len(post) > 0 {
		tmpl := loadDiscordTemplate("", s.GuildID, "youtube", discordDefaultYouTubeTemplate)
		for _, video := range post {
			msg := fillDiscordTemplate(tmpl, youtubeTemplateVars(feed.ChannelName, video))
			if _, err := discordSession.ChannelMessageSend(s.DiscordChannelID, msg); err != nil {
				log.Printf("[YouTube] post video %s in guild %s: %v", video.ID, s.GuildID, err)
				break // left unhandled, so the next check tries again
			}
			seen = mergeYouTubeSeen(seen, video.ID)
			changed = true
		}
	}
	if feed.ChannelName != "" && feed.ChannelName != s.YouTubeName {
		s.YouTubeName = feed.ChannelName
		changed = true
	}
	if changed {
		s.Seen = seen
		if err := saveDiscordYouTubeProgress(s); err != nil {
			log.Println("[YouTube] save progress:", err)
		}
	}
}

// ── HTTP ────────────────────────────────────────────────────────────────────

// handleDiscordYouTube reads (GET) or changes (POST) a server's settings.
func handleDiscordYouTube(w http.ResponseWriter, r *http.Request) {
	if err := EnsureDiscordYouTubeTable(); err != nil {
		log.Println("discord youtube table ensure failed:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	switch r.Method {
	case http.MethodGet:
		guildID := strings.TrimSpace(r.URL.Query().Get("guild_id"))
		if guildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		s, err := GetDiscordYouTubeSettings(guildID)
		if err != nil {
			log.Println("get discord youtube settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		writeDiscordYouTubeJSON(w, s)
	case http.MethodPost:
		var body struct {
			GuildID          string `json:"guild_id"`
			YouTubeChannel   string `json:"youtube_channel"`
			DiscordChannelID string `json:"discord_channel_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		body.YouTubeChannel = strings.TrimSpace(body.YouTubeChannel)
		body.DiscordChannelID = strings.TrimSpace(body.DiscordChannelID)
		if body.GuildID == "" {
			http.Error(w, "missing guild_id", http.StatusBadRequest)
			return
		}
		if !requireGuildChannels(w, body.GuildID, body.DiscordChannelID) {
			return
		}
		if body.YouTubeChannel == "" {
			if body.DiscordChannelID != "" {
				http.Error(w, "add your YouTube channel to turn on upload notifications", http.StatusBadRequest)
				return
			}
			if err := DeleteDiscordYouTubeSettings(body.GuildID); err != nil {
				log.Println("delete discord youtube settings:", err)
				http.Error(w, "db error", http.StatusInternalServerError)
				return
			}
			writeDiscordYouTubeJSON(w, nil)
			return
		}
		channelID, feed, err := resolveYouTubeChannel(body.YouTubeChannel)
		switch {
		case errors.Is(err, errYouTubeBadInput), errors.Is(err, errYouTubeNotFound):
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		case err != nil:
			log.Println("resolve youtube channel:", err)
			http.Error(w, "YouTube didn't respond. Please try again in a moment.", http.StatusBadGateway)
			return
		}
		existing, err := GetDiscordYouTubeSettings(body.GuildID)
		if err != nil {
			log.Println("get discord youtube settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		saved := &DiscordYouTubeSettings{GuildID: body.GuildID, YouTubeChannelID: channelID, YouTubeName: feed.ChannelName, DiscordChannelID: body.DiscordChannelID}
		if existing != nil && existing.YouTubeChannelID == channelID && existing.DiscordChannelID != "" {
			// Same channel, still on: keep what's been handled.
			saved.Seen, saved.Baseline = existing.Seen, existing.Baseline
		} else {
			// Newly connected or turned back on: only videos from now on count.
			saved.Seen, saved.Baseline = newYouTubeBaseline(feed, time.Now())
		}
		if err := SaveDiscordYouTubeSettings(saved); err != nil {
			log.Println("save discord youtube settings:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		writeDiscordYouTubeJSON(w, saved)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func writeDiscordYouTubeJSON(w http.ResponseWriter, s *DiscordYouTubeSettings) {
	out := map[string]string{"youtube_channel_id": "", "youtube_name": "", "discord_channel_id": ""}
	if s != nil {
		out["youtube_channel_id"] = s.YouTubeChannelID
		out["youtube_name"] = s.YouTubeName
		out["discord_channel_id"] = s.DiscordChannelID
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
