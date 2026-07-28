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
// broadcaster. If no row exists, it is treated as enabled by default,
// except for certain modules that are explicitly default-off.
func GetModuleEnabled(broadcasterLogin, moduleName string) (bool, error) {
	if db == nil {
		// In the absence of a database, treat modules as enabled so core
		// functionality works. The birthdays module is the exception and
		// defaults to disabled until explicitly turned on.
		if strings.EqualFold(moduleName, "birthdays") {
			return false, nil
		}
		return true, nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	moduleName = strings.ToLower(moduleName)
	var enabled bool
	row := db.QueryRow(`SELECT enabled FROM module_settings WHERE broadcaster_login=$1 AND module_name=$2`, broadcasterLogin, moduleName)
	if err := row.Scan(&enabled); err != nil {
		if err == sql.ErrNoRows {
			// Default-off behavior for birthdays: new channels start with the
			// birthdays module disabled until they explicitly enable it from
			// the dashboard.
			if moduleName == "birthdays" {
				return false, nil
			}
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
func UpsertCustomCommand(broadcasterLogin, createdBy, commandName, response, role string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	if role == "" {
		role = "all"
	}
	_, err := db.Exec(`
	INSERT INTO custom_commands (broadcaster_login, command, response, created_by, created_at, permitted_role)
	VALUES ($1, $2, $3, $4, now(), $5)
	ON CONFLICT (broadcaster_login, command) DO UPDATE
	SET response = EXCLUDED.response,
	    created_by = EXCLUDED.created_by,
	    created_at = EXCLUDED.created_at,
	    permitted_role = EXCLUDED.permitted_role;
	`, broadcasterLogin, commandName, response, createdBy, role)
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
	CREATE TABLE IF NOT EXISTS birthday_command_messages (
	 broadcaster_login TEXT NOT NULL,
	 command_name TEXT NOT NULL,
	 message TEXT NOT NULL,
	 PRIMARY KEY (broadcaster_login, command_name)
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
	CREATE TABLE IF NOT EXISTS discord_settings (
	 broadcaster_login TEXT NOT NULL,
	 guild_id           TEXT NOT NULL DEFAULT '',
	 live_channel_id    TEXT NOT NULL DEFAULT '',
	 mod_channel_id     TEXT NOT NULL DEFAULT '',
	 bday_channel_id    TEXT NOT NULL DEFAULT '',
	 updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
	 PRIMARY KEY (broadcaster_login, guild_id)
	);
	CREATE TABLE IF NOT EXISTS discord_warnings (
	 id           SERIAL PRIMARY KEY,
	 guild_id     TEXT NOT NULL,
	 user_id      TEXT NOT NULL,
	 username     TEXT NOT NULL DEFAULT '',
	 moderator_id TEXT NOT NULL,
	 mod_username TEXT NOT NULL DEFAULT '',
	 reason       TEXT NOT NULL DEFAULT '',
	 created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE INDEX IF NOT EXISTS idx_discord_warnings_guild_user ON discord_warnings(guild_id, user_id);
	CREATE TABLE IF NOT EXISTS discord_role_mappings (
	 broadcaster_login TEXT NOT NULL,
	 guild_id          TEXT NOT NULL,
	 twitch_level      TEXT NOT NULL,
	 discord_role_id   TEXT NOT NULL DEFAULT '',
	 discord_role_name TEXT NOT NULL DEFAULT '',
	 updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
	 PRIMARY KEY (broadcaster_login, guild_id, twitch_level)
	);
	CREATE TABLE IF NOT EXISTS discord_notification_templates (
	 broadcaster_login TEXT NOT NULL,
	 notification_type TEXT NOT NULL,
	 template          TEXT NOT NULL DEFAULT '',
	 updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
	 PRIMARY KEY (broadcaster_login, notification_type)
	);
	CREATE TABLE IF NOT EXISTS discord_guild_modules (
	 guild_id TEXT NOT NULL,
	 module   TEXT NOT NULL,
	 enabled  BOOLEAN NOT NULL DEFAULT TRUE,
	 PRIMARY KEY (guild_id, module)
	);
	CREATE TABLE IF NOT EXISTS discord_command_settings (
	 guild_id TEXT NOT NULL,
	 cmd_key  TEXT NOT NULL,
	 value    TEXT NOT NULL DEFAULT '',
	 PRIMARY KEY (guild_id, cmd_key)
	);
	CREATE TABLE IF NOT EXISTS discord_mod_cases (
	 id          BIGSERIAL,
	 guild_id    TEXT NOT NULL,
	 case_number INT NOT NULL,
	 action      TEXT NOT NULL,
	 target_id   TEXT NOT NULL,
	 target_name TEXT NOT NULL DEFAULT '',
	 mod_id      TEXT NOT NULL,
	 mod_name    TEXT NOT NULL DEFAULT '',
	 reason      TEXT NOT NULL DEFAULT 'No reason provided',
	 created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	 UNIQUE (guild_id, case_number)
	);
	CREATE INDEX IF NOT EXISTS idx_discord_mod_cases_guild_target ON discord_mod_cases(guild_id, target_id);
	CREATE TABLE IF NOT EXISTS discord_member_notes (
	 id         BIGSERIAL PRIMARY KEY,
	 guild_id   TEXT NOT NULL,
	 target_id  TEXT NOT NULL,
	 mod_id     TEXT NOT NULL,
	 mod_name   TEXT NOT NULL DEFAULT '',
	 note       TEXT NOT NULL,
	 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE INDEX IF NOT EXISTS idx_discord_member_notes_guild_target ON discord_member_notes(guild_id, target_id);
	CREATE TABLE IF NOT EXISTS discord_mod_roles (
	 guild_id  TEXT NOT NULL,
	 role_id   TEXT NOT NULL,
	 role_name TEXT NOT NULL DEFAULT '',
	 PRIMARY KEY (guild_id, role_id)
	);
	CREATE TABLE IF NOT EXISTS discord_joinable_ranks (
	 guild_id  TEXT NOT NULL,
	 role_id   TEXT NOT NULL,
	 role_name TEXT NOT NULL DEFAULT '',
	 PRIMARY KEY (guild_id, role_id)
	);
	CREATE TABLE IF NOT EXISTS discord_role_persist (
	 guild_id TEXT NOT NULL,
	 user_id  TEXT NOT NULL,
	 role_id  TEXT NOT NULL,
	 PRIMARY KEY (guild_id, user_id, role_id)
	);
	CREATE TABLE IF NOT EXISTS discord_temp_roles (
	 id         BIGSERIAL PRIMARY KEY,
	 guild_id   TEXT NOT NULL,
	 user_id    TEXT NOT NULL,
	 role_id    TEXT NOT NULL,
	 expires_at TIMESTAMPTZ NOT NULL
	);
	CREATE TABLE IF NOT EXISTS discord_reminders (
	 id         BIGSERIAL PRIMARY KEY,
	 user_id    TEXT NOT NULL,
	 channel_id TEXT NOT NULL,
	 reminder   TEXT NOT NULL,
	 remind_at  TIMESTAMPTZ NOT NULL
	);
	CREATE TABLE IF NOT EXISTS discord_afk (
	 guild_id TEXT NOT NULL,
	 user_id  TEXT NOT NULL,
	 status   TEXT NOT NULL DEFAULT 'AFK',
	 set_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	 PRIMARY KEY (guild_id, user_id)
	);
	CREATE TABLE IF NOT EXISTS discord_highlights (
	 guild_id TEXT NOT NULL,
	 user_id  TEXT NOT NULL,
	 phrase   TEXT NOT NULL,
	 PRIMARY KEY (guild_id, user_id, phrase)
	);
	CREATE TABLE IF NOT EXISTS discord_tags (
	 guild_id   TEXT NOT NULL,
	 name       TEXT NOT NULL,
	 content    TEXT NOT NULL,
	 author_id  TEXT NOT NULL DEFAULT '',
	 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	 PRIMARY KEY (guild_id, name)
	);
	CREATE TABLE IF NOT EXISTS discord_giveaways (
	 id           BIGSERIAL PRIMARY KEY,
	 guild_id     TEXT NOT NULL,
	 channel_id   TEXT NOT NULL,
	 message_id   TEXT NOT NULL DEFAULT '',
	 prize        TEXT NOT NULL,
	 winner_count INT NOT NULL DEFAULT 1,
	 host_id      TEXT NOT NULL DEFAULT '',
	 ends_at      TIMESTAMPTZ NOT NULL,
	 ended        BOOLEAN NOT NULL DEFAULT FALSE,
	 created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	CREATE TABLE IF NOT EXISTS discord_ignored_channels (
	 guild_id   TEXT NOT NULL,
	 channel_id TEXT NOT NULL,
	 PRIMARY KEY (guild_id, channel_id)
	);
	CREATE TABLE IF NOT EXISTS discord_lockdown_channels (
	 guild_id   TEXT NOT NULL,
	 channel_id TEXT NOT NULL,
	 PRIMARY KEY (guild_id, channel_id)
	);
	CREATE TABLE IF NOT EXISTS discord_guild_managers (
	 guild_id     TEXT NOT NULL,
	 twitch_login TEXT NOT NULL,
	 added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	 PRIMARY KEY (guild_id, twitch_login)
	);
	CREATE TABLE IF NOT EXISTS discord_welcome_settings (
	 guild_id           TEXT NOT NULL PRIMARY KEY,
	 welcome_channel_id TEXT NOT NULL DEFAULT '',
	 welcome_message    TEXT NOT NULL DEFAULT '',
	 auto_role_ids      TEXT NOT NULL DEFAULT '',
	 updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
	);
	`)
	if err != nil {
		return err
	}

	// Migrate discord_settings from single-column PK to composite PK (broadcaster_login, guild_id).
	// Safe to run repeatedly — the DO block is a no-op if already composite.
	if _, err := db.Exec(`
		DO $$
		BEGIN
			IF (SELECT COUNT(*) FROM information_schema.key_column_usage
					WHERE constraint_name = 'discord_settings_pkey'
					AND table_name = 'discord_settings'
					AND table_schema = 'public') = 1 THEN
				ALTER TABLE discord_settings DROP CONSTRAINT discord_settings_pkey;
				ALTER TABLE discord_settings ADD PRIMARY KEY (broadcaster_login, guild_id);
			END IF;
		END $$;
	`); err != nil {
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

	// Backfill: add leave_channel_id to discord_welcome_settings for member-leave logs.
	if _, err := db.Exec(`ALTER TABLE discord_welcome_settings ADD COLUMN IF NOT EXISTS leave_channel_id TEXT NOT NULL DEFAULT ''`); err != nil {
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

// GetBirthdayCommandMessage returns a custom message template for a
// birthday-related command for the given broadcaster. If no row exists,
// an empty string is returned.
func GetBirthdayCommandMessage(broadcasterLogin, commandName string) (string, error) {
	if db == nil {
		return "", nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	var msg sql.NullString
	row := db.QueryRow(`SELECT message FROM birthday_command_messages WHERE broadcaster_login=$1 AND command_name=$2`, broadcasterLogin, commandName)
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

// SetBirthdayCommandMessage upserts a custom message template for a
// birthday-related command without affecting other commands.
func SetBirthdayCommandMessage(broadcasterLogin, commandName, message string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	_, err := db.Exec(`
	INSERT INTO birthday_command_messages (broadcaster_login, command_name, message)
	VALUES ($1, $2, $3)
	ON CONFLICT (broadcaster_login, command_name) DO UPDATE
	SET message = EXCLUDED.message;
	`, broadcasterLogin, commandName, message)
	return err
}

// DeleteBirthdayCommandMessage removes any custom message for a
// birthday-related command so the default wording is used again.
func DeleteBirthdayCommandMessage(broadcasterLogin, commandName string) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(broadcasterLogin)
	commandName = strings.ToLower(commandName)
	_, err := db.Exec(`DELETE FROM birthday_command_messages WHERE broadcaster_login=$1 AND command_name=$2`, broadcasterLogin, commandName)
	return err
}

// ─── Blocked Terms ────────────────────────────────────────────────────────────

// BlockedTerm represents a single stored blocked term for a broadcaster.
type BlockedTerm struct {
	ID               int64
	BroadcasterLogin string
	Term             string
	Action           string // "timeout", "delete", "ban"
	TimeoutSeconds   int
	CreatedAt        time.Time
}

// EnsureBlockedTermsTable creates the blocked_terms table if it does not exist.
func EnsureBlockedTermsTable() error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS blocked_terms (
		id                BIGSERIAL PRIMARY KEY,
		broadcaster_login TEXT      NOT NULL,
		term              TEXT      NOT NULL,
		action            TEXT      NOT NULL DEFAULT 'delete',
		timeout_seconds   INT       NOT NULL DEFAULT 60,
		created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
		UNIQUE (broadcaster_login, term)
	);`)
	return err
}

// AddBlockedTerm inserts or replaces a blocked term for a broadcaster.
func AddBlockedTerm(broadcasterLogin, term, action string, timeoutSeconds int) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	term = strings.ToLower(strings.TrimSpace(term))
	action = strings.ToLower(strings.TrimSpace(action))
	var id int64
	row := db.QueryRow(`
	INSERT INTO blocked_terms (broadcaster_login, term, action, timeout_seconds)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (broadcaster_login, term) DO UPDATE
	SET action = EXCLUDED.action, timeout_seconds = EXCLUDED.timeout_seconds
	RETURNING id;
	`, broadcasterLogin, term, action, timeoutSeconds)
	if err := row.Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

// ListBlockedTerms returns all blocked terms for a broadcaster ordered alphabetically.
func ListBlockedTerms(broadcasterLogin string) ([]BlockedTerm, error) {
	res := []BlockedTerm{}
	if db == nil {
		return res, nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	rows, err := db.Query(`
	SELECT id, broadcaster_login, term, action, timeout_seconds, created_at
	FROM blocked_terms
	WHERE broadcaster_login = $1
	ORDER BY term;
	`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var t BlockedTerm
		if err := rows.Scan(&t.ID, &t.BroadcasterLogin, &t.Term, &t.Action, &t.TimeoutSeconds, &t.CreatedAt); err != nil {
			return nil, err
		}
		res = append(res, t)
	}
	return res, nil
}

// DeleteBlockedTerm removes a blocked term by ID for a broadcaster.
func DeleteBlockedTerm(broadcasterLogin string, id int64) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	_, err := db.Exec(`DELETE FROM blocked_terms WHERE broadcaster_login=$1 AND id=$2`, broadcasterLogin, id)
	return err
}

// UserRole represents a role assignment for a user in a broadcaster's channel.
type UserRole struct {
	ID               int64
	BroadcasterLogin string
	Username         string
	Role             string // "Editor", "Mod", "Regular"
	CreatedAt        time.Time
}

// EnsureRolesTable creates the user_roles table if it does not exist.
func EnsureRolesTable() error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS user_roles (
		id                BIGSERIAL PRIMARY KEY,
		broadcaster_login TEXT        NOT NULL,
		username          TEXT        NOT NULL,
		role              TEXT        NOT NULL DEFAULT 'Regular',
		created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
		UNIQUE (broadcaster_login, username)
	);`)
	return err
}

// AddUserRole inserts or replaces a role assignment for a user.
func AddUserRole(broadcasterLogin, username, role string) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	username = strings.ToLower(strings.TrimSpace(username))
	var id int64
	row := db.QueryRow(`
	INSERT INTO user_roles (broadcaster_login, username, role)
	VALUES ($1, $2, $3)
	ON CONFLICT (broadcaster_login, username) DO UPDATE
	SET role = EXCLUDED.role
	RETURNING id;
	`, broadcasterLogin, username, role)
	if err := row.Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

// ListUserRoles returns all role assignments for a broadcaster ordered by username.
func ListUserRoles(broadcasterLogin string) ([]UserRole, error) {
	res := []UserRole{}
	if db == nil {
		return res, nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	rows, err := db.Query(`
	SELECT id, broadcaster_login, username, role, created_at
	FROM user_roles
	WHERE broadcaster_login = $1
	ORDER BY username;
	`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r UserRole
		if err := rows.Scan(&r.ID, &r.BroadcasterLogin, &r.Username, &r.Role, &r.CreatedAt); err != nil {
			return nil, err
		}
		res = append(res, r)
	}
	return res, nil
}

// DeleteUserRole removes a role assignment by ID for a broadcaster.
func DeleteUserRole(broadcasterLogin string, id int64) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	_, err := db.Exec(`DELETE FROM user_roles WHERE broadcaster_login=$1 AND id=$2`, broadcasterLogin, id)
	return err
}

// ListEditorChannels returns all broadcaster logins where the given username
// has been assigned the "Editor" role.
func ListEditorChannels(username string) ([]string, error) {
	if db == nil {
		return nil, nil
	}
	username = strings.ToLower(strings.TrimSpace(username))
	rows, err := db.Query(`
	SELECT broadcaster_login FROM user_roles
	WHERE username = $1 AND role = 'Editor'
	ORDER BY broadcaster_login;
	`, username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}

// DiscordSettings holds per-broadcaster Discord configuration.
type DiscordSettings struct {
	BroadcasterLogin string
	GuildID          string
	LiveChannelID    string
	ModChannelID     string
	BdayChannelID    string
}

// GetDiscordSettings returns the Discord settings for a specific
// (broadcaster, guild) pair, or nil if no row exists yet.
func GetDiscordSettings(broadcasterLogin, guildID string) (*DiscordSettings, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	guildID = strings.TrimSpace(guildID)
	row := db.QueryRowContext(context.Background(), `
		SELECT broadcaster_login, guild_id, live_channel_id, mod_channel_id, bday_channel_id
		FROM discord_settings WHERE broadcaster_login = $1 AND guild_id = $2
	`, broadcasterLogin, guildID)
	var s DiscordSettings
	if err := row.Scan(&s.BroadcasterLogin, &s.GuildID, &s.LiveChannelID, &s.ModChannelID, &s.BdayChannelID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

// GetAllDiscordSettingsForBroadcaster returns every guild row saved by a
// broadcaster. Used by notification helpers to fan-out to all linked servers.
func GetAllDiscordSettingsForBroadcaster(broadcasterLogin string) ([]DiscordSettings, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	rows, err := db.QueryContext(context.Background(), `
		SELECT broadcaster_login, guild_id, live_channel_id, mod_channel_id, bday_channel_id
		FROM discord_settings WHERE broadcaster_login = $1
	`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DiscordSettings
	for rows.Next() {
		var s DiscordSettings
		if err := rows.Scan(&s.BroadcasterLogin, &s.GuildID, &s.LiveChannelID, &s.ModChannelID, &s.BdayChannelID); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}

// GetDiscordSettingsByGuild looks up Discord settings by guild ID, used to
// resolve a guild's linked Twitch channel for slash commands.
func GetDiscordSettingsByGuild(guildID string) (*DiscordSettings, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	guildID = strings.TrimSpace(guildID)
	row := db.QueryRowContext(context.Background(), `
		SELECT broadcaster_login, guild_id, live_channel_id, mod_channel_id, bday_channel_id
		FROM discord_settings WHERE guild_id = $1
	`, guildID)
	var s DiscordSettings
	if err := row.Scan(&s.BroadcasterLogin, &s.GuildID, &s.LiveChannelID, &s.ModChannelID, &s.BdayChannelID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

// SaveDiscordSettings upserts Discord settings for a (broadcaster, guild) pair.
func SaveDiscordSettings(s DiscordSettings) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	s.BroadcasterLogin = strings.ToLower(strings.TrimSpace(s.BroadcasterLogin))
	_, err := db.ExecContext(context.Background(), `
		INSERT INTO discord_settings (broadcaster_login, guild_id, live_channel_id, mod_channel_id, bday_channel_id, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (broadcaster_login, guild_id) DO UPDATE SET
			live_channel_id = EXCLUDED.live_channel_id,
			mod_channel_id  = EXCLUDED.mod_channel_id,
			bday_channel_id = EXCLUDED.bday_channel_id,
			updated_at      = NOW()
	`, s.BroadcasterLogin, s.GuildID, s.LiveChannelID, s.ModChannelID, s.BdayChannelID)
	return err
}

// DiscordWarning represents a single warning issued to a Discord member.
type DiscordWarning struct {
	ID          int64
	GuildID     string
	UserID      string
	Username    string
	ModeratorID string
	ModUsername string
	Reason      string
	CreatedAt   time.Time
}

// AddDiscordWarning stores a new warning and returns the user's total warning
// count in the guild after the insert.
func AddDiscordWarning(guildID, userID, username, modID, modUsername, reason string) (int, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	if _, err := db.Exec(`
		INSERT INTO discord_warnings (guild_id, user_id, username, moderator_id, mod_username, reason)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, guildID, userID, username, modID, modUsername, reason); err != nil {
		return 0, err
	}
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM discord_warnings WHERE guild_id=$1 AND user_id=$2`,
		guildID, userID).Scan(&count)
	return count, err
}

// GetDiscordWarnings returns all warnings for a user in a guild, newest first.
func GetDiscordWarnings(guildID, userID string) ([]DiscordWarning, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`
		SELECT id, guild_id, user_id, username, moderator_id, mod_username, reason, created_at
		FROM discord_warnings
		WHERE guild_id = $1 AND user_id = $2
		ORDER BY created_at DESC
	`, guildID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DiscordWarning
	for rows.Next() {
		var w DiscordWarning
		if err := rows.Scan(&w.ID, &w.GuildID, &w.UserID, &w.Username, &w.ModeratorID, &w.ModUsername, &w.Reason, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, nil
}

// ClearDiscordWarnings removes all warnings for a user in a guild and returns
// the number of records deleted.
func ClearDiscordWarnings(guildID, userID string) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	res, err := db.Exec(`DELETE FROM discord_warnings WHERE guild_id = $1 AND user_id = $2`, guildID, userID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DiscordRoleMapping maps a Twitch permission level to a Discord role for a
// specific (broadcaster, guild) pair.
type DiscordRoleMapping struct {
	BroadcasterLogin string
	GuildID          string
	TwitchLevel      string // "everyone", "vip", "moderator", "owner"
	DiscordRoleID    string
	DiscordRoleName  string
}

// GetDiscordRoleMappings returns all role mappings for a (broadcaster, guild).
func GetDiscordRoleMappings(broadcasterLogin, guildID string) ([]DiscordRoleMapping, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	rows, err := db.QueryContext(context.Background(), `
		SELECT broadcaster_login, guild_id, twitch_level, discord_role_id, discord_role_name
		FROM discord_role_mappings
		WHERE broadcaster_login = $1 AND guild_id = $2
	`, broadcasterLogin, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DiscordRoleMapping
	for rows.Next() {
		var m DiscordRoleMapping
		if err := rows.Scan(&m.BroadcasterLogin, &m.GuildID, &m.TwitchLevel, &m.DiscordRoleID, &m.DiscordRoleName); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}

// SaveDiscordRoleMapping upserts a single role mapping.
func SaveDiscordRoleMapping(m DiscordRoleMapping) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	m.BroadcasterLogin = strings.ToLower(strings.TrimSpace(m.BroadcasterLogin))
	_, err := db.ExecContext(context.Background(), `
		INSERT INTO discord_role_mappings (broadcaster_login, guild_id, twitch_level, discord_role_id, discord_role_name, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (broadcaster_login, guild_id, twitch_level) DO UPDATE SET
			discord_role_id   = EXCLUDED.discord_role_id,
			discord_role_name = EXCLUDED.discord_role_name,
			updated_at        = NOW()
	`, m.BroadcasterLogin, m.GuildID, m.TwitchLevel, m.DiscordRoleID, m.DiscordRoleName)
	return err
}

// GetDiscordNotificationTemplate returns the stored custom template for a
// notification type ("live", "mod", "birthday"), or "" if none is set.
func GetDiscordNotificationTemplate(broadcasterLogin, notificationType string) (string, error) {
	if db == nil {
		return "", nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	var tmpl string
	err := db.QueryRowContext(context.Background(),
		`SELECT template FROM discord_notification_templates WHERE broadcaster_login=$1 AND notification_type=$2`,
		broadcasterLogin, notificationType,
	).Scan(&tmpl)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return tmpl, err
}

// SaveDiscordNotificationTemplate upserts a custom template for a
// notification type. Pass an empty string to reset to the default.
func SaveDiscordNotificationTemplate(broadcasterLogin, notificationType, template string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	_, err := db.ExecContext(context.Background(), `
		INSERT INTO discord_notification_templates (broadcaster_login, notification_type, template, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (broadcaster_login, notification_type) DO UPDATE SET
			template   = EXCLUDED.template,
			updated_at = NOW()
	`, broadcasterLogin, notificationType, template)
	return err
}

// ─── Discord Guild Modules ────────────────────────────────────────────────────

// GetDiscordGuildModuleEnabled returns whether a module is enabled for a guild.
// Defaults to true if no row exists.
func GetDiscordGuildModuleEnabled(guildID, module string) (bool, error) {
	if db == nil {
		return true, nil
	}
	var enabled bool
	err := db.QueryRow(`SELECT enabled FROM discord_guild_modules WHERE guild_id=$1 AND module=$2`, guildID, module).Scan(&enabled)
	if err == sql.ErrNoRows {
		return true, nil
	}
	return enabled, err
}

// SetDiscordGuildModuleEnabled upserts the enabled flag for a guild module.
func SetDiscordGuildModuleEnabled(guildID, module string, enabled bool) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_guild_modules (guild_id, module, enabled)
		VALUES ($1, $2, $3)
		ON CONFLICT (guild_id, module) DO UPDATE SET enabled = EXCLUDED.enabled
	`, guildID, module, enabled)
	return err
}

// GetDiscordGuildModules returns all module states for a guild.
func GetDiscordGuildModules(guildID string) (map[string]bool, error) {
	out := map[string]bool{}
	if db == nil {
		return out, nil
	}
	rows, err := db.Query(`SELECT module, enabled FROM discord_guild_modules WHERE guild_id=$1`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var module string
		var enabled bool
		if err := rows.Scan(&module, &enabled); err != nil {
			return nil, err
		}
		out[module] = enabled
	}
	return out, nil
}

// ─── Discord Command Settings ─────────────────────────────────────────────────

// GetDiscordCommandSettings returns all command config values for a guild as a map of key→value.
func GetDiscordCommandSettings(guildID string) (map[string]string, error) {
	out := map[string]string{}
	if db == nil {
		return out, nil
	}
	rows, err := db.Query(`SELECT cmd_key, value FROM discord_command_settings WHERE guild_id=$1`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, nil
}

// SetDiscordCommandSetting upserts a single command config value for a guild.
func SetDiscordCommandSetting(guildID, cmdKey, value string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_command_settings (guild_id, cmd_key, value)
		VALUES ($1, $2, $3)
		ON CONFLICT (guild_id, cmd_key) DO UPDATE SET value = EXCLUDED.value
	`, guildID, cmdKey, value)
	return err
}

// ─── Discord Guild Managers ──────────────────────────────────────────────────

// AddDiscordGuildManager grants a Twitch user dashboard access to a guild.
func AddDiscordGuildManager(guildID, twitchLogin string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_guild_managers (guild_id, twitch_login)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, guildID, strings.ToLower(twitchLogin))
	return err
}

// RemoveDiscordGuildManager revokes a Twitch user's dashboard access to a guild.
func RemoveDiscordGuildManager(guildID, twitchLogin string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`DELETE FROM discord_guild_managers WHERE guild_id=$1 AND twitch_login=$2`,
		guildID, strings.ToLower(twitchLogin))
	return err
}

// GetDiscordGuildManagers returns all Twitch logins granted access to a guild.
func GetDiscordGuildManagers(guildID string) ([]string, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`SELECT twitch_login FROM discord_guild_managers WHERE guild_id=$1 ORDER BY added_at`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var logins []string
	for rows.Next() {
		var l string
		if err := rows.Scan(&l); err == nil {
			logins = append(logins, l)
		}
	}
	return logins, nil
}

// GetGuildsForManager returns the guild IDs that a Twitch user is a manager of.
func GetGuildsForManager(twitchLogin string) ([]string, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`SELECT guild_id FROM discord_guild_managers WHERE twitch_login=$1`, strings.ToLower(twitchLogin))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

// ─── Discord Mod Cases ────────────────────────────────────────────────────────

// DiscordModCase represents a single moderation log entry.
type DiscordModCase struct {
	ID         int64
	GuildID    string
	CaseNumber int
	Action     string
	TargetID   string
	TargetName string
	ModID      string
	ModName    string
	Reason     string
	CreatedAt  time.Time
}

// CreateDiscordModCase inserts a new mod case with an auto-incremented per-guild
// case number and returns that number.
func CreateDiscordModCase(guildID, action, targetID, targetName, modID, modName, reason string) (int, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	var caseNum int
	err := db.QueryRow(`
		WITH next AS (
			SELECT COALESCE(MAX(case_number), 0) + 1 AS n FROM discord_mod_cases WHERE guild_id = $1
		)
		INSERT INTO discord_mod_cases (guild_id, case_number, action, target_id, target_name, mod_id, mod_name, reason)
		SELECT $1, n, $2, $3, $4, $5, $6, $7 FROM next
		RETURNING case_number
	`, guildID, action, targetID, targetName, modID, modName, reason).Scan(&caseNum)
	return caseNum, err
}

// GetDiscordModCase returns a single mod case by guild and case number.
func GetDiscordModCase(guildID string, caseNum int) (*DiscordModCase, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	var c DiscordModCase
	err := db.QueryRow(`
		SELECT id, guild_id, case_number, action, target_id, target_name, mod_id, mod_name, reason, created_at
		FROM discord_mod_cases WHERE guild_id=$1 AND case_number=$2
	`, guildID, caseNum).Scan(&c.ID, &c.GuildID, &c.CaseNumber, &c.Action, &c.TargetID, &c.TargetName, &c.ModID, &c.ModName, &c.Reason, &c.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

// UpdateDiscordModCaseReason updates the reason on an existing mod case.
func UpdateDiscordModCaseReason(guildID string, caseNum int, reason string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	res, err := db.Exec(`UPDATE discord_mod_cases SET reason=$3 WHERE guild_id=$1 AND case_number=$2`, guildID, caseNum, reason)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("case #%d not found", caseNum)
	}
	return nil
}

// GetDiscordModCasesByUser returns all mod cases for a target user in a guild,
// ordered by case number descending.
func GetDiscordModCasesByUser(guildID, targetID string) ([]*DiscordModCase, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`
		SELECT id, guild_id, case_number, action, target_id, target_name, mod_id, mod_name, reason, created_at
		FROM discord_mod_cases WHERE guild_id=$1 AND target_id=$2
		ORDER BY case_number DESC
	`, guildID, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*DiscordModCase
	for rows.Next() {
		c := &DiscordModCase{}
		if err := rows.Scan(&c.ID, &c.GuildID, &c.CaseNumber, &c.Action, &c.TargetID, &c.TargetName, &c.ModID, &c.ModName, &c.Reason, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// GetDiscordModStats returns a map of action->count for a moderator in a guild.
func GetDiscordModStats(guildID, modID string) (map[string]int, error) {
	out := map[string]int{}
	if db == nil {
		return out, nil
	}
	rows, err := db.Query(`
		SELECT action, COUNT(*) FROM discord_mod_cases WHERE guild_id=$1 AND mod_id=$2 GROUP BY action
	`, guildID, modID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var action string
		var count int
		if err := rows.Scan(&action, &count); err != nil {
			return nil, err
		}
		out[action] = count
	}
	return out, nil
}

// ─── Discord Member Notes ─────────────────────────────────────────────────────

// DiscordMemberNote is a private staff note about a guild member.
type DiscordMemberNote struct {
	ID        int64
	GuildID   string
	TargetID  string
	ModID     string
	ModName   string
	Note      string
	CreatedAt time.Time
}

// AddDiscordMemberNote inserts a note and returns its auto-generated ID.
func AddDiscordMemberNote(guildID, targetID, modID, modName, note string) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	var id int64
	err := db.QueryRow(`
		INSERT INTO discord_member_notes (guild_id, target_id, mod_id, mod_name, note)
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, guildID, targetID, modID, modName, note).Scan(&id)
	return id, err
}

// GetDiscordMemberNotes returns all notes for a user in a guild, oldest first.
func GetDiscordMemberNotes(guildID, targetID string) ([]*DiscordMemberNote, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`
		SELECT id, guild_id, target_id, mod_id, mod_name, note, created_at
		FROM discord_member_notes WHERE guild_id=$1 AND target_id=$2
		ORDER BY created_at ASC
	`, guildID, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*DiscordMemberNote
	for rows.Next() {
		n := &DiscordMemberNote{}
		if err := rows.Scan(&n.ID, &n.GuildID, &n.TargetID, &n.ModID, &n.ModName, &n.Note, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, nil
}

// DeleteDiscordMemberNote removes a note by its ID (scoped to guild for safety).
func DeleteDiscordMemberNote(guildID string, noteID int64) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`DELETE FROM discord_member_notes WHERE guild_id=$1 AND id=$2`, guildID, noteID)
	return err
}

// ClearDiscordMemberNotes deletes all notes for a user and returns the count.
func ClearDiscordMemberNotes(guildID, targetID string) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	res, err := db.Exec(`DELETE FROM discord_member_notes WHERE guild_id=$1 AND target_id=$2`, guildID, targetID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ─── Discord Mod Roles ────────────────────────────────────────────────────────

// DiscordModRole is a role designated as a moderator role in a guild.
type DiscordModRole struct {
	GuildID  string
	RoleID   string
	RoleName string
}

// AddDiscordModRole upserts a mod role for a guild.
func AddDiscordModRole(guildID, roleID, roleName string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_mod_roles (guild_id, role_id, role_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (guild_id, role_id) DO UPDATE SET role_name = EXCLUDED.role_name
	`, guildID, roleID, roleName)
	return err
}

// RemoveDiscordModRole removes a mod role designation.
func RemoveDiscordModRole(guildID, roleID string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`DELETE FROM discord_mod_roles WHERE guild_id=$1 AND role_id=$2`, guildID, roleID)
	return err
}

// GetDiscordModRoles returns all mod roles for a guild.
func GetDiscordModRoles(guildID string) ([]DiscordModRole, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`SELECT guild_id, role_id, role_name FROM discord_mod_roles WHERE guild_id=$1 ORDER BY role_name`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DiscordModRole
	for rows.Next() {
		var r DiscordModRole
		if err := rows.Scan(&r.GuildID, &r.RoleID, &r.RoleName); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

// ─── Discord Joinable Ranks ───────────────────────────────────────────────────

// DiscordJoinableRank is a self-assignable role in a guild.
type DiscordJoinableRank struct {
	GuildID  string
	RoleID   string
	RoleName string
}

// AddDiscordJoinableRank upserts a joinable rank for a guild.
func AddDiscordJoinableRank(guildID, roleID, roleName string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_joinable_ranks (guild_id, role_id, role_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (guild_id, role_id) DO UPDATE SET role_name = EXCLUDED.role_name
	`, guildID, roleID, roleName)
	return err
}

// RemoveDiscordJoinableRankByID removes a joinable rank by role ID.
func RemoveDiscordJoinableRankByID(guildID, roleID string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`DELETE FROM discord_joinable_ranks WHERE guild_id=$1 AND role_id=$2`, guildID, roleID)
	return err
}

// GetDiscordJoinableRanks returns all joinable ranks for a guild.
func GetDiscordJoinableRanks(guildID string) ([]DiscordJoinableRank, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	rows, err := db.Query(`SELECT guild_id, role_id, role_name FROM discord_joinable_ranks WHERE guild_id=$1 ORDER BY role_name`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DiscordJoinableRank
	for rows.Next() {
		var r DiscordJoinableRank
		if err := rows.Scan(&r.GuildID, &r.RoleID, &r.RoleName); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

// GetDiscordJoinableRankByName looks up a joinable rank by its role name (case-insensitive).
func GetDiscordJoinableRankByName(guildID, name string) (*DiscordJoinableRank, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	var r DiscordJoinableRank
	err := db.QueryRow(`
		SELECT guild_id, role_id, role_name FROM discord_joinable_ranks
		WHERE guild_id=$1 AND LOWER(role_name)=LOWER($2)
	`, guildID, name).Scan(&r.GuildID, &r.RoleID, &r.RoleName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

// ─── Discord Role Persist ─────────────────────────────────────────────────────

// ToggleDiscordRolePersist adds role persistence if it doesn't exist, removes if it does.
// Returns true if added, false if removed.
func ToggleDiscordRolePersist(guildID, userID, roleID string) (bool, error) {
	if db == nil {
		return false, fmt.Errorf("db not initialized")
	}
	var exists bool
	err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM discord_role_persist WHERE guild_id=$1 AND user_id=$2 AND role_id=$3)`,
		guildID, userID, roleID).Scan(&exists)
	if err != nil {
		return false, err
	}
	if exists {
		_, err = db.Exec(`DELETE FROM discord_role_persist WHERE guild_id=$1 AND user_id=$2 AND role_id=$3`, guildID, userID, roleID)
		return false, err
	}
	_, err = db.Exec(`INSERT INTO discord_role_persist (guild_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, guildID, userID, roleID)
	return true, err
}

// GetDiscordRolePersist returns all role IDs that should persist for a user in a guild.
func GetDiscordRolePersist(guildID, userID string) ([]string, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT role_id FROM discord_role_persist WHERE guild_id=$1 AND user_id=$2`, guildID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var roleID string
		if err := rows.Scan(&roleID); err != nil {
			return nil, err
		}
		out = append(out, roleID)
	}
	return out, nil
}

// ─── Discord Temp Roles ───────────────────────────────────────────────────────

// DiscordTempRole is a role assigned temporarily to a user.
type DiscordTempRole struct {
	ID        int64
	GuildID   string
	UserID    string
	RoleID    string
	ExpiresAt time.Time
}

// CreateDiscordTempRole inserts a new temp role record.
func CreateDiscordTempRole(guildID, userID, roleID string, expiresAt time.Time) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`INSERT INTO discord_temp_roles (guild_id, user_id, role_id, expires_at) VALUES ($1, $2, $3, $4)`,
		guildID, userID, roleID, expiresAt)
	return err
}

// GetExpiredDiscordTempRoles returns all temp roles that have expired.
func GetExpiredDiscordTempRoles() ([]*DiscordTempRole, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT id, guild_id, user_id, role_id, expires_at FROM discord_temp_roles WHERE expires_at <= NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*DiscordTempRole
	for rows.Next() {
		t := &DiscordTempRole{}
		if err := rows.Scan(&t.ID, &t.GuildID, &t.UserID, &t.RoleID, &t.ExpiresAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

// DeleteDiscordTempRole removes a temp role record by ID.
func DeleteDiscordTempRole(id int64) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_temp_roles WHERE id=$1`, id)
	return err
}

// ─── Discord Reminders ────────────────────────────────────────────────────────

// DiscordReminder is a user-set reminder to be delivered via DM.
type DiscordReminder struct {
	ID        int64
	UserID    string
	ChannelID string
	Reminder  string
	RemindAt  time.Time
}

// CreateDiscordReminder inserts a new reminder.
func CreateDiscordReminder(userID, channelID, reminder string, remindAt time.Time) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`INSERT INTO discord_reminders (user_id, channel_id, reminder, remind_at) VALUES ($1, $2, $3, $4)`,
		userID, channelID, reminder, remindAt)
	return err
}

// GetDueDiscordReminders returns all reminders that are due.
func GetDueDiscordReminders() ([]*DiscordReminder, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT id, user_id, channel_id, reminder, remind_at FROM discord_reminders WHERE remind_at <= NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*DiscordReminder
	for rows.Next() {
		r := &DiscordReminder{}
		if err := rows.Scan(&r.ID, &r.UserID, &r.ChannelID, &r.Reminder, &r.RemindAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

// DeleteDiscordReminder removes a reminder by ID.
func DeleteDiscordReminder(id int64) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_reminders WHERE id=$1`, id)
	return err
}

// ─── Discord AFK ──────────────────────────────────────────────────────────────

// SetDiscordAFK upserts an AFK status for a user in a guild.
func SetDiscordAFK(guildID, userID, status string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_afk (guild_id, user_id, status, set_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (guild_id, user_id) DO UPDATE SET status = EXCLUDED.status, set_at = NOW()
	`, guildID, userID, status)
	return err
}

// GetDiscordAFK returns the AFK status for a user. Returns ("", false, nil) if not AFK.
func GetDiscordAFK(guildID, userID string) (string, bool, error) {
	if db == nil {
		return "", false, nil
	}
	var status string
	err := db.QueryRow(`SELECT status FROM discord_afk WHERE guild_id=$1 AND user_id=$2`, guildID, userID).Scan(&status)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	return status, err == nil, err
}

// ClearDiscordAFK removes the AFK status for a user.
func ClearDiscordAFK(guildID, userID string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_afk WHERE guild_id=$1 AND user_id=$2`, guildID, userID)
	return err
}

// ─── Discord Highlights ───────────────────────────────────────────────────────

// AddDiscordHighlight adds a keyword highlight phrase for a user in a guild.
func AddDiscordHighlight(guildID, userID, phrase string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`INSERT INTO discord_highlights (guild_id, user_id, phrase) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		guildID, userID, strings.ToLower(phrase))
	return err
}

// RemoveDiscordHighlight removes a specific highlight phrase.
func RemoveDiscordHighlight(guildID, userID, phrase string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_highlights WHERE guild_id=$1 AND user_id=$2 AND phrase=$3`,
		guildID, userID, strings.ToLower(phrase))
	return err
}

// GetDiscordHighlightsForUser returns all highlight phrases for a user in a guild.
func GetDiscordHighlightsForUser(guildID, userID string) ([]string, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT phrase FROM discord_highlights WHERE guild_id=$1 AND user_id=$2 ORDER BY phrase`, guildID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// GetDiscordHighlightsInGuild returns a map of userID -> []phrase for all highlights in a guild.
func GetDiscordHighlightsInGuild(guildID string) (map[string][]string, error) {
	out := map[string][]string{}
	if db == nil {
		return out, nil
	}
	rows, err := db.Query(`SELECT user_id, phrase FROM discord_highlights WHERE guild_id=$1`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var userID, phrase string
		if err := rows.Scan(&userID, &phrase); err != nil {
			return nil, err
		}
		out[userID] = append(out[userID], phrase)
	}
	return out, nil
}

// ─── Discord Tags ─────────────────────────────────────────────────────────────

// DiscordTag is a saved text snippet that can be recalled by name.
type DiscordTag struct {
	GuildID   string
	Name      string
	Content   string
	AuthorID  string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// GetDiscordTag returns a single tag by name (case-insensitive) or nil.
func GetDiscordTag(guildID, name string) (*DiscordTag, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	t := &DiscordTag{}
	err := db.QueryRow(`
		SELECT guild_id, name, content, author_id, created_at, updated_at
		FROM discord_tags WHERE guild_id=$1 AND LOWER(name)=LOWER($2)
	`, guildID, name).Scan(&t.GuildID, &t.Name, &t.Content, &t.AuthorID, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return t, err
}

// CreateDiscordTag inserts a new tag. Returns an error if the name already exists.
func CreateDiscordTag(guildID, name, content, authorID string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`INSERT INTO discord_tags (guild_id, name, content, author_id) VALUES ($1, $2, $3, $4)`,
		guildID, strings.ToLower(name), content, authorID)
	return err
}

// UpdateDiscordTag updates the content of an existing tag.
func UpdateDiscordTag(guildID, name, content string) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	res, err := db.Exec(`UPDATE discord_tags SET content=$3, updated_at=NOW() WHERE guild_id=$1 AND LOWER(name)=LOWER($2)`,
		guildID, name, content)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("tag %q not found", name)
	}
	return nil
}

// DeleteDiscordTag removes a tag by name.
func DeleteDiscordTag(guildID, name string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_tags WHERE guild_id=$1 AND LOWER(name)=LOWER($2)`, guildID, name)
	return err
}

// ListDiscordTags returns all tags for a guild, optionally filtered by search string.
func ListDiscordTags(guildID, search string) ([]*DiscordTag, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	var rows *sql.Rows
	var err error
	if search == "" {
		rows, err = db.Query(`SELECT guild_id, name, content, author_id, created_at, updated_at FROM discord_tags WHERE guild_id=$1 ORDER BY name`, guildID)
	} else {
		rows, err = db.Query(`SELECT guild_id, name, content, author_id, created_at, updated_at FROM discord_tags WHERE guild_id=$1 AND LOWER(name) LIKE LOWER($2) ORDER BY name`, guildID, "%"+search+"%")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*DiscordTag
	for rows.Next() {
		t := &DiscordTag{}
		if err := rows.Scan(&t.GuildID, &t.Name, &t.Content, &t.AuthorID, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

// ─── Discord Giveaways ────────────────────────────────────────────────────────

// DiscordGiveaway represents an active or ended giveaway.
type DiscordGiveaway struct {
	ID          int64
	GuildID     string
	ChannelID   string
	MessageID   string
	Prize       string
	WinnerCount int
	HostID      string
	EndsAt      time.Time
	Ended       bool
	CreatedAt   time.Time
}

// CreateDiscordGiveaway inserts a new giveaway and returns its ID.
func CreateDiscordGiveaway(guildID, channelID, prize string, winnerCount int, hostID string, endsAt time.Time) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	var id int64
	err := db.QueryRow(`
		INSERT INTO discord_giveaways (guild_id, channel_id, prize, winner_count, host_id, ends_at)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
	`, guildID, channelID, prize, winnerCount, hostID, endsAt).Scan(&id)
	return id, err
}

// SetDiscordGiveawayMessageID sets the Discord message ID for a giveaway.
func SetDiscordGiveawayMessageID(id int64, msgID string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`UPDATE discord_giveaways SET message_id=$2 WHERE id=$1`, id, msgID)
	return err
}

// GetActiveDiscordGiveaways returns all unended giveaways that have passed their end time.
func GetActiveDiscordGiveaways() ([]*DiscordGiveaway, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`
		SELECT id, guild_id, channel_id, message_id, prize, winner_count, host_id, ends_at, ended, created_at
		FROM discord_giveaways WHERE ended=FALSE AND ends_at <= NOW() AND message_id != ''
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*DiscordGiveaway
	for rows.Next() {
		g := &DiscordGiveaway{}
		if err := rows.Scan(&g.ID, &g.GuildID, &g.ChannelID, &g.MessageID, &g.Prize, &g.WinnerCount, &g.HostID, &g.EndsAt, &g.Ended, &g.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, nil
}

// EndDiscordGiveaway marks a giveaway as ended.
func EndDiscordGiveaway(id int64) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`UPDATE discord_giveaways SET ended=TRUE WHERE id=$1`, id)
	return err
}

// GetDiscordGiveawayByMessage looks up a giveaway by its Discord message ID.
func GetDiscordGiveawayByMessage(messageID string) (*DiscordGiveaway, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	g := &DiscordGiveaway{}
	err := db.QueryRow(`
		SELECT id, guild_id, channel_id, message_id, prize, winner_count, host_id, ends_at, ended, created_at
		FROM discord_giveaways WHERE message_id=$1
	`, messageID).Scan(&g.ID, &g.GuildID, &g.ChannelID, &g.MessageID, &g.Prize, &g.WinnerCount, &g.HostID, &g.EndsAt, &g.Ended, &g.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return g, err
}

// ─── Discord Ignored Channels ─────────────────────────────────────────────────

// ToggleDiscordIgnoredChannel toggles whether a channel is ignored for bot commands.
// Returns true if the channel is now ignored, false if it was unignored.
func ToggleDiscordIgnoredChannel(guildID, channelID string) (bool, error) {
	if db == nil {
		return false, fmt.Errorf("db not initialized")
	}
	var exists bool
	err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM discord_ignored_channels WHERE guild_id=$1 AND channel_id=$2)`,
		guildID, channelID).Scan(&exists)
	if err != nil {
		return false, err
	}
	if exists {
		_, err = db.Exec(`DELETE FROM discord_ignored_channels WHERE guild_id=$1 AND channel_id=$2`, guildID, channelID)
		return false, err
	}
	_, err = db.Exec(`INSERT INTO discord_ignored_channels (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, guildID, channelID)
	return true, err
}

// IsDiscordChannelIgnored returns true if the channel is on the ignore list.
func IsDiscordChannelIgnored(guildID, channelID string) (bool, error) {
	if db == nil {
		return false, nil
	}
	var exists bool
	err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM discord_ignored_channels WHERE guild_id=$1 AND channel_id=$2)`,
		guildID, channelID).Scan(&exists)
	return exists, err
}

// GetDiscordIgnoredChannels returns all ignored channel IDs for a guild.
func GetDiscordIgnoredChannels(guildID string) ([]string, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT channel_id FROM discord_ignored_channels WHERE guild_id=$1`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

// ─── Discord Lockdown Channels ────────────────────────────────────────────────

// AddDiscordLockdownChannel records a channel as having been locked during lockdown.
func AddDiscordLockdownChannel(guildID, channelID string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`INSERT INTO discord_lockdown_channels (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, guildID, channelID)
	return err
}

// GetDiscordLockdownChannels returns all channels currently locked by /lockdown.
func GetDiscordLockdownChannels(guildID string) ([]string, error) {
	if db == nil {
		return nil, nil
	}
	rows, err := db.Query(`SELECT channel_id FROM discord_lockdown_channels WHERE guild_id=$1`, guildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

// ClearDiscordLockdownChannels removes all lockdown records for a guild.
func ClearDiscordLockdownChannels(guildID string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`DELETE FROM discord_lockdown_channels WHERE guild_id=$1`, guildID)
	return err
}

// DeleteDiscordWarningByID removes a single warning by its database ID (scoped to guild).
func DeleteDiscordWarningByID(guildID string, id int64) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`DELETE FROM discord_warnings WHERE guild_id=$1 AND id=$2`, guildID, id)
	return err
}

// ── Spam Filters ──────────────────────────────────────────────────────────────

// SpamFilter represents an auto-moderation spam filter rule for a channel.
type SpamFilter struct {
	ID               int64
	BroadcasterLogin string
	Type             string // "caps", "link", "length", "emotes"
	Action           string // "timeout", "delete", "ban"
	TimeoutSeconds   int
	CreatedAt        time.Time
}

// EnsureSpamFiltersTable creates the spam_filters table if it does not exist.
func EnsureSpamFiltersTable() error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS spam_filters (
		id                BIGSERIAL PRIMARY KEY,
		broadcaster_login TEXT        NOT NULL,
		type              TEXT        NOT NULL,
		action            TEXT        NOT NULL DEFAULT 'delete',
		timeout_seconds   INT         NOT NULL DEFAULT 60,
		created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
		UNIQUE (broadcaster_login, type)
	);`)
	return err
}

// AddSpamFilter inserts or replaces a spam filter for a broadcaster.
func AddSpamFilter(broadcasterLogin, filterType, action string, timeoutSeconds int) (int64, error) {
	if db == nil {
		return 0, fmt.Errorf("db not initialized")
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	filterType = strings.ToLower(strings.TrimSpace(filterType))
	action = strings.ToLower(strings.TrimSpace(action))
	if timeoutSeconds <= 0 {
		timeoutSeconds = 60
	}
	var id int64
	row := db.QueryRow(`
	INSERT INTO spam_filters (broadcaster_login, type, action, timeout_seconds)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (broadcaster_login, type) DO UPDATE
	SET action = EXCLUDED.action, timeout_seconds = EXCLUDED.timeout_seconds
	RETURNING id;
	`, broadcasterLogin, filterType, action, timeoutSeconds)
	if err := row.Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

// ListSpamFilters returns all spam filters for a broadcaster ordered by type.
func ListSpamFilters(broadcasterLogin string) ([]SpamFilter, error) {
	res := []SpamFilter{}
	if db == nil {
		return res, nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	rows, err := db.Query(`
	SELECT id, broadcaster_login, type, action, timeout_seconds, created_at
	FROM spam_filters
	WHERE broadcaster_login = $1
	ORDER BY type;
	`, broadcasterLogin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var f SpamFilter
		if err := rows.Scan(&f.ID, &f.BroadcasterLogin, &f.Type, &f.Action, &f.TimeoutSeconds, &f.CreatedAt); err != nil {
			return nil, err
		}
		res = append(res, f)
	}
	return res, nil
}

// DeleteSpamFilter removes a spam filter by ID for a broadcaster.
func DeleteSpamFilter(broadcasterLogin string, id int64) error {
	if db == nil {
		return nil
	}
	broadcasterLogin = strings.ToLower(strings.TrimSpace(broadcasterLogin))
	_, err := db.Exec(`DELETE FROM spam_filters WHERE broadcaster_login=$1 AND id=$2`, broadcasterLogin, id)
	return err
}

// ─── Discord Ticket System ────────────────────────────────────────────────────

// DiscordTicketConfig stores per-guild ticket panel settings.
type DiscordTicketConfig struct {
	GuildID        string
	PanelChannelID string   // channel where the ticket open button is posted
	LogChannelID   string   // optional channel to log ticket open/close
	CategoryID     string   // optional category to create ticket channels under
	SupportRoleIDs []string // roles that can see and respond to tickets
	PanelMessageID string   // ID of the bot's panel message (for re-use)
	PanelTitle     string
	PanelBody      string
	ButtonLabel    string
}

// EnsureTicketTables creates tables if they don't exist.
func EnsureTicketTables() error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS discord_ticket_config (
		guild_id          TEXT PRIMARY KEY,
		panel_channel_id  TEXT NOT NULL DEFAULT '',
		log_channel_id    TEXT NOT NULL DEFAULT '',
		category_id       TEXT NOT NULL DEFAULT '',
		support_role_ids  TEXT NOT NULL DEFAULT '',
		panel_message_id  TEXT NOT NULL DEFAULT '',
		panel_title       TEXT NOT NULL DEFAULT 'Support Tickets',
		panel_body        TEXT NOT NULL DEFAULT 'Click the button below to open a support ticket.',
		button_label      TEXT NOT NULL DEFAULT '🎫 Open Ticket'
	);
	CREATE TABLE IF NOT EXISTS discord_tickets (
		id             BIGSERIAL PRIMARY KEY,
		guild_id       TEXT        NOT NULL,
		channel_id     TEXT        NOT NULL,
		user_id        TEXT        NOT NULL,
		username       TEXT        NOT NULL,
		ticket_number  INT         NOT NULL,
		status         TEXT        NOT NULL DEFAULT 'open',
		opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
		closed_at      TIMESTAMPTZ,
		closed_by_id   TEXT        NOT NULL DEFAULT '',
		closed_by_name TEXT        NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS discord_tickets_guild_idx ON discord_tickets(guild_id);
	CREATE INDEX IF NOT EXISTS discord_tickets_channel_idx ON discord_tickets(channel_id);
	`)
	return err
}

// GetTicketConfig returns the ticket config for a guild, or a zeroed struct if none.
func GetTicketConfig(guildID string) (*DiscordTicketConfig, error) {
	if db == nil {
		return &DiscordTicketConfig{GuildID: guildID}, nil
	}
	var c DiscordTicketConfig
	var rolesCSV string
	err := db.QueryRow(`
		SELECT guild_id, panel_channel_id, log_channel_id, category_id,
		       support_role_ids, panel_message_id, panel_title, panel_body, button_label
		FROM discord_ticket_config WHERE guild_id=$1
	`, guildID).Scan(&c.GuildID, &c.PanelChannelID, &c.LogChannelID, &c.CategoryID,
		&rolesCSV, &c.PanelMessageID, &c.PanelTitle, &c.PanelBody, &c.ButtonLabel)
	if err == sql.ErrNoRows {
		return &DiscordTicketConfig{GuildID: guildID, PanelTitle: "Support Tickets",
			PanelBody: "Click the button below to open a support ticket.", ButtonLabel: "🎫 Open Ticket"}, nil
	}
	if err != nil {
		return nil, err
	}
	if rolesCSV != "" {
		c.SupportRoleIDs = strings.Split(rolesCSV, ",")
	}
	return &c, nil
}

// SaveTicketConfig upserts the ticket configuration for a guild.
func SaveTicketConfig(c *DiscordTicketConfig) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	rolesCSV := strings.Join(c.SupportRoleIDs, ",")
	_, err := db.Exec(`
		INSERT INTO discord_ticket_config
		  (guild_id, panel_channel_id, log_channel_id, category_id, support_role_ids,
		   panel_message_id, panel_title, panel_body, button_label)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (guild_id) DO UPDATE SET
		  panel_channel_id = EXCLUDED.panel_channel_id,
		  log_channel_id   = EXCLUDED.log_channel_id,
		  category_id      = EXCLUDED.category_id,
		  support_role_ids = EXCLUDED.support_role_ids,
		  panel_message_id = EXCLUDED.panel_message_id,
		  panel_title      = EXCLUDED.panel_title,
		  panel_body       = EXCLUDED.panel_body,
		  button_label     = EXCLUDED.button_label
	`, c.GuildID, c.PanelChannelID, c.LogChannelID, c.CategoryID, rolesCSV,
		c.PanelMessageID, c.PanelTitle, c.PanelBody, c.ButtonLabel)
	return err
}

// UpdateTicketPanelMessageID persists only the panel message ID after posting the panel.
func UpdateTicketPanelMessageID(guildID, messageID string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`UPDATE discord_ticket_config SET panel_message_id=$1 WHERE guild_id=$2`, messageID, guildID)
	return err
}

// NextTicketNumber returns the next sequential ticket number for a guild.
func NextTicketNumber(guildID string) (int, error) {
	if db == nil {
		return 1, nil
	}
	var n int
	err := db.QueryRow(`SELECT COALESCE(MAX(ticket_number), 0)+1 FROM discord_tickets WHERE guild_id=$1`, guildID).Scan(&n)
	return n, err
}

// CreateTicketRecord inserts a new ticket row.
func CreateTicketRecord(guildID, channelID, userID, username string, ticketNum int) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
		INSERT INTO discord_tickets (guild_id, channel_id, user_id, username, ticket_number)
		VALUES ($1,$2,$3,$4,$5)
	`, guildID, channelID, userID, username, ticketNum)
	return err
}

// GetTicketByChannel returns the ticket record for a Discord channel, or nil if none.
func GetTicketByChannel(channelID string) (*struct {
	ID           int64
	GuildID      string
	UserID       string
	Username     string
	TicketNumber int
	Status       string
}, error) {
	if db == nil {
		return nil, nil
	}
	row := &struct {
		ID           int64
		GuildID      string
		UserID       string
		Username     string
		TicketNumber int
		Status       string
	}{}
	err := db.QueryRow(`
		SELECT id, guild_id, user_id, username, ticket_number, status
		FROM discord_tickets WHERE channel_id=$1
	`, channelID).Scan(&row.ID, &row.GuildID, &row.UserID, &row.Username, &row.TicketNumber, &row.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return row, err
}

// CloseTicketRecord marks a ticket as closed.
func CloseTicketRecord(channelID, closedByID, closedByName string) error {
	if db == nil {
		return nil
	}
	_, err := db.Exec(`
		UPDATE discord_tickets SET status='closed', closed_at=now(), closed_by_id=$1, closed_by_name=$2
		WHERE channel_id=$3
	`, closedByID, closedByName, channelID)
	return err
}

// HasOpenTicket returns true if the user already has an open ticket in the guild.
func HasOpenTicket(guildID, userID string) (bool, error) {
	if db == nil {
		return false, nil
	}
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM discord_tickets WHERE guild_id=$1 AND user_id=$2 AND status='open'`, guildID, userID).Scan(&count)
	return count > 0, err
}

// ─── Discord Welcome Settings ─────────────────────────────────────────────────

type DiscordWelcomeSettings struct {
	GuildID          string
	WelcomeChannelID string
	WelcomeMessage   string
	// Comma-separated Discord role IDs to auto-assign on join.
	AutoRoleIDs    string
	LeaveChannelID string
}

// GetDiscordWelcomeSettings returns the welcome settings for a guild.
func GetDiscordWelcomeSettings(guildID string) (*DiscordWelcomeSettings, error) {
	if db == nil {
		return nil, fmt.Errorf("db not initialized")
	}
	row := db.QueryRow(`
		SELECT guild_id, welcome_channel_id, welcome_message, auto_role_ids, leave_channel_id
		FROM discord_welcome_settings
		WHERE guild_id = $1
	`, guildID)
	s := &DiscordWelcomeSettings{}
	if err := row.Scan(&s.GuildID, &s.WelcomeChannelID, &s.WelcomeMessage, &s.AutoRoleIDs, &s.LeaveChannelID); err != nil {
		return nil, err
	}
	return s, nil
}

// SaveDiscordWelcomeSettings upserts welcome settings for a guild.
func SaveDiscordWelcomeSettings(s DiscordWelcomeSettings) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	_, err := db.Exec(`
		INSERT INTO discord_welcome_settings (guild_id, welcome_channel_id, welcome_message, auto_role_ids, leave_channel_id, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (guild_id) DO UPDATE SET
			welcome_channel_id = EXCLUDED.welcome_channel_id,
			welcome_message    = EXCLUDED.welcome_message,
			auto_role_ids      = EXCLUDED.auto_role_ids,
			leave_channel_id   = EXCLUDED.leave_channel_id,
			updated_at         = NOW()
	`, s.GuildID, s.WelcomeChannelID, s.WelcomeMessage, s.AutoRoleIDs, s.LeaveChannelID)
	return err
}
