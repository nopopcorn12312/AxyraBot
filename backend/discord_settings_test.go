package main
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
