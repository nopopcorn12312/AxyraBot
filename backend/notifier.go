package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

// Listen for Postgres NOTIFY on "channels_changed" and call the handler
func StartNotifier(dsn string) error {
	if dsn == "" {
		return nil
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		return err
	}
	go func() {
		defer func() {
			_ = conn.Close(ctx)
		}()
		for {
			// ensure listener
			if _, err := conn.Exec(ctx, "LISTEN channels_changed"); err != nil {
				log.Println("failed to LISTEN channels_changed:", err)
				time.Sleep(5 * time.Second)
				continue
			}
			log.Println("listening for channels_changed notifications")
			for {
				n, err := conn.WaitForNotification(ctx)
				if err != nil {
					log.Println("notification error:", err)
					break
				}
				payload := n.Payload
				log.Println("received channels_changed notify:", payload)
				// on notification, refresh joined channels and ensure bot is in them
				handleChannelsChanged(payload)
			}
			// brief pause before retrying the listen loop
			time.Sleep(2 * time.Second)
		}
	}()
	return nil
}

func handleChannelsChanged(payload string) {
	// payload is expected to be the channel login; if empty, refresh all
	chans := []string{}
	if db != nil {
		if cs, err := GetJoinedChannels(); err == nil {
			chans = cs
		} else {
			log.Println("failed to fetch joined channels:", err)
			return
		}
	}
	// if IRC is enabled, start a bot for any channel not active (legacy mode)
	if os.Getenv("TWITCH_IRC_ENABLED") == "1" {
		for _, ch := range chans {
			if !isActiveChannel(ch) {
				log.Println("starting IRC bot for new channel:", ch)
				botName := os.Getenv("TWITCH_BOT_USERNAME")
				oauth := os.Getenv("TWITCH_BOT_OAUTH")
				go startIrcBot(botName, oauth, ch)
				markActiveChannel(ch)
			}
		}
		return
	}

	// In the default path, we rely on EventSub channel.chat.message for chat reading.
	// Mark new channels as active and (re)register EventSub subscriptions using the
	// cached or freshly obtained app access token.
	for _, ch := range chans {
		if !isActiveChannel(ch) {
			log.Println("activating channel for EventSub chat:", ch)
			markActiveChannel(ch)
		}
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return
	}

	go func() {
		// ensure we have an app access token
		helixChatMu.Lock()
		token := appAccessToken
		helixChatMu.Unlock()
		if token == "" {
			var err error
			token, err = getAppAccessToken(clientID, clientSecret)
			if err != nil {
				log.Println("failed to get app token for EventSub after channels_changed:", err)
				return
			}
			helixChatMu.Lock()
			appAccessToken = token
			helixChatMu.Unlock()
		}

		// Re-register EventSub subscriptions for all joined channels (database-driven).
		registerEventSubSubscriptions(token, clientID, "", "")
	}()
}
