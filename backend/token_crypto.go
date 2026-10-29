package main

import (
	"crypto/aes"
	"crypto/cipher"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
)

// OAuth tokens (Twitch user tokens, Discord user tokens) are encrypted with
// AES-256-GCM before they're written to the database, so a leaked database
// dump doesn't hand out working tokens. The key comes from
// TOKEN_ENCRYPTION_KEY; any string works, it's hashed to 32 bytes.
//
// Values written before encryption was enabled have no prefix and are read
// back as-is; they're encrypted the next time they're saved (e.g. on refresh).

const encryptedTokenPrefix = "enc:v1:"

var (
	tokenAEADOnce sync.Once
	tokenAEAD     cipher.AEAD
)

func getTokenAEAD() cipher.AEAD {
	tokenAEADOnce.Do(func() {
		secret := os.Getenv("TOKEN_ENCRYPTION_KEY")
		if secret == "" {
			log.Println("[auth] TOKEN_ENCRYPTION_KEY not set; OAuth tokens are stored unencrypted")
			return
		}
		key := sha256.Sum256([]byte(secret))
		block, err := aes.NewCipher(key[:])
		if err != nil {
			log.Fatal("[auth] token cipher:", err)
		}
		aead, err := cipher.NewGCM(block)
		if err != nil {
			log.Fatal("[auth] token cipher:", err)
		}
		tokenAEAD = aead
	})
	return tokenAEAD
}

// encryptToken returns the value to store for a token.
func encryptToken(plain string) (string, error) {
	aead := getTokenAEAD()
	if aead == nil || plain == "" {
		return plain, nil
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := crand.Read(nonce); err != nil {
		return "", err
	}
	sealed := aead.Seal(nonce, nonce, []byte(plain), nil)
	return encryptedTokenPrefix + base64.RawStdEncoding.EncodeToString(sealed), nil
}

// decryptToken turns a stored value back into the token.
func decryptToken(stored string) (string, error) {
	enc, ok := strings.CutPrefix(stored, encryptedTokenPrefix)
	if !ok {
		return stored, nil // written before encryption was enabled
	}
	aead := getTokenAEAD()
	if aead == nil {
		return "", fmt.Errorf("token is encrypted but TOKEN_ENCRYPTION_KEY is not set")
	}
	raw, err := base64.RawStdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	if len(raw) < aead.NonceSize() {
		return "", fmt.Errorf("encrypted token too short")
	}
	plain, err := aead.Open(nil, raw[:aead.NonceSize()], raw[aead.NonceSize():], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt token: %w", err)
	}
	return string(plain), nil
}
