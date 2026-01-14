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

// GetUserTokens returns both access and refresh tokens for a given Twitch login.
func GetUserTokens(login string) (string, string, error) {
	if db == nil {
		return "", "", fmt.Errorf("db not initialized")
	}
	var access, refresh string
	row := db.QueryRow(`SELECT access_token, refresh_token FROM users WHERE login = $1`, login)
	if err := row.Scan(&access, &refresh); err != nil {
		return "", "", err
	}
	return access, refresh, nil
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

// GetModuleEnabled returns whether a given module is enabled for a
// broadcaster. If no row exists, it is treated as enabled.
func GetModuleEnabled(broadcasterLogin, moduleName string) (bool, error) {
	if db == nil {
		return true, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	moduleName = strings.ToLower(moduleName)
	var enabled bool
	row := db.QueryRow(`SELECT enabled FROM module_settings WHERE broadcaster_login=$1 AND module_name=$2`, broadcasterLogin, moduleName)
	if err := row.Scan(&enabled); err != nil {
		if err == sql.ErrNoRows {
			return true, nil
		}
		return true, err
	}
	return enabled, nil
}

// SetModuleEnabled upserts the enabled flag for a broadcaster's module.
func SetModuleEnabled(broadcasterLogin, moduleName string, enabled bool) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	moduleName = strings.ToLower(moduleName)
	_, err := db.Exec(`
	INSERT INTO module_settings (broadcaster_login, module_name, enabled)
	VALUES ($1, $2, $3)
	ON CONFLICT (broadcaster_login, module_name) DO UPDATE
	SET enabled = EXCLUDED.enabled;
	`, broadcasterLogin, moduleName, enabled)
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

// IncrementCustomCommandCount increments the usage counter for a single
// custom command and returns the new value. If the command does not exist
// or the DB is not initialized, it returns 0 without error.
func IncrementCustomCommandCount(broadcasterLogin, commandName string) (int64, error) {
	if db == nil {
		return 0, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	var count int64
	row := db.QueryRow(`
UPDATE custom_commands
SET usage_count = COALESCE(usage_count, 0) + 1
WHERE broadcaster_login=$1 AND command=$2
RETURNING usage_count;
`, broadcasterLogin, commandName)
	if err := row.Scan(&count); err != nil {
		if err == sql.ErrNoRows {
			// Command missing; treat as zero without failing the caller.
			return 0, nil
		}
		return 0, err
	}
	return count, nil
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

// AuditLogEntry represents a single channel activity entry used for the
// dashboard's recent activity feed.
type AuditLogEntry struct {
	Source      string
	Category    string
	Description string
	CreatedAt   time.Time
}

// BroadcasterSettings stores per-broadcaster configuration such as
// timezone used for date-based features (e.g. birthdays).
type BroadcasterSettings struct {
	BroadcasterLogin string
	Timezone         string
}

// Birthday represents a single stored birthday for a broadcaster's channel.
// Each user_login can have at most one birthday per broadcaster.
type Birthday struct {
	ID               int64
	BroadcasterLogin string
	UserLogin        string
	DisplayName      string
	Month            int
	Day              int
	CreatedAt        time.Time
	UpdatedAt        time.Time
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

// UpsertBirthday creates or updates a birthday entry for a given broadcaster
// and user. The userLogin key is stored in lowercase; displayName preserves
// the casing used when the birthday was added.
func UpsertBirthday(broadcasterLogin, userLogin, displayName string, month, day int) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	userLogin = strings.ToLower(userLogin)
	_, err := db.Exec(`
INSERT INTO birthdays (broadcaster_login, user_login, display_name, month, day, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, now(), now())
ON CONFLICT (broadcaster_login, user_login) DO UPDATE
SET display_name = EXCLUDED.display_name,
    month        = EXCLUDED.month,
    day          = EXCLUDED.day,
    updated_at   = now();
`, broadcasterLogin, userLogin, displayName, month, day)
	return err
}

// DeleteBirthday removes a single birthday for a broadcaster by user login
// (case-insensitive). It returns nil if the row does not exist.
func DeleteBirthday(broadcasterLogin, userLogin string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	userLogin = strings.ToLower(userLogin)
	_, err := db.Exec(`DELETE FROM birthdays WHERE broadcaster_login=$1 AND user_login=$2`, broadcasterLogin, userLogin)
	return err
}

// GetBirthdayForUser returns a birthday entry for a specific user in a
// broadcaster's channel, or nil if none exists.
func GetBirthdayForUser(broadcasterLogin, userLogin string) (*Birthday, error) {
	if db == nil {
		return nil, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	userLogin = strings.ToLower(userLogin)
	row := db.QueryRow(`
SELECT id, broadcaster_login, user_login, COALESCE(display_name, ''), month, day, COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM birthdays
WHERE broadcaster_login=$1 AND user_login=$2
`, broadcasterLogin, userLogin)
	var b Birthday
	if err := row.Scan(&b.ID, &b.BroadcasterLogin, &b.UserLogin, &b.DisplayName, &b.Month, &b.Day, &b.CreatedAt, &b.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

// ListBirthdays returns all birthdays for a broadcaster ordered by month,day
// and then display name.
func ListBirthdays(broadcasterLogin string) ([]Birthday, error) {
	res := []Birthday{}
	if db == nil {
		return res, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	rows, err := db.Query(`
SELECT id, broadcaster_login, user_login, COALESCE(display_name, ''), month, day, COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM birthdays
WHERE broadcaster_login=$1
ORDER BY month, day, display_name;
`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var b Birthday
		if err := rows.Scan(&b.ID, &b.BroadcasterLogin, &b.UserLogin, &b.DisplayName, &b.Month, &b.Day, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		res = append(res, b)
	}
	return res, nil
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

// InsertAuditLog writes a single audit log entry for a broadcaster. It is
// best-effort and will silently return on missing DB or empty input.
func InsertAuditLog(broadcasterLogin, source, category, description string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	source = strings.ToLower(strings.TrimSpace(source))
	category = strings.ToLower(strings.TrimSpace(category))
	description = strings.TrimSpace(description)
	if broadcasterLogin == "" || description == "" {
		return nil
	}
	_, err := db.Exec(`
	INSERT INTO channel_audit_logs (broadcaster_login, source, category, description)
	VALUES ($1, $2, $3, $4);
	`, broadcasterLogin, source, category, description)
	return err
}

// GetRecentAuditLogs returns the most recent N audit log entries for a
// broadcaster, ordered from newest to oldest.
func GetRecentAuditLogs(broadcasterLogin string, limit int) ([]AuditLogEntry, error) {
	logs := []AuditLogEntry{}
	if db == nil {
		return logs, nil
	}
	if limit <= 0 {
		limit = 20
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	rows, err := db.Query(`
	SELECT source, category, description, created_at
	FROM channel_audit_logs
	WHERE broadcaster_login=$1
	ORDER BY created_at DESC
	LIMIT $2;
	`, broadcasterLogin, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var e AuditLogEntry
		if err := rows.Scan(&e.Source, &e.Category, &e.Description, &e.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, e)
	}
	return logs, nil
}

// GetBroadcasterTimezone returns the stored IANA timezone name for a
// broadcaster, or an empty string if none has been set.
func GetBroadcasterTimezone(broadcasterLogin string) (string, error) {
	if db == nil {
		return "", nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	if broadcasterLogin == "" {
		return "", nil
	}
	var tz sql.NullString
	row := db.QueryRow(`SELECT timezone FROM broadcaster_settings WHERE broadcaster_login=$1`, broadcasterLogin)
	if err := row.Scan(&tz); err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	if tz.Valid {
		return strings.TrimSpace(tz.String), nil
	}
	return "", nil
}

// SetBroadcasterTimezone upserts the timezone for a broadcaster. The timezone
// must be a valid IANA name (validation is handled by the caller).
func SetBroadcasterTimezone(broadcasterLogin, timezone string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	timezone = strings.TrimSpace(timezone)
	if broadcasterLogin == "" {
		return nil
	}
	_, err := db.Exec(`
INSERT INTO broadcaster_settings (broadcaster_login, timezone)
VALUES ($1, $2)
ON CONFLICT (broadcaster_login) DO UPDATE
SET timezone = EXCLUDED.timezone;
`, broadcasterLogin, timezone)
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
	CREATE TABLE IF NOT EXISTS module_settings (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 module_name TEXT NOT NULL,
	 enabled BOOLEAN NOT NULL DEFAULT TRUE,
	 message TEXT,
	 UNIQUE (broadcaster_login, module_name)
	);
	CREATE TABLE IF NOT EXISTS channels (
	 id SERIAL PRIMARY KEY,
	 login TEXT UNIQUE NOT NULL,
	 owner_user TEXT,
	 joined BOOLEAN DEFAULT FALSE,
	 joined_at TIMESTAMPTZ
	);
	CREATE TABLE IF NOT EXISTS birthdays (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 user_login TEXT NOT NULL,
	 display_name TEXT,
	 month INTEGER NOT NULL,
	 day INTEGER NOT NULL,
	 created_at TIMESTAMPTZ DEFAULT now(),
	 updated_at TIMESTAMPTZ DEFAULT now(),
	 UNIQUE (broadcaster_login, user_login)
	);
	CREATE TABLE IF NOT EXISTS watch_time (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 viewer_login TEXT NOT NULL,
	 total_seconds BIGINT NOT NULL DEFAULT 0,
	 last_seen_at TIMESTAMPTZ,
	 UNIQUE (broadcaster_login, viewer_login)
	);
	CREATE TABLE IF NOT EXISTS channel_audit_logs (
	 id SERIAL PRIMARY KEY,
	 broadcaster_login TEXT NOT NULL,
	 source TEXT NOT NULL,
	 category TEXT NOT NULL,
	 description TEXT NOT NULL,
	 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE INDEX IF NOT EXISTS idx_channel_audit_logs_login_created_at ON channel_audit_logs (broadcaster_login, created_at DESC);
	CREATE TABLE IF NOT EXISTS broadcaster_settings (
	 broadcaster_login TEXT PRIMARY KEY,
	 timezone TEXT
	);
	`)
	if err != nil {
		return err
	}

	// Backfill: ensure module_settings has a message column for per-module
	// configurable messages (e.g. live announcement text).
	if _, err := db.Exec(`ALTER TABLE module_settings ADD COLUMN IF NOT EXISTS message TEXT`); err != nil {
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

	// Backfill: ensure custom_commands has a usage_count field for
	// per-command counters used by the $(count) template variable.
	if _, err := db.Exec(`ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS usage_count BIGINT NOT NULL DEFAULT 0`); err != nil {
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

// GetModuleMessage returns the stored message template for a given module, or
// an empty string if none has been set.
func GetModuleMessage(broadcasterLogin, moduleName string) (string, error) {
	if db == nil {
		return "", nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	moduleName = strings.ToLower(moduleName)
	var msg sql.NullString
	row := db.QueryRow(`SELECT message FROM module_settings WHERE broadcaster_login=$1 AND module_name=$2`, broadcasterLogin, moduleName)
	if err := row.Scan(&msg); err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	if msg.Valid {
		return msg.String, nil
	}
	return "", nil
}

// SetModuleMessage upserts the message template for a broadcaster's module
// without altering the enabled flag.
func SetModuleMessage(broadcasterLogin, moduleName, message string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	moduleName = strings.ToLower(moduleName)
	_, err := db.Exec(`
	INSERT INTO module_settings (broadcaster_login, module_name, message)
	VALUES ($1, $2, $3)
	ON CONFLICT (broadcaster_login, module_name) DO UPDATE
	SET message = EXCLUDED.message;
	`, broadcasterLogin, moduleName, message)
	return err
}
