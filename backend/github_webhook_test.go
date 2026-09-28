package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"testing"
)

func TestGitHubPushAnnouncementMessage(t *testing.T) {
	tests := []struct {
		name    string
		payload string
		want    string
	}{
		{
			name:    "uses pusher name",
			payload: `{"pusher":{"name":"Nick"},"sender":{"login":"nick-login"}}`,
			want:    "Github push (Nick)",
		},
		{
			name:    "falls back to sender login",
			payload: `{"pusher":{"name":" "},"sender":{"login":"nick-login"}}`,
			want:    "Github push (nick-login)",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := githubPushAnnouncementMessage([]byte(test.payload))
			if err != nil {
				t.Fatalf("githubPushAnnouncementMessage() error = %v", err)
			}
			if got != test.want {
				t.Fatalf("githubPushAnnouncementMessage() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestValidGitHubWebhookSignature(t *testing.T) {
	body := []byte(`{"ref":"refs/heads/main"}`)
	secret := "test-secret"
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	signature := "sha256=" + fmt.Sprintf("%x", mac.Sum(nil))

	if !validGitHubWebhookSignature(body, signature, secret) {
		t.Fatal("valid signature was rejected")
	}
	if validGitHubWebhookSignature(body, signature, "wrong-secret") {
		t.Fatal("signature validated with a different secret")
	}
	if validGitHubWebhookSignature(body, "", secret) {
		t.Fatal("missing signature was accepted")
	}
}
