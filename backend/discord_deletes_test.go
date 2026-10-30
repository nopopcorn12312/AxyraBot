package main

import (
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/bwmarrin/discordgo"
)

func TestTwitchDeleteAlertShowsSenderMessageDeleterAndReason(t *testing.T) {
	tmpl, vars := discordModAlertTemplate("nopopcorn", "AxyraBot", "spammer99", "delete", "Blocked term: badword", "buy *cheap* followers")
	got := fillDiscordTemplate(tmpl, vars)
	want := "🗑️ **[nopopcorn]** `spammer99` was moderated (message deleted) by `AxyraBot`\n" +
		`Message: buy \*cheap\* followers` + "\n" + // shown as typed, not as Discord formatting
		"Reason: Blocked term: badword"
	if got != want {
		t.Fatalf("alert =\n%s\nwant\n%s", got, want)
	}
}

func TestTwitchBanAlertDropsEmptyLines(t *testing.T) {
	tmpl, vars := discordModAlertTemplate("c", "AxyraBot", "x", "ban", "", "")
	if got := fillDiscordTemplate(tmpl, vars); got != "🔨 **[c]** `x` was banned by `AxyraBot`" {
		t.Fatalf("ban alert = %q", got)
	}
	tmpl, vars = discordModAlertTemplate("c", "AxyraBot", "x", "timeout", "Spam filter: excessive caps", "")
	if got := fillDiscordTemplate(tmpl, vars); got != "⏱️ **[c]** `x` was timed out by `AxyraBot`\nReason: Spam filter: excessive caps" {
		t.Fatalf("timeout alert = %q", got)
	}
}

func TestTwitchAlertVerbReadsCorrectlyInCustomTemplates(t *testing.T) {
	// Broadcasters' custom templates are often written as "$(target) was $(verb)".
	for action, want := range map[string]string{
		"ban":     "x was banned",
		"timeout": "x was timed out",
		"delete":  "x was moderated (message deleted)",
	} {
		_, vars := discordModAlertTemplate("c", "m", "x", action, "", "")
		if got := fillDiscordTemplate("$(target) was $(verb)", vars); got != want {
			t.Fatalf("%s: got %q, want %q", action, got, want)
		}
	}
}

func TestOldCustomTemplatesStillShowDeletedMessage(t *testing.T) {
	old := "`$(target)` was $(verb)"
	_, vars := discordModAlertTemplate("c", "AxyraBot", "x", "delete", "", "spam link")
	if got := fillDiscordTemplate(withDeletedMessageLine(old, "delete"), vars); got != "`x` was moderated (message deleted)\nMessage: spam link" {
		t.Fatalf("got %q", got)
	}
	if withDeletedMessageLine(old, "ban") != old {
		t.Fatal("bans should keep the template unchanged")
	}
}

func TestDeletePairsModeratorAuditEntryWithMessageText(t *testing.T) {
	tr := newDiscordDeleteTracker()
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	tr.remember("m1", discordCachedMessage{GuildID: "g", ChannelID: "general", AuthorID: "alice", Content: "first", At: now})
	tr.remember("m2", discordCachedMessage{GuildID: "g", ChannelID: "general", AuthorID: "bob", Content: "hello", At: now})
	tr.remember("m3", discordCachedMessage{GuildID: "g", ChannelID: "general", AuthorID: "alice", Content: "second", At: now})
	tr.edit("m3", "second (edited)")

	for _, id := range []string{"m1", "m3"} {
		if _, known, bot := tr.deletedNow(id, nil, now); !known || bot != nil {
			t.Fatalf("delete of %s: known=%v bot=%v", id, known, bot)
		}
	}
	// The audit entry names the author and channel, not the message; the most
	// recent unmatched deletion from that author wins.
	msg, ok := tr.matchAudit("general", "alice", now.Add(time.Second))
	if !ok || msg.Content != "second (edited)" {
		t.Fatalf("first match = %+v, %v", msg, ok)
	}
	msg, ok = tr.matchAudit("general", "alice", now.Add(time.Second))
	if !ok || msg.Content != "first" {
		t.Fatalf("second match = %+v, %v", msg, ok)
	}
	if _, ok := tr.matchAudit("general", "alice", now.Add(time.Second)); ok {
		t.Fatal("a deletion should only be matched once")
	}
	if _, ok := tr.matchAudit("general", "bob", now.Add(time.Second)); ok {
		t.Fatal("bob's message wasn't deleted")
	}
}

func TestDeleteMatchingIgnoresOldDeletions(t *testing.T) {
	tr := newDiscordDeleteTracker()
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	tr.remember("m1", discordCachedMessage{GuildID: "g", ChannelID: "c", AuthorID: "a", Content: "hi", At: now})
	tr.deletedNow("m1", nil, now)
	if _, ok := tr.matchAudit("c", "a", now.Add(discordDeleteMatchWindow+time.Second)); ok {
		t.Fatal("deletions outside the match window should not pair with a new audit entry")
	}
}

func TestBotDeletionCarriesReason(t *testing.T) {
	tr := newDiscordDeleteTracker()
	now := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	tr.remember("m1", discordCachedMessage{GuildID: "g", ChannelID: "c", AuthorID: "a", Content: "spam", At: now})
	tr.noteBotDeletion("m1", "Blocked term: spam", false, now)
	msg, known, bot := tr.deletedNow("m1", nil, now)
	if !known || msg.Content != "spam" || bot == nil || bot.reason != "Blocked term: spam" {
		t.Fatalf("got msg=%+v known=%v bot=%+v", msg, known, bot)
	}
	// Bot deletions are logged directly, so they must not also pair with an audit entry.
	if _, ok := tr.matchAudit("c", "a", now); ok {
		t.Fatal("bot deletion leaked into audit matching")
	}
}

func TestMessageCacheDropsOldAndExcessMessages(t *testing.T) {
	tr := newDiscordDeleteTracker()
	start := time.Date(2026, 10, 29, 0, 0, 0, 0, time.UTC)
	tr.remember("old", discordCachedMessage{GuildID: "g", At: start})
	tr.remember("new", discordCachedMessage{GuildID: "g", At: start.Add(discordMessageCacheTTL + time.Minute)})
	if _, ok := tr.messages["old"]; ok {
		t.Fatal("messages older than the cache TTL should be dropped")
	}
	for i := 0; i < discordMessageCacheMax+5; i++ {
		tr.remember("m"+strconv.Itoa(i), discordCachedMessage{GuildID: "g", At: start.Add(discordMessageCacheTTL + time.Hour)})
	}
	if len(tr.messages) > discordMessageCacheMax || len(tr.order) != len(tr.messages) {
		t.Fatalf("cache size %d (order %d), max %d", len(tr.messages), len(tr.order), discordMessageCacheMax)
	}
}

func TestDiscordMessageDeleteRecord(t *testing.T) {
	rec := discordMessageDeleteRecord(&discordCachedMessage{Content: "> not a quote **bold**", Attachments: 1}, "chan", "author", "mod", "rude")
	if rec.Event != discordModLogMessageDelete || rec.ActorID != "mod" || rec.ActorLabel != "Deleted by" || rec.Reason != "rude" {
		t.Fatalf("record fields = %+v", rec)
	}
	for _, want := range []string{"**Sent by** <@author> in <#chan>", `\> not a quote \*\*bold\*\*`, "1 attachment"} {
		if !strings.Contains(rec.Description, want) {
			t.Fatalf("description missing %q:\n%s", want, rec.Description)
		}
	}
	unknown := discordMessageDeleteRecord(nil, "chan", "author", "mod", "")
	if !strings.Contains(unknown.Description, "isn't available") {
		t.Fatalf("missing-text record = %q", unknown.Description)
	}
}

func TestAuditMessageDeleteRecordNamesDeleter(t *testing.T) {
	action := discordgo.AuditLogActionMessageDelete
	records := discordAuditLogRecords(&discordgo.AuditLogEntry{
		TargetID: "author", UserID: "mod", ActionType: &action, Reason: "off topic",
		Options: &discordgo.AuditLogOptions{ChannelID: "chan"},
	})
	if len(records) != 1 || records[0].ActorLabel != "Deleted by" || records[0].ActorID != "mod" || records[0].Reason != "off topic" {
		t.Fatalf("records = %+v", records)
	}
}

func TestTemplateDoesNotExpandVariablesTypedInChat(t *testing.T) {
	_, vars := discordModAlertTemplate("realchannel", "AxyraBot", "troll", "delete", "", "hi $(channel) $(reason)")
	got := fillDiscordTemplate("Message: $(message)", vars)
	if got != "Message: hi $(channel) $(reason)" {
		t.Fatalf("chat text was expanded: %q", got)
	}
}
