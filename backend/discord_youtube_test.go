package main

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const testChannelID = "UC_x5XG1OV2P6uZZ5FSM9Ttw"

const testYouTubeFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <title>Test Channel</title>
 <link rel="alternate" href="https://www.youtube.com/channel/` + testChannelID + `"/>
 <published>2007-08-23T00:34:43+00:00</published>
 <entry>
  <yt:videoId>newest</yt:videoId>
  <title>A short one</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/newest"/>
  <published>2026-10-29T20:00:20+00:00</published>
 </entry>
 <entry>
  <yt:videoId>older</yt:videoId>
  <title>Full video &amp; more</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=older"/>
  <published>2026-10-28T20:00:20+00:00</published>
 </entry>
</feed>`

func TestParseYouTubeChannelInput(t *testing.T) {
	good := []struct{ input, id, path string }{
		{"https://www.youtube.com/channel/" + testChannelID, testChannelID, ""},
		{"youtube.com/channel/" + testChannelID + "/videos", testChannelID, ""},
		{testChannelID, testChannelID, ""},
		{"https://www.youtube.com/@NoPopcorn", "", "@NoPopcorn"},
		{"http://m.youtube.com/@NoPopcorn/videos?view=0", "", "@NoPopcorn"},
		{"  @no.pop-corn_1  ", "", "@no.pop-corn_1"},
		{"nopopcorn", "", "@nopopcorn"},
		{"https://youtube.com/c/SomeName", "", "c/SomeName"},
		{"https://www.youtube.com/user/OldName", "", "user/OldName"},
		{"https://www.youtube.com/@ゲーム", "", "@%E3%82%B2%E3%83%BC%E3%83%A0"},
	}
	for _, g := range good {
		id, path, err := parseYouTubeChannelInput(g.input)
		if err != nil || id != g.id || path != g.path {
			t.Errorf("%q = (%q, %q, %v), want (%q, %q)", g.input, id, path, err, g.id, g.path)
		}
	}
	bad := []string{
		"",
		"https://evil.example.com/@nopopcorn",
		"https://youtube.com.evil.example/@nopopcorn",
		"https://www.youtube.com/watch?v=abc123",
		"https://www.youtube.com/channel/not-an-id",
		"https://www.youtube.com/@../../secret",
		"../../secret",
		"evil.example.com",
		"two words",
	}
	for _, input := range bad {
		if id, path, err := parseYouTubeChannelInput(input); !errors.Is(err, errYouTubeBadInput) {
			t.Errorf("%q = (%q, %q, %v), want rejected", input, id, path, err)
		}
	}
}

func TestParseYouTubeFeed(t *testing.T) {
	feed, err := parseYouTubeFeed([]byte(testYouTubeFeed))
	if err != nil {
		t.Fatal(err)
	}
	if feed.ChannelName != "Test Channel" || len(feed.Videos) != 2 {
		t.Fatalf("feed = %+v", feed)
	}
	if v := feed.Videos[0]; v.ID != "newest" || v.URL != "https://www.youtube.com/shorts/newest" {
		t.Fatalf("first video = %+v", v)
	}
	if v := feed.Videos[1]; v.Title != "Full video & more" || !v.Published.Equal(time.Date(2026, 10, 28, 20, 0, 20, 0, time.UTC)) {
		t.Fatalf("second video = %+v", v)
	}
}

func TestResolveYouTubeChannel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/feeds/videos.xml" && r.URL.Query().Get("channel_id") == testChannelID:
			fmt.Fprint(w, testYouTubeFeed)
		case r.URL.Path == "/@realhandle":
			fmt.Fprintf(w, `<html><link rel="canonical" href="https://www.youtube.com/channel/%s"></html>`, testChannelID)
		case r.URL.Path == "/@consentpage":
			fmt.Fprint(w, `<html>Before you continue to YouTube</html>`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	original := youtubeBaseURL
	youtubeBaseURL = srv.URL
	defer func() { youtubeBaseURL = original }()

	for _, input := range []string{"@realhandle", "https://www.youtube.com/channel/" + testChannelID} {
		id, feed, err := resolveYouTubeChannel(input)
		if err != nil || id != testChannelID || feed.ChannelName != "Test Channel" {
			t.Errorf("%q = (%q, %+v, %v)", input, id, feed, err)
		}
	}
	for _, input := range []string{"@missing", "@consentpage", "UCaaaaaaaaaaaaaaaaaaaaaa"} {
		if _, _, err := resolveYouTubeChannel(input); !errors.Is(err, errYouTubeNotFound) {
			t.Errorf("%q: err = %v, want not found", input, err)
		}
	}
}

func testVideos(ids ...string) []youtubeVideo {
	// Newest first, like the feed: ids[0] was published most recently.
	base := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	videos := make([]youtubeVideo, len(ids))
	for i, id := range ids {
		videos[i] = youtubeVideo{ID: id, Published: base.Add(-time.Duration(i) * time.Hour)}
	}
	return videos
}

func ids(videos []youtubeVideo) string {
	out := []string{}
	for _, v := range videos {
		out = append(out, v.ID)
	}
	return strings.Join(out, ",")
}

func TestConnectingNeverAnnouncesExistingVideos(t *testing.T) {
	now := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
	feed := &youtubeFeed{Videos: testVideos("c", "b", "a")}
	seen, baseline := newYouTubeBaseline(feed, now)
	if post, _ := planYouTubePosts(feed.Videos, seen, baseline); len(post) != 0 {
		t.Fatalf("posted existing videos: %s", ids(post))
	}
	// A channel with no videos yet still announces its first one.
	seen, baseline = newYouTubeBaseline(&youtubeFeed{}, now)
	first := []youtubeVideo{{ID: "first", Published: now.Add(time.Minute)}}
	if post, _ := planYouTubePosts(first, seen, baseline); ids(post) != "first" {
		t.Fatalf("first upload not posted: %s", ids(post))
	}
}

func TestPlanYouTubePosts(t *testing.T) {
	baseline := time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC)

	// New videos post oldest first; handled ones don't repeat.
	if post, skip := planYouTubePosts(testVideos("c", "b", "a"), []string{"a"}, baseline); ids(post) != "b,c" || len(skip) != 0 {
		t.Fatalf("post = %s, skip = %v", ids(post), skip)
	}
	// An old video resurfacing (a newer one was deleted) is handled silently.
	old := []youtubeVideo{{ID: "resurfaced", Published: baseline.Add(-time.Hour)}}
	if post, skip := planYouTubePosts(old, nil, baseline); len(post) != 0 || strings.Join(skip, ",") != "resurfaced" {
		t.Fatalf("post = %s, skip = %v", ids(post), skip)
	}
	// After downtime only the newest few post; the rest are handled, not lost in a flood.
	post, skip := planYouTubePosts(testVideos("e", "d", "c", "b", "a"), nil, baseline)
	if ids(post) != "c,d,e" || strings.Join(skip, ",") != "a,b" {
		t.Fatalf("post = %s, skip = %v", ids(post), skip)
	}
}

func TestYouTubeMessageCannotPing(t *testing.T) {
	video := youtubeVideo{Title: "@everyone free *stuff*", URL: "https://www.youtube.com/watch?v=abc_def"}
	got := fillDiscordTemplate(discordDefaultYouTubeTemplate, youtubeTemplateVars("@here Channel", video))
	want := "📺 **@​here Channel** posted a new video!\n@​everyone free \\*stuff\\*\nhttps://www.youtube.com/watch?v=abc_def"
	if got != want {
		t.Fatalf("message =\n%q\nwant\n%q", got, want)
	}
}

func TestMergeYouTubeSeenKeepsNewest(t *testing.T) {
	seen := []string{}
	for i := 0; i < youtubeSeenLimit+5; i++ {
		seen = mergeYouTubeSeen(seen, fmt.Sprintf("v%d", i))
	}
	if len(seen) != youtubeSeenLimit || seen[0] != "v5" {
		t.Fatalf("len = %d, first = %q", len(seen), seen[0])
	}
}
