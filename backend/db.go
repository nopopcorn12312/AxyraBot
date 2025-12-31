package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

var db *sql.DB

func InitDB(dsn string) error {
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL is empty")
	}
	// register pgx stdlib is automatic via import
	var err error
	db, err = sql.Open("pgx", dsn)
	if err != nil {
		return err
	}
	// simple ping
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return db.PingContext(ctx)
}

// Channel represents a channel row
type Channel struct {
	ID        int64
	Login     string
	OwnerUser string
	Joined    bool
	JoinedAt  time.Time
}

func GetJoinedChannels() ([]string, error) {
	rows, err := db.Query("SELECT login FROM channels WHERE joined = true")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var l string
		if err := rows.Scan(&l); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, nil
}

func AddOrUpdateChannel(login, owner string) error {
	// insert or update
	_, err := db.Exec(`INSERT INTO channels (login, owner_user, joined, joined_at) VALUES ($1,$2,true,now()) ON CONFLICT (login) DO UPDATE SET owner_user=EXCLUDED.owner_user, joined=true, joined_at=now()`, login, owner)
	return err
}

func SaveUserTokens(login, access, refresh string) error {
	// upsert user tokens
	_, err := db.Exec(`INSERT INTO users (login, access_token, refresh_token) VALUES ($1,$2,$3) ON CONFLICT (login) DO UPDATE SET access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token`, login, access, refresh)
	return err
}

// GetUserAccessToken returns the stored access token for a given Twitch login.
func GetUserAccessToken(login string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("db not initialized")
	}
	var token string
	row := db.QueryRow(`SELECT access_token FROM users WHERE login = $1`, login)
	if err := row.Scan(&token); err != nil {
		return "", err
	}
	return token, nil
}

func EnsureSchema() error {
	// create simple tables if not exist
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS users (
	 id SERIAL PRIMARY KEY,
	 login TEXT UNIQUE NOT NULL,
	 twitch_user_id TEXT,
	 access_token TEXT,
	 refresh_token TEXT,
	 scopes TEXT,
	 expires_at TIMESTAMPTZ
	);
	CREATE TABLE IF NOT EXISTS channels (
	 id SERIAL PRIMARY KEY,
	 login TEXT UNIQUE NOT NULL,
	 owner_user TEXT,
	 joined BOOLEAN DEFAULT FALSE,
	 joined_at TIMESTAMPTZ
	);
	`)
	if err != nil {
		return err
	}

	// create a trigger function to notify on changes
	_, err = db.Exec(`
	CREATE OR REPLACE FUNCTION notify_channels_changed() RETURNS trigger AS $$
	BEGIN
	  PERFORM pg_notify('channels_changed', COALESCE(NEW.login, OLD.login));
	  RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

	DROP TRIGGER IF EXISTS channels_changed_trigger ON channels;
	CREATE TRIGGER channels_changed_trigger
	AFTER INSERT OR UPDATE OR DELETE ON channels
	FOR EACH ROW EXECUTE FUNCTION notify_channels_changed();
	`)
	return err
}
