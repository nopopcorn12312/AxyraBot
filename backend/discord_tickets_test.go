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
