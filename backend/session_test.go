package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSessionTokenRoundTrip(t *testing.T) {
	token := issueSession("Alice")
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	if got := sessionFromRequest(req); got != "alice" {
		t.Fatalf("expected session for alice, got %q", got)
	}
}

func TestSessionTokenRejectsTampering(t *testing.T) {
	token := issueSession("alice")
	body, sig, _ := strings.Cut(token, ".")
	forged := issueSession("mallory")
	forgedBody, _, _ := strings.Cut(forged, ".")

	for name, tok := range map[string]string{
		"swapped payload": forgedBody + "." + sig,
		"no signature":    body,
		"garbage":         "not-a-token",
	} {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		if got := sessionFromRequest(req); got != "" {
			t.Errorf("%s: expected rejection, got %q", name, got)
		}
	}
}

func TestSignedValueKindsAreNotInterchangeable(t *testing.T) {
	state := signValue("oauth-twitch", "alice", time.Minute)
	if _, ok := verifySigned("session", state); ok {
		t.Fatal("an OAuth state must not verify as a session")
	}
	if got, ok := verifySigned("oauth-twitch", state); !ok || got != "alice" {
		t.Fatalf("expected state to verify, got %q ok=%v", got, ok)
	}
}

func TestSignedValueExpires(t *testing.T) {
	expired := signValue("session", "alice", -time.Second)
	if _, ok := verifySigned("session", expired); ok {
		t.Fatal("expected expired value to be rejected")
	}
}

func TestSafeFrontendRedirect(t *testing.T) {
	t.Setenv("FRONTEND_URL", "https://axyrabot.com")
	cases := map[string]string{
		"https://axyrabot.com/discord/settings": "https://axyrabot.com/discord/settings",
		"http://localhost:3000/import":          "http://localhost:3000/import",
		"https://evil.example/phish":            "https://axyrabot.com/import",
		"javascript:alert(1)":                   "https://axyrabot.com/import",
		"":                                      "https://axyrabot.com/import",
	}
	for in, want := range cases {
		if got := safeFrontendRedirect(in, "/import"); got != want {
			t.Errorf("safeFrontendRedirect(%q) = %q, want %q", in, got, want)
		}
	}
}
