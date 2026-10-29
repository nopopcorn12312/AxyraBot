package main

import (
	"strings"
	"testing"
)

func TestTokenEncryptionRoundTrip(t *testing.T) {
	t.Setenv("TOKEN_ENCRYPTION_KEY", "test-key")
	stored, err := encryptToken("secret-token")
	if err != nil {
		t.Fatalf("encryptToken: %v", err)
	}
	if !strings.HasPrefix(stored, encryptedTokenPrefix) || strings.Contains(stored, "secret-token") {
		t.Fatalf("token stored in plain text: %q", stored)
	}
	got, err := decryptToken(stored)
	if err != nil || got != "secret-token" {
		t.Fatalf("decryptToken = %q, %v", got, err)
	}
	if got, err := decryptToken("legacy-plain-token"); err != nil || got != "legacy-plain-token" {
		t.Fatalf("legacy token = %q, %v", got, err)
	}
	if _, err := decryptToken(stored[:len(stored)-2] + "AA"); err == nil {
		t.Fatal("expected tampered token to fail")
	}
}
