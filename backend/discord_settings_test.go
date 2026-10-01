package main

import "testing"

func TestMergeDiscordSettingsForBroadcasterPrefersSpecificRows(t *testing.T) {
	rows := []DiscordSettings{
		{BroadcasterLogin: "", GuildID: "guild-1", BdayChannelID: "shared-bday"},
		{BroadcasterLogin: "alice", GuildID: "guild-1", BdayChannelID: "owner-bday"},
		{BroadcasterLogin: "alice", GuildID: "guild-2", BdayChannelID: "owner-only-bday"},
		{BroadcasterLogin: "", GuildID: "guild-3", BdayChannelID: "shared-third"},
	}

	got := mergeDiscordSettingsForBroadcaster("alice", rows)
	if len(got) != 3 {
		t.Fatalf("expected 3 merged guild settings, got %d", len(got))
	}
	byGuild := map[string]string{}
	for _, s := range got {
		byGuild[s.GuildID] = s.BdayChannelID
	}
	if byGuild["guild-1"] != "owner-bday" {
		t.Fatalf("expected specific guild row to win for guild-1, got %q", byGuild["guild-1"])
	}
	if byGuild["guild-2"] != "owner-only-bday" {
		t.Fatalf("expected owner-specific row for guild-2, got %q", byGuild["guild-2"])
	}
	if byGuild["guild-3"] != "shared-third" {
		t.Fatalf("expected guild-wide row for guild-3, got %q", byGuild["guild-3"])
	}
}

func TestMergeGuildScopedDiscordSettingsUsesSavedGuildValues(t *testing.T) {
	loginSettings := &DiscordSettings{
		BroadcasterLogin:  "admin-login",
		GuildID:           "guild-1",
		ModLogChannelID:   "stale-log-channel",
		ModLogEvents:      []string{"stale-event"},
		HoneypotChannelID: "stale-honeypot",
		LiveChannelID:     "login-live-channel",
	}
	guildSettings := &DiscordSettings{
		BroadcasterLogin:  "",
		GuildID:           "guild-1",
		ModLogChannelID:   "saved-log-channel",
		ModLogEvents:      []string{"member_timeout", "member_ban"},
		HoneypotChannelID: "saved-honeypot",
	}

	got := mergeGuildScopedDiscordSettings(loginSettings, guildSettings)
	if got.ModLogChannelID != "saved-log-channel" {
		t.Fatalf("mod log channel = %q, want guild value", got.ModLogChannelID)
	}
	if len(got.ModLogEvents) != 2 || got.ModLogEvents[0] != "member_timeout" {
		t.Fatalf("mod log events = %v, want guild values", got.ModLogEvents)
	}
	if got.HoneypotChannelID != "saved-honeypot" {
		t.Fatalf("honeypot channel = %q, want guild value", got.HoneypotChannelID)
	}
	if got.LiveChannelID != "login-live-channel" {
		t.Fatalf("unrelated login-specific setting was overwritten: %q", got.LiveChannelID)
	}
}
