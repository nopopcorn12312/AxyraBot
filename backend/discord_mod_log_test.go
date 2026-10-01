package main

import (
	"testing"

	"github.com/bwmarrin/discordgo"
)

func TestDiscordModLogEventEnabledRequiresChannelAndSelectedSupportedEvent(t *testing.T) {
	settings := &DiscordSettings{
		ModLogChannelID: "log-channel",
		ModLogEvents:    []string{discordModLogMemberTimeout, discordModLogMemberRoleAdd},
	}

	if !discordModLogEventEnabled(settings, discordModLogMemberTimeout) {
		t.Fatal("selected mod-log event should be enabled")
	}
	if discordModLogEventEnabled(settings, discordModLogMemberBan) {
		t.Fatal("unselected mod-log event should be disabled")
	}
	if discordModLogEventEnabled(settings, "unknown_event") {
		t.Fatal("unknown mod-log event should be disabled")
	}
	settings.ModLogChannelID = ""
	if discordModLogEventEnabled(settings, discordModLogMemberTimeout) {
		t.Fatal("mod-log event should be disabled when no destination is selected")
	}
}

func TestDiscordAuditLogRecordsClassifiesMemberRoleChanges(t *testing.T) {
	addKey := discordgo.AuditLogChangeKey("$add")
	removeKey := discordgo.AuditLogChangeKey("$remove")
	action := discordgo.AuditLogActionMemberRoleUpdate
	entry := &discordgo.AuditLogEntry{
		TargetID:   "member-id",
		UserID:     "moderator-id",
		ActionType: &action,
		Changes: []*discordgo.AuditLogChange{
			{Key: &addKey, NewValue: []interface{}{map[string]interface{}{"id": "role-add"}}},
			{Key: &removeKey, OldValue: []interface{}{map[string]interface{}{"id": "role-remove"}}},
		},
	}

	records := discordAuditLogRecords(entry)
	if len(records) != 2 {
		t.Fatalf("got %d records, want add and remove events", len(records))
	}
	if records[0].Event != discordModLogMemberRoleAdd || records[1].Event != discordModLogMemberRoleRemove {
		t.Fatalf("got event keys %q and %q, want role add and role remove", records[0].Event, records[1].Event)
	}
	if records[0].ActorID != "moderator-id" || records[0].Description == "" {
		t.Fatalf("record missing moderator or role details: %+v", records[0])
	}
}

func TestDiscordAuditLogRecordsClassifiesTimeoutAndBan(t *testing.T) {
	banAction := discordgo.AuditLogActionMemberBanAdd
	ban := discordAuditLogRecords(&discordgo.AuditLogEntry{
		TargetID: "banned-user", UserID: "moderator", ActionType: &banAction,
	})
	if len(ban) != 1 || ban[0].Event != discordModLogMemberBan {
		t.Fatalf("ban audit record = %+v", ban)
	}

	timeoutAction := discordgo.AuditLogActionMemberUpdate
	timeoutKey := discordgo.AuditLogChangeKey("communication_disabled_until")
	timeout := discordAuditLogRecords(&discordgo.AuditLogEntry{
		TargetID: "timed-out-user", UserID: "moderator", ActionType: &timeoutAction,
		Changes: []*discordgo.AuditLogChange{{Key: &timeoutKey, NewValue: "2026-10-02T00:00:00Z"}},
	})
	if len(timeout) != 1 || timeout[0].Event != discordModLogMemberTimeout {
		t.Fatalf("timeout audit record = %+v", timeout)
	}
}
