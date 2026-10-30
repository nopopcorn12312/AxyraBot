package main

import (
	"math/rand"
	"strings"
	"testing"
	"time"
)

func TestDecideTimer(t *testing.T) {
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	timer := ChatTimer{IntervalMinutes: 15, MinChatLines: 5, OnlineOnly: true}
	ready := timerConditions{joined: true, live: true, activity: 5}

	tests := []struct {
		name       string
		timer      ChatTimer
		lastRun    time.Time
		cond       timerConditions
		wantAction timerAction
		wantReason string
	}{
		{name: "not due yet", timer: timer, lastRun: now.Add(-14 * time.Minute), cond: ready, wantAction: timerWait},
		{name: "due with enough activity sends", timer: timer, lastRun: now.Add(-15 * time.Minute), cond: ready, wantAction: timerSend},
		{name: "long overdue still sends just once", timer: timer, lastRun: now.Add(-6 * time.Hour), cond: ready, wantAction: timerSend},
		{name: "quiet chat skips", timer: timer, lastRun: now.Add(-15 * time.Minute),
			cond: timerConditions{joined: true, live: true, activity: 4}, wantAction: timerSkip, wantReason: timerSkipQuietChat},
		{name: "offline skips live-only timer", timer: timer, lastRun: now.Add(-15 * time.Minute),
			cond: timerConditions{joined: true, live: false, activity: 50}, wantAction: timerSkip, wantReason: timerSkipOffline},
		{name: "offline is fine when not live-only", timer: ChatTimer{IntervalMinutes: 15}, lastRun: now.Add(-15 * time.Minute),
			cond: timerConditions{joined: true}, wantAction: timerSend},
		{name: "bot not in channel skips", timer: timer, lastRun: now.Add(-15 * time.Minute),
			cond: timerConditions{live: true, activity: 50}, wantAction: timerSkip, wantReason: timerSkipNotJoined},
		{name: "another timer just sent: wait", timer: timer, lastRun: now.Add(-15 * time.Minute),
			cond: timerConditions{joined: true, live: true, activity: 5, lastChannelAt: now.Add(-10 * time.Second)}, wantAction: timerWait},
		{name: "channel gap passed: send", timer: timer, lastRun: now.Add(-15 * time.Minute),
			cond: timerConditions{joined: true, live: true, activity: 5, lastChannelAt: now.Add(-timerChannelGap)}, wantAction: timerSend},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			action, reason := decideTimer(test.timer, &timerState{lastRun: test.lastRun}, test.cond, now)
			if action != test.wantAction || reason != test.wantReason {
				t.Fatalf("decideTimer = (%d, %q), want (%d, %q)", action, reason, test.wantAction, test.wantReason)
			}
		})
	}
}

func TestSchedulerNeverBurstsAfterInactivity(t *testing.T) {
	// A timer that was skipped for hours must not fire repeatedly once chat
	// wakes up: one skip or send restarts the clock for a full interval.
	t.Setenv("TWITCH_BOT_USERNAME", "axyrabot")
	s := &timerScheduler{states: map[int64]*timerState{}, lastChannel: map[string]time.Time{}, lastMessages: map[int64]string{}, rnd: rand.New(rand.NewSource(1))}
	timer := ChatTimer{ID: 1, Login: "quietchannel", Name: "promo", Messages: []string{"hi"}, IntervalMinutes: 5, MinChatLines: 3, ActivityWindowMinutes: 10}
	joined := map[string]bool{"quietchannel": true}
	start := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)

	s.tick([]ChatTimer{timer}, joined, start)
	for m := 5; m <= 120; m += 5 {
		s.tick([]ChatTimer{timer}, joined, start.Add(time.Duration(m)*time.Minute))
	}
	st := s.states[1]
	if st.lastSkip != timerSkipQuietChat {
		t.Fatalf("lastSkip = %q, want %q", st.lastSkip, timerSkipQuietChat)
	}
	if want := start.Add(120 * time.Minute); !st.lastRun.Equal(want) {
		t.Fatalf("clock restarted at %v, want %v", st.lastRun, want)
	}
}

func TestSchedulerStartsClockWhenFirstSeen(t *testing.T) {
	s := &timerScheduler{states: map[int64]*timerState{}, lastChannel: map[string]time.Time{}, lastMessages: map[int64]string{}, rnd: rand.New(rand.NewSource(1))}
	timer := ChatTimer{ID: 7, Login: "chan", Messages: []string{"hi"}, IntervalMinutes: 10}
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	s.tick([]ChatTimer{timer}, map[string]bool{"chan": true}, now)
	if st := s.states[7]; st == nil || !st.lastRun.Equal(now) || !st.lastSent.IsZero() {
		t.Fatalf("first sighting should only start the clock, got %+v", st)
	}

	// Disabled timers drop out of the list; re-enabling starts a fresh clock.
	later := now.Add(time.Hour)
	s.tick(nil, nil, later)
	if _, ok := s.states[7]; ok {
		t.Fatal("state for a disabled timer should be forgotten")
	}
	s.tick([]ChatTimer{timer}, map[string]bool{"chan": true}, later)
	if !s.states[7].lastRun.Equal(later) {
		t.Fatal("re-enabled timer should start its clock at re-enable time")
	}

	// Shortening the interval counts from the change, not from the old start.
	timer.IntervalMinutes = 5
	changed := later.Add(9 * time.Minute)
	s.tick([]ChatTimer{timer}, map[string]bool{"chan": true}, changed)
	if !s.states[7].lastRun.Equal(changed) {
		t.Fatal("interval change should restart the clock")
	}
}

func TestPickTimerMessage(t *testing.T) {
	rotate := ChatTimer{Messages: []string{"a", "b", "c"}, SelectionMode: timerSelectRotate}
	var got []string
	for i := 0; i < 4; i++ {
		msg, next := pickTimerMessage(rotate, "", nil)
		got = append(got, msg)
		rotate.RotationIndex = next
	}
	if strings.Join(got, "") != "abca" {
		t.Fatalf("rotation = %v, want a b c a", got)
	}

	random := ChatTimer{Messages: []string{"a", "b"}, SelectionMode: timerSelectRandom}
	rnd := rand.New(rand.NewSource(42))
	prev := "a"
	for i := 0; i < 20; i++ {
		msg, _ := pickTimerMessage(random, prev, rnd)
		if msg == prev {
			t.Fatalf("random pick repeated %q", msg)
		}
		prev = msg
	}
}

func TestRenderTimerMessage(t *testing.T) {
	lookup := func() (string, string) { return "Speedruns", "Elden Ring" }
	chatter := func() string { return "quietfox" }

	got := renderTimerMessage("nopopcorn", "Hi $(user)! $(channel) is playing $(game): $(title). Shoutout $(random.chatter)", lookup, chatter)
	want := "Hi ! nopopcorn is playing Elden Ring: Speedruns. Shoutout quietfox"
	if got != want {
		t.Fatalf("render = %q, want %q", got, want)
	}
	if got := renderTimerMessage("c", "  $(touser) $(count)  ", lookup, chatter); got != "" {
		t.Fatalf("a message of only command variables should render empty, got %q", got)
	}
	long := renderTimerMessage("c", strings.Repeat("é", 600), lookup, chatter)
	if n := len([]rune(long)); n != twitchMaxMessageLen {
		t.Fatalf("rendered length = %d, want %d", n, twitchMaxMessageLen)
	}
}

func TestNormalizeChatTimer(t *testing.T) {
	valid := func() ChatTimer {
		return ChatTimer{Login: " NoPopcorn ", Name: " Socials ", Messages: []string{"  follow!  ", "", "  "}, IntervalMinutes: 15}
	}
	tm := valid()
	if err := normalizeChatTimer(&tm); err != nil {
		t.Fatalf("valid timer rejected: %v", err)
	}
	if tm.Login != "nopopcorn" || tm.Name != "Socials" || len(tm.Messages) != 1 || tm.Messages[0] != "follow!" {
		t.Fatalf("not normalized: %+v", tm)
	}
	if tm.SelectionMode != timerSelectRotate || tm.ActivityWindowMinutes != timerDefaultWindow {
		t.Fatalf("defaults not applied: %+v", tm)
	}

	bad := []struct {
		name   string
		modify func(*ChatTimer)
	}{
		{"no name", func(c *ChatTimer) { c.Name = "  " }},
		{"only empty messages", func(c *ChatTimer) { c.Messages = []string{" ", ""} }},
		{"message too long", func(c *ChatTimer) { c.Messages = []string{strings.Repeat("x", 501)} }},
		{"interval too short", func(c *ChatTimer) { c.IntervalMinutes = 4 }},
		{"negative chat lines", func(c *ChatTimer) { c.MinChatLines = -1 }},
		{"window too long", func(c *ChatTimer) { c.ActivityWindowMinutes = 121 }},
		{"unknown order", func(c *ChatTimer) { c.SelectionMode = "shuffle" }},
	}
	for _, b := range bad {
		t.Run(b.name, func(t *testing.T) {
			c := valid()
			b.modify(&c)
			if err := normalizeChatTimer(&c); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}

func TestTimerActivityWindow(t *testing.T) {
	t.Setenv("TWITCH_BOT_USERNAME", "AxyraBot")
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	ch := "activitytest"
	recordTimerActivity(ch, "viewer1", now.Add(-12*time.Minute))
	recordTimerActivity(ch, "viewer2", now.Add(-4*time.Minute))
	recordTimerActivity(ch, "viewer3", now.Add(-1*time.Minute))
	recordTimerActivity(ch, "axyrabot", now.Add(-30*time.Second)) // the bot's own messages don't count

	if got := timerActivityCount(ch, 10*time.Minute, now); got != 2 {
		t.Fatalf("10-minute window count = %d, want 2", got)
	}
	if got := timerActivityCount(ch, 15*time.Minute, now); got != 3 {
		t.Fatalf("15-minute window count = %d, want 3", got)
	}
}
