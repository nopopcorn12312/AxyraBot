package main

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
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
	// insert or update and mark as joined
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`INSERT INTO channels (login, owner_user, joined, joined_at) VALUES ($1,$2,true,now()) ON CONFLICT (login) DO UPDATE SET owner_user=EXCLUDED.owner_user, joined=true, joined_at=now()`, login, owner)
	return err
}

// SetChannelJoined flips the joined flag for an existing channel.
func SetChannelJoined(login string, joined bool) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`UPDATE channels SET joined=$2, joined_at=now() WHERE login=$1`, login, joined)
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

// UpdateWatchTime increments the watch_time counter for a viewer in a
// broadcaster's channel based on the provided timestamp. It caps each
// increment to a few minutes to avoid large jumps between sparse messages.
func UpdateWatchTime(broadcasterLogin, viewerLogin string, now time.Time) error {
	if db == nil {
		return nil
	}
	if broadcasterLogin == "" || viewerLogin == "" {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	viewerLogin = strings.ToLower(viewerLogin)
	_, err := db.Exec(`
	INSERT INTO watch_time (broadcaster_login, viewer_login, total_seconds, last_seen_at)
	VALUES ($1, $2, 0, $3)
	ON CONFLICT (broadcaster_login, viewer_login) DO UPDATE
	SET total_seconds = watch_time.total_seconds +
	  LEAST(
	    GREATEST(EXTRACT(EPOCH FROM ($3 - COALESCE(watch_time.last_seen_at, $3))), 0),
	    300
	  ),
	    last_seen_at = $3;
	`, broadcasterLogin, viewerLogin, now)
	return err
}

// GetWatchTimeSeconds returns the cumulative watch time (in seconds) that a
// viewer has spent in a broadcaster's channel, or 0 if no record exists.
func GetWatchTimeSeconds(broadcasterLogin, viewerLogin string) (int64, error) {
	if db == nil {
		return 0, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	viewerLogin = strings.ToLower(viewerLogin)
	var secs int64
	row := db.QueryRow(`SELECT total_seconds FROM watch_time WHERE broadcaster_login=$1 AND viewer_login=$2`, broadcasterLogin, viewerLogin)
	if err := row.Scan(&secs); err != nil {
		if err == sql.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return secs, nil
}

// GetDefaultCommandSettings returns all stored default-command enable flags for
// a broadcaster as a map[command_name]enabled.
func GetDefaultCommandSettings(broadcasterLogin string) (map[string]bool, error) {
	res := map[string]bool{}
	if db == nil {
		return res, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	rows, err := db.Query(`SELECT command_name, enabled FROM default_command_settings WHERE broadcaster_login=$1`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var enabled bool
		if err := rows.Scan(&name, &enabled); err != nil {
			return nil, err
		}
		res[name] = enabled
	}
	return res, nil
}

// GetDefaultCommandEnabled returns whether a given default command is enabled
// for a broadcaster. If no row exists, it is treated as enabled.
func GetDefaultCommandEnabled(broadcasterLogin, commandName string) (bool, error) {
	if db == nil {
		return true, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	var enabled bool
	row := db.QueryRow(`SELECT enabled FROM default_command_settings WHERE broadcaster_login=$1 AND command_name=$2`, broadcasterLogin, commandName)
	if err := row.Scan(&enabled); err != nil {
		if err == sql.ErrNoRows {
			return true, nil
		}
		return true, err
	}
	return enabled, nil
}

// SetDefaultCommandEnabled upserts the enabled flag for a broadcaster's
// default command.
func SetDefaultCommandEnabled(broadcasterLogin, commandName string, enabled bool) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	_, err := db.Exec(`
	INSERT INTO default_command_settings (broadcaster_login, command_name, enabled)
	VALUES ($1, $2, $3)
	ON CONFLICT (broadcaster_login, command_name) DO UPDATE
	SET enabled = EXCLUDED.enabled;
	`, broadcasterLogin, commandName, enabled)
	return err
}

// UpsertCustomCommand creates or updates a custom command for a broadcaster.
// The command name should include the leading '!' and is stored in lowercase.
func UpsertCustomCommand(broadcasterLogin, createdBy, commandName, response string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	_, err := db.Exec(`
	INSERT INTO custom_commands (broadcaster_login, command, response, created_by, created_at)
	VALUES ($1, $2, $3, $4, now())
	ON CONFLICT (broadcaster_login, command) DO UPDATE
	SET response = EXCLUDED.response,
	    created_by = EXCLUDED.created_by,
	    created_at = EXCLUDED.created_at;
	`, broadcasterLogin, commandName, response, createdBy)
	return err
}

// GetCustomCommandResponse returns the response and permitted role for a
// single custom command trigger, or empty strings if none exists. Only
// commands with enabled=true are returned.
func GetCustomCommandResponse(broadcasterLogin, commandName string) (string, string, error) {
	if db == nil {
		return "", "", nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	var resp string
	var role string
	row := db.QueryRow(`SELECT response, COALESCE(permitted_role, 'all') FROM custom_commands WHERE broadcaster_login=$1 AND command=$2 AND COALESCE(enabled, TRUE) = TRUE`, broadcasterLogin, commandName)
	if err := row.Scan(&resp, &role); err != nil {
		if err == sql.ErrNoRows {
			return "", "", nil
		}
		return "", "", err
	}
	return resp, role, nil
}

// CustomCommand represents a single stored custom command.
type CustomCommand struct {
	Command   string
	Response  string
	CreatedBy string
	CreatedAt time.Time
	Enabled   bool
	Role      string
}

// ListCustomCommands returns all custom commands for a broadcaster.
func ListCustomCommands(broadcasterLogin string) ([]CustomCommand, error) {
	res := []CustomCommand{}
	if db == nil {
		return res, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	rows, err := db.Query(`SELECT command, response, COALESCE(created_by, ''), COALESCE(created_at, now()), COALESCE(enabled, TRUE), COALESCE(permitted_role, 'all') FROM custom_commands WHERE broadcaster_login=$1 ORDER BY command`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c CustomCommand
		if err := rows.Scan(&c.Command, &c.Response, &c.CreatedBy, &c.CreatedAt, &c.Enabled, &c.Role); err != nil {
			return nil, err
		}
		res = append(res, c)
	}
	return res, nil
}

// DeleteCustomCommand removes a single custom command for a broadcaster.
func DeleteCustomCommand(broadcasterLogin, commandName string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	_, err := db.Exec(`DELETE FROM custom_commands WHERE broadcaster_login=$1 AND command=$2`, broadcasterLogin, commandName)
	return err
}

// SetCustomCommandEnabled updates the enabled flag for a custom command.
func SetCustomCommandEnabled(broadcasterLogin, commandName string, enabled bool) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	_, err := db.Exec(`UPDATE custom_commands SET enabled=$3 WHERE broadcaster_login=$1 AND command=$2`, broadcasterLogin, commandName, enabled)
	return err
}

// UpdateCustomCommand updates the name, response, and permitted role for a
// custom command owned by a broadcaster. oldName is used to locate the
// existing row in case the name is being changed.
func UpdateCustomCommand(broadcasterLogin, oldName, newName, response, role string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	oldName = strings.ToLower(oldName)
	newName = strings.ToLower(newName)
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" {
		role = "all"
	}
	_, err := db.Exec(`UPDATE custom_commands SET command=$3, response=$4, permitted_role=$5 WHERE broadcaster_login=$1 AND command=$2`, broadcasterLogin, oldName, newName, response, role)
	return err
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
	CREATE TABLE IF NOT EXISTS default_command_settings (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 command_name TEXT NOT NULL,
	 enabled BOOLEAN NOT NULL DEFAULT TRUE,
	 UNIQUE (broadcaster_login, command_name)
	);
	CREATE TABLE IF NOT EXISTS custom_commands (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 command TEXT NOT NULL,
	 response TEXT NOT NULL,
	 created_by TEXT,
	 created_at TIMESTAMPTZ DEFAULT now(),
	 UNIQUE (broadcaster_login, command)
	);
	CREATE TABLE IF NOT EXISTS channels (
	 id SERIAL PRIMARY KEY,
	 login TEXT UNIQUE NOT NULL,
	 owner_user TEXT,
	 joined BOOLEAN DEFAULT FALSE,
	 joined_at TIMESTAMPTZ
	);
	CREATE TABLE IF NOT EXISTS watch_time (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 viewer_login TEXT NOT NULL,
	 total_seconds BIGINT NOT NULL DEFAULT 0,
	 last_seen_at TIMESTAMPTZ,
	 UNIQUE (broadcaster_login, viewer_login)
	);
	`)
	if err != nil {
		return err
	}

	// Backfill: ensure custom_commands has an enabled flag for per-command toggles.
	if _, err := db.Exec(`ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE`); err != nil {
		return err
	}
	// Backfill: ensure custom_commands has a permitted_role field for
	// per-command role restrictions.
	if _, err := db.Exec(`ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS permitted_role TEXT NOT NULL DEFAULT 'all'`); err != nil {
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
