package main

import (
	"reflect"
	"testing"
)

func TestBuildTicketOpenedMessageMentionsOpenerAndSelectedRolesOnly(t *testing.T) {
	content, allowed := buildTicketOpenedMessage("user-1", 12, []string{"role-1", "", " role-2 ", "role-1"})

	wantContent := "<@user-1> opened ticket #0012. Support team: <@&role-1> <@&role-2>"
	if content != wantContent {
		t.Fatalf("message content = %q, want %q", content, wantContent)
	}
	if !reflect.DeepEqual(allowed.Users, []string{"user-1"}) {
		t.Fatalf("allowed users = %v, want only the ticket opener", allowed.Users)
	}
	if !reflect.DeepEqual(allowed.Roles, []string{"role-1", "role-2"}) {
		t.Fatalf("allowed roles = %v, want the unique selected roles", allowed.Roles)
	}
	if len(allowed.Parse) != 0 {
		t.Fatalf("unexpected broad mention parsing enabled: %v", allowed.Parse)
	}
}

func TestBuildTicketOpenedMessageWithoutSupportRoles(t *testing.T) {
	content, allowed := buildTicketOpenedMessage("user-2", 3, nil)

	if want := "<@user-2> opened ticket #0003."; content != want {
		t.Fatalf("message content = %q, want %q", content, want)
	}
	if !reflect.DeepEqual(allowed.Users, []string{"user-2"}) {
		t.Fatalf("allowed users = %v, want only the ticket opener", allowed.Users)
	}
	if len(allowed.Roles) != 0 || len(allowed.Parse) != 0 {
		t.Fatalf("unexpected allowed mentions: %+v", allowed)
	}
}

func TestPlanTicketCloseKeepsChannelAndRemovesOpener(t *testing.T) {
	plan := planTicketClose(&DiscordTicketConfig{ClosedAction: ticketClosedKeep, ClosedCategoryID: "archive-cat"}, "opener", 7)
	if plan.Delete || plan.RemoveUserID != "opener" || plan.NewName != "closed-0007" || plan.MoveTo != "archive-cat" {
		t.Fatalf("plan = %+v", plan)
	}
	// No category chosen: the channel stays where it is.
	if plan := planTicketClose(&DiscordTicketConfig{ClosedAction: ticketClosedKeep}, "opener", 7); plan.Delete || plan.MoveTo != "" || plan.RemoveUserID != "opener" {
		t.Fatalf("plan without category = %+v", plan)
	}
	// Servers with no ticket config at all also keep the channel.
	if plan := planTicketClose(nil, "opener", 7); plan.Delete {
		t.Fatal("tickets should be kept by default")
	}
}

func TestPlanTicketCloseCanStillDelete(t *testing.T) {
	if plan := planTicketClose(&DiscordTicketConfig{ClosedAction: ticketClosedDelete, ClosedCategoryID: "archive-cat"}, "opener", 7); !plan.Delete {
		t.Fatalf("plan = %+v, want delete", plan)
	}
}

func TestBuildTicketClosedLogLinksToKeptChannel(t *testing.T) {
	embed := buildTicketClosedLog(12, "opener", "closer", "ticket-chan", "archive-cat", false)
	if embed.Title != "🔒 Ticket #0012 closed" || len(embed.Fields) != 3 {
		t.Fatalf("embed = %+v", embed)
	}
	if embed.Fields[0].Value != "<@opener>" || embed.Fields[1].Value != "<@closer>" {
		t.Fatalf("people fields = %q, %q", embed.Fields[0].Value, embed.Fields[1].Value)
	}
	if embed.Fields[2].Value != "<#ticket-chan> (moved to <#archive-cat>)" {
		t.Fatalf("ticket field = %q", embed.Fields[2].Value)
	}
	if got := buildTicketClosedLog(12, "o", "c", "chan", "", true).Fields[2].Value; got != "Channel deleted" {
		t.Fatalf("deleted ticket field = %q", got)
	}
}
