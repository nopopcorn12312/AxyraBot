package main

// Chat timers: messages the bot posts on a schedule, e.g. "Follow the
// channel!" every 15 minutes.
//
// Scheduling rules (kept deliberately simple so they are easy to explain):
//   - Each timer has its own clock. It first comes due one full interval after
//     it is created, enabled, or seen after a server start.
//   - When a timer comes due it either sends one message or is skipped. A
//     skip happens when the bot isn't in the channel, the stream is offline
//     (for "only while live" timers), or chat was too quiet: fewer than
//     MinChatLines viewer messages in the last ActivityWindowMinutes (a
//     rolling window).
//   - Sent or skipped, the clock restarts and the timer waits a full interval
//     again. Overdue timers therefore never send a burst of catch-up messages
//     after inactivity, downtime or a reconnect.
//   - Timers in the same channel are kept at least timerChannelGap apart; a
//     timer that comes due inside that gap waits for the next tick.

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	timerTick            = 15 * time.Second
	timerChannelGap      = 30 * time.Second
	timerMaxPerChannel   = 25
	timerMaxMessages     = 10
	timerMaxNameLen      = 50
	twitchMaxMessageLen  = 500
	timerMinInterval     = 5
	timerMaxInterval     = 1440
	timerMaxChatLines    = 1000
	timerMaxWindow       = 120
	timerDefaultWindow   = 10
	timerSelectRotate    = "rotate"
	timerSelectRandom    = "random"
	timerSkipNotJoined   = "bot not in channel"
	timerSkipOffline     = "stream offline"
	timerSkipQuietChat   = "not enough chat activity"
	timerSkipEmptyRender = "message was empty"
)

// ChatTimer is one configured timer.
type ChatTimer struct {
	ID                    int64     `json:"id"`
	Login                 string    `json:"login"`
	Name                  string    `json:"name"`
	Messages              []string  `json:"messages"`
	SelectionMode         string    `json:"selection_mode"`
	IntervalMinutes       int       `json:"interval_minutes"`
	MinChatLines          int       `json:"min_chat_lines"`
	ActivityWindowMinutes int       `json:"activity_window_minutes"`
	OnlineOnly            bool      `json:"online_only"`
	Enabled               bool      `json:"enabled"`
	RotationIndex         int       `json:"-"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// normalizeChatTimer trims and validates a timer submitted from the dashboard.
// It fills defaults and returns a user-facing error for anything invalid.
func normalizeChatTimer(t *ChatTimer) error {
	t.Login = strings.ToLower(strings.TrimSpace(t.Login))
	t.Name = strings.TrimSpace(t.Name)
	if t.Login == "" {
		return fmt.Errorf("missing login")
	}
	if t.Name == "" {
		return fmt.Errorf("give the timer a name")
	}
	if utf8.RuneCountInString(t.Name) > timerMaxNameLen {
		return fmt.Errorf("timer names can be at most %d characters", timerMaxNameLen)
	}
	msgs := make([]string, 0, len(t.Messages))
	for _, m := range t.Messages {
		m = strings.TrimSpace(m)
		if m == "" {
			continue
		}
		if utf8.RuneCountInString(m) > twitchMaxMessageLen {
			return fmt.Errorf("messages can be at most %d characters (Twitch's limit)", twitchMaxMessageLen)
		}
		msgs = append(msgs, m)
	}
	if len(msgs) == 0 {
		return fmt.Errorf("add at least one message")
	}
	if len(msgs) > timerMaxMessages {
		return fmt.Errorf("a timer can have at most %d messages", timerMaxMessages)
	}
	t.Messages = msgs
	switch t.SelectionMode {
	case timerSelectRotate, timerSelectRandom:
	case "":
		t.SelectionMode = timerSelectRotate
	default:
		return fmt.Errorf("unknown message order %q", t.SelectionMode)
	}
	if t.IntervalMinutes < timerMinInterval || t.IntervalMinutes > timerMaxInterval {
		return fmt.Errorf("interval must be between %d and %d minutes", timerMinInterval, timerMaxInterval)
	}
	if t.MinChatLines < 0 || t.MinChatLines > timerMaxChatLines {
		return fmt.Errorf("minimum chat messages must be between 0 and %d", timerMaxChatLines)
	}
	if t.ActivityWindowMinutes == 0 {
		t.ActivityWindowMinutes = timerDefaultWindow
	}
	if t.ActivityWindowMinutes < 1 || t.ActivityWindowMinutes > timerMaxWindow {
		return fmt.Errorf("activity window must be between 1 and %d minutes", timerMaxWindow)
	}
	return nil
}

// ── Database ────────────────────────────────────────────────────────────────

// EnsureChatTimersTable creates the chat_timers table if it does not exist.
func EnsureChatTimersTable() error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS chat_timers (
		id                      BIGSERIAL   PRIMARY KEY,
		broadcaster_login       TEXT        NOT NULL,
		name                    TEXT        NOT NULL,
		messages                TEXT        NOT NULL DEFAULT '[]',
		selection_mode          TEXT        NOT NULL DEFAULT 'rotate',
		interval_minutes        INT         NOT NULL DEFAULT 15,
		min_chat_lines          INT         NOT NULL DEFAULT 0,
		activity_window_minutes INT         NOT NULL DEFAULT 10,
		online_only             BOOLEAN     NOT NULL DEFAULT TRUE,
		enabled                 BOOLEAN     NOT NULL DEFAULT TRUE,
		rotation_index          INT         NOT NULL DEFAULT 0,
		created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
		updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
		UNIQUE (broadcaster_login, name)
	);`)
	return err
}

const chatTimerColumns = `id, broadcaster_login, name, messages, selection_mode, interval_minutes,
	min_chat_lines, activity_window_minutes, online_only, enabled, rotation_index, updated_at`

func scanChatTimers(rows *sql.Rows) ([]ChatTimer, error) {
	defer rows.Close()
	res := []ChatTimer{}
	for rows.Next() {
		var t ChatTimer
		var msgs string
		if err := rows.Scan(&t.ID, &t.Login, &t.Name, &msgs, &t.SelectionMode, &t.IntervalMinutes,
			&t.MinChatLines, &t.ActivityWindowMinutes, &t.OnlineOnly, &t.Enabled, &t.RotationIndex, &t.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(msgs), &t.Messages); err != nil {
			log.Printf("chat timer %d has unreadable messages: %v", t.ID, err)
			t.Messages = nil
		}
		res = append(res, t)
	}
	return res, rows.Err()
}

// ListChatTimers returns a broadcaster's timers ordered by name.
func ListChatTimers(login string) ([]ChatTimer, error) {
	if db == nil {
		return []ChatTimer{}, nil
	}
	rows, err := db.Query(`SELECT `+chatTimerColumns+` FROM chat_timers WHERE broadcaster_login = $1 ORDER BY lower(name)`,
		strings.ToLower(strings.TrimSpace(login)))
	if err != nil {
		return nil, err
	}
	return scanChatTimers(rows)
}

// ListEnabledChatTimers returns every enabled timer across all channels.
func ListEnabledChatTimers() ([]ChatTimer, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT ` + chatTimerColumns + ` FROM chat_timers WHERE enabled`)
	if err != nil {
		return nil, err
	}
	return scanChatTimers(rows)
}

var errChatTimerNameTaken = fmt.Errorf("you already have a timer with that name")

// SaveChatTimer inserts a timer (ID 0) or updates an existing one owned by
// t.Login, returning the stored row.
func SaveChatTimer(t ChatTimer) (ChatTimer, error) {
	if db == nil {
		return t, fmt.Errorf("db not initialized")
	}
	msgs, _ := json.Marshal(t.Messages)
	var rows *sql.Rows
	var err error
	if t.ID == 0 {
		var count int
		if err := db.QueryRow(`SELECT count(*) FROM chat_timers WHERE broadcaster_login = $1`, t.Login).Scan(&count); err != nil {
			return t, err
		}
		if count >= timerMaxPerChannel {
			return t, fmt.Errorf("a channel can have at most %d timers", timerMaxPerChannel)
		}
		rows, err = db.Query(`
		INSERT INTO chat_timers (broadcaster_login, name, messages, selection_mode, interval_minutes,
			min_chat_lines, activity_window_minutes, online_only, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING `+chatTimerColumns,
			t.Login, t.Name, string(msgs), t.SelectionMode, t.IntervalMinutes, t.MinChatLines, t.ActivityWindowMinutes, t.OnlineOnly, t.Enabled)
	} else {
		// rotation_index restarts when the messages change so rotation begins
		// at the first message of the new list.
		rows, err = db.Query(`
		UPDATE chat_timers SET name = $3, messages = $4, selection_mode = $5, interval_minutes = $6,
			min_chat_lines = $7, activity_window_minutes = $8, online_only = $9, enabled = $10,
			rotation_index = CASE WHEN messages = $4 THEN rotation_index ELSE 0 END,
			updated_at = now()
		WHERE id = $1 AND broadcaster_login = $2
		RETURNING `+chatTimerColumns,
			t.ID, t.Login, t.Name, string(msgs), t.SelectionMode, t.IntervalMinutes, t.MinChatLines, t.ActivityWindowMinutes, t.OnlineOnly, t.Enabled)
	}
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key") {
			return t, errChatTimerNameTaken
		}
		return t, err
	}
	saved, err := scanChatTimers(rows)
	if err != nil {
		return t, err
	}
	if len(saved) == 0 {
		return t, sql.ErrNoRows
	}
	return saved[0], nil
}

// DeleteChatTimer removes a timer owned by login.
func DeleteChatTimer(login string, id int64) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM chat_timers WHERE broadcaster_login = $1 AND id = $2`,
		strings.ToLower(strings.TrimSpace(login)), id)
	return err
}

func setChatTimerRotation(id int64, index int) {
	if db == nil {
		return
	}
	if _, err := db.Exec(`UPDATE chat_timers SET rotation_index = $2 WHERE id = $1`, id, index); err != nil {
		log.Println("chat timer rotation save:", err)
	}
}

// ── Chat activity ───────────────────────────────────────────────────────────

// timerActivity keeps, per channel, the times of recent viewer messages (the
// bot's own messages are not counted) for the rolling activity window.
var (
	timerActivityMu sync.Mutex
	timerActivity   = map[string][]time.Time{}
)

func timerBotLogin() string {
	if v := strings.TrimSpace(os.Getenv("TWITCH_BOT_USERNAME")); v != "" {
		return strings.ToLower(v)
	}
	return "axyrabot"
}

// recordTimerActivity notes one chat message for timer activity counting.
func recordTimerActivity(channel, chatter string, now time.Time) {
	channel = strings.ToLower(channel)
	if strings.EqualFold(chatter, timerBotLogin()) {
		return
	}
	timerActivityMu.Lock()
	defer timerActivityMu.Unlock()
	events := pruneTimerActivity(timerActivity[channel], now)
	timerActivity[channel] = append(events, now)
}

// timerActivityCount returns how many viewer messages arrived in channel
// during the window ending at now.
func timerActivityCount(channel string, window time.Duration, now time.Time) int {
	channel = strings.ToLower(channel)
	timerActivityMu.Lock()
	defer timerActivityMu.Unlock()
	events := pruneTimerActivity(timerActivity[channel], now)
	timerActivity[channel] = events
	cutoff := now.Add(-window)
	n := 0
	for i := len(events) - 1; i >= 0 && events[i].After(cutoff); i-- {
		n++
	}
	return n
}

func pruneTimerActivity(events []time.Time, now time.Time) []time.Time {
	cutoff := now.Add(-timerMaxWindow * time.Minute)
	i := 0
	for i < len(events) && !events[i].After(cutoff) {
		i++
	}
	return events[i:]
}

// ── Scheduling ──────────────────────────────────────────────────────────────

// timerState is the scheduler's in-memory view of one timer.
type timerState struct {
	lastRun    time.Time // when the clock last restarted (sent, skipped or first seen)
	lastSent   time.Time
	lastSkip   string
	intervalAt int // interval the clock was started with
}

type timerConditions struct {
	joined        bool
	live          bool
	activity      int
	lastChannelAt time.Time // last time any timer sent in this channel
}

type timerAction int

const (
	timerWait timerAction = iota // not due yet, or held back by the channel gap
	timerSend
	timerSkip
)

// decideTimer applies the scheduling rules to one due-check. It returns what
// to do and, for skips, why.
func decideTimer(t ChatTimer, st *timerState, c timerConditions, now time.Time) (timerAction, string) {
	if now.Sub(st.lastRun) < time.Duration(t.IntervalMinutes)*time.Minute {
		return timerWait, ""
	}
	if !c.joined {
		return timerSkip, timerSkipNotJoined
	}
	if t.OnlineOnly && !c.live {
		return timerSkip, timerSkipOffline
	}
	if c.activity < t.MinChatLines {
		return timerSkip, timerSkipQuietChat
	}
	if !c.lastChannelAt.IsZero() && now.Sub(c.lastChannelAt) < timerChannelGap {
		return timerWait, ""
	}
	return timerSend, ""
}

// pickTimerMessage chooses the next message. For rotate it returns the
// message at the rotation index and the index to store next; for random it
// avoids repeating the previous pick when there is a choice.
func pickTimerMessage(t ChatTimer, previous string, rnd *rand.Rand) (string, int) {
	n := len(t.Messages)
	if n == 0 {
		return "", 0
	}
	if t.SelectionMode == timerSelectRandom {
		if n == 1 {
			return t.Messages[0], 0
		}
		for {
			m := t.Messages[rnd.Intn(n)]
			if m != previous {
				return m, 0
			}
		}
	}
	i := t.RotationIndex % n
	if i < 0 {
		i = 0
	}
	return t.Messages[i], (i + 1) % n
}

var (
	timerUnknownVars = regexp.MustCompile(`\$\((user|touser|count)\)`)
	timerSpaces      = regexp.MustCompile(`[ \t]{2,}`)
)

// renderTimerMessage fills the variables a timer can use. Command-only
// variables ($(user), $(touser), $(count)) have no meaning without someone
// triggering the message, so they are removed. The result is capped at
// Twitch's message length.
func renderTimerMessage(channel, template string, lookupGame func() (title, game string), randomChatter func() string) string {
	out := strings.ReplaceAll(template, "$(channel)", channel)
	if strings.Contains(out, "$(title)") || strings.Contains(out, "$(game)") {
		title, game := lookupGame()
		out = strings.ReplaceAll(out, "$(title)", title)
		out = strings.ReplaceAll(out, "$(game)", game)
	}
	if strings.Contains(out, "$(random.chatter)") {
		rc := randomChatter()
		if rc == "" {
			rc = channel
		}
		out = strings.ReplaceAll(out, "$(random.chatter)", rc)
	}
	out = timerUnknownVars.ReplaceAllString(out, "")
	out = strings.TrimSpace(timerSpaces.ReplaceAllString(out, " "))
	if utf8.RuneCountInString(out) > twitchMaxMessageLen {
		out = string([]rune(out)[:twitchMaxMessageLen])
	}
	return out
}

type timerScheduler struct {
	mu           sync.Mutex
	states       map[int64]*timerState
	lastChannel  map[string]time.Time
	lastMessages map[int64]string
	rnd          *rand.Rand
}

var chatTimers = &timerScheduler{
	states:       map[int64]*timerState{},
	lastChannel:  map[string]time.Time{},
	lastMessages: map[int64]string{},
	rnd:          rand.New(rand.NewSource(time.Now().UnixNano())),
}

// StartChatTimerScheduler checks every timer each tick. Timers are reloaded
// from the database every tick, so dashboard edits apply without a restart.
func StartChatTimerScheduler() {
	if err := EnsureChatTimersTable(); err != nil {
		log.Println("failed to ensure chat_timers table:", err)
	}
	ticker := time.NewTicker(timerTick)
	defer ticker.Stop()
	for now := range ticker.C {
		timers, err := ListEnabledChatTimers()
		if err != nil {
			log.Println("chat timers load:", err)
			continue
		}
		if len(timers) == 0 {
			chatTimers.tick(nil, nil, now)
			continue
		}
		channels, err := GetJoinedChannels()
		if err != nil {
			log.Println("chat timers joined channels:", err)
			continue
		}
		joined := make(map[string]bool, len(channels))
		for _, ch := range channels {
			joined[strings.ToLower(ch)] = true
		}
		chatTimers.tick(timers, joined, now)
	}
}

func (s *timerScheduler) tick(timers []ChatTimer, joined map[string]bool, now time.Time) {
	seen := make(map[int64]bool, len(timers))
	liveCache := map[string]bool{}
	for _, t := range timers {
		seen[t.ID] = true
		s.mu.Lock()
		st := s.states[t.ID]
		if st == nil {
			// New, newly enabled, or first seen after a restart: start the clock.
			st = &timerState{lastRun: now, intervalAt: t.IntervalMinutes}
			s.states[t.ID] = st
		}
		if t.IntervalMinutes != st.intervalAt {
			// A changed interval counts from now so shortening it can't make the
			// timer instantly overdue.
			st.lastRun, st.intervalAt = now, t.IntervalMinutes
		}
		lastChannelAt := s.lastChannel[t.Login]
		s.mu.Unlock()

		if now.Sub(st.lastRun) < time.Duration(t.IntervalMinutes)*time.Minute {
			continue
		}
		cond := timerConditions{
			joined:        joined[t.Login],
			activity:      timerActivityCount(t.Login, time.Duration(t.ActivityWindowMinutes)*time.Minute, now),
			lastChannelAt: lastChannelAt,
		}
		if t.OnlineOnly && cond.joined {
			live, ok := liveCache[t.Login]
			if !ok {
				live = isChannelLive(t.Login)
				liveCache[t.Login] = live
			}
			cond.live = live
		}
		action, reason := decideTimer(t, st, cond, now)
		switch action {
		case timerSkip:
			s.restart(st, now, reason)
			log.Printf("[TIMER] channel=%s timer=%q skipped: %s", t.Login, t.Name, reason)
		case timerSend:
			s.send(t, st, now)
		}
	}
	// Forget timers that were deleted or disabled so re-enabling restarts the clock.
	s.mu.Lock()
	for id := range s.states {
		if !seen[id] {
			delete(s.states, id)
			delete(s.lastMessages, id)
		}
	}
	s.mu.Unlock()
}

func (s *timerScheduler) restart(st *timerState, now time.Time, skipReason string) {
	s.mu.Lock()
	st.lastRun = now
	st.lastSkip = skipReason
	s.mu.Unlock()
}

func (s *timerScheduler) send(t ChatTimer, st *timerState, now time.Time) {
	s.mu.Lock()
	previous := s.lastMessages[t.ID]
	template, nextIndex := pickTimerMessage(t, previous, s.rnd)
	s.mu.Unlock()

	msg := renderTimerMessage(t.Login, template,
		func() (string, string) {
			title, game, err := getChannelTitleAndGame(t.Login)
			if err != nil {
				log.Println("chat timer title/game lookup:", err)
			}
			return title, game
		},
		func() string {
			if rc := getRandomChatterFromAPI(t.Login); rc != "" {
				return rc
			}
			return getRandomChatter(t.Login)
		})
	advanceRotation := func() {
		if t.SelectionMode == timerSelectRotate {
			setChatTimerRotation(t.ID, nextIndex)
		}
	}
	if msg == "" {
		// Move past the empty message so the next run tries the following one.
		advanceRotation()
		s.restart(st, now, timerSkipEmptyRender)
		return
	}
	if err := sendHelixChatMessage(t.Login, msg); err != nil {
		log.Printf("[TIMER] channel=%s timer=%q send failed: %v", t.Login, t.Name, err)
		s.restart(st, now, "send failed")
		return
	}
	advanceRotation()
	s.mu.Lock()
	st.lastRun, st.lastSent, st.lastSkip = now, now, ""
	s.lastChannel[t.Login] = now
	s.lastMessages[t.ID] = template
	s.mu.Unlock()
	log.Printf("[TIMER] channel=%s timer=%q sent", t.Login, t.Name)
}

// status reports what the scheduler knows about a timer for the dashboard.
func (s *timerScheduler) status(t ChatTimer) map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.states[t.ID]
	out := map[string]any{"last_sent_at": nil, "next_due_at": nil, "last_skip_reason": ""}
	if st == nil || !t.Enabled {
		return out
	}
	if !st.lastSent.IsZero() {
		out["last_sent_at"] = st.lastSent
	}
	out["next_due_at"] = st.lastRun.Add(time.Duration(t.IntervalMinutes) * time.Minute)
	out["last_skip_reason"] = st.lastSkip
	return out
}

// ── HTTP ────────────────────────────────────────────────────────────────────

// handleChatTimers lists (GET) or creates/updates (POST) a channel's timers.
func handleChatTimers(w http.ResponseWriter, r *http.Request) {
	if err := EnsureChatTimersTable(); err != nil {
		log.Println("chat timers table ensure failed:", err)
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
		timers, err := ListChatTimers(login)
		if err != nil {
			log.Println("list chat timers:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		out := make([]map[string]any, len(timers))
		for i, t := range timers {
			out[i] = chatTimerJSON(t)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"timers": out})
	case http.MethodPost:
		var t ChatTimer
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		if err := normalizeChatTimer(&t); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		created := t.ID == 0
		saved, err := SaveChatTimer(t)
		switch {
		case err == errChatTimerNameTaken:
			http.Error(w, err.Error(), http.StatusConflict)
			return
		case err == sql.ErrNoRows:
			http.Error(w, "timer not found", http.StatusNotFound)
			return
		case err != nil && strings.HasPrefix(err.Error(), "a channel can have"):
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		case err != nil:
			log.Println("save chat timer:", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		verb := "Updated"
		if created {
			verb = "Added"
		}
		if err := InsertAuditLog(saved.Login, "bot", "timer_save", fmt.Sprintf("%s timer: %s (every %d min)", verb, saved.Name, saved.IntervalMinutes)); err != nil {
			log.Println("audit log timer save:", err)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"timer": chatTimerJSON(saved)})
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleChatTimersDelete deletes a timer by ID.
func handleChatTimersDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Login string `json:"login"`
		ID    int64  `json:"id"`
		Name  string `json:"name"`
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
	if err := DeleteChatTimer(login, body.ID); err != nil {
		log.Println("delete chat timer:", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	label := strings.TrimSpace(body.Name)
	if label == "" {
		label = fmt.Sprintf("id %d", body.ID)
	}
	if err := InsertAuditLog(login, "bot", "timer_delete", "Deleted timer: "+label); err != nil {
		log.Println("audit log timer delete:", err)
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

func chatTimerJSON(t ChatTimer) map[string]any {
	return map[string]any{
		"id":                      t.ID,
		"name":                    t.Name,
		"messages":                t.Messages,
		"selection_mode":          t.SelectionMode,
		"interval_minutes":        t.IntervalMinutes,
		"min_chat_lines":          t.MinChatLines,
		"activity_window_minutes": t.ActivityWindowMinutes,
		"online_only":             t.OnlineOnly,
		"enabled":                 t.Enabled,
		"status":                  chatTimers.status(t),
	}
}
