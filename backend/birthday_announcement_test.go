package main

import "testing"

func TestShouldPostDiscordBirthdayDoesNotSendAlternateSourceFromChannelWatcher(t *testing.T) {
	settings := DiscordSettings{
		BdayChannelID:   "discord-channel",
		BdaySourceLogin: "owner::family-list",
	}

	if shouldPostDiscordBirthday(settings, "admin-channel", "own birthday") {
		t.Fatal("alternate sources should be sent only by their dedicated scheduler")
	}
	if !shouldPostDiscordBirthdaySource(settings, "owner::family-list", "family birthday") {
		t.Fatal("expected the configured birthday source to be sent by its dedicated scheduler")
	}
	if shouldPostDiscordBirthdaySource(settings, "another-list", "family birthday") {
		t.Fatal("did not expect a different source to use this guild's destination")
	}
}

func TestShouldPostDiscordBirthdaySkipsEmptyDefaultList(t *testing.T) {
	settings := DiscordSettings{BdayChannelID: "discord-channel"}
	if shouldPostDiscordBirthday(settings, "channel", " ") {
		t.Fatal("did not expect a Discord announcement with no birthdays and no alternate source")
	}
}

func TestShouldPostDiscordBirthdaySkipsMissingDestination(t *testing.T) {
	settings := DiscordSettings{BdaySourceLogin: "owner::family-list"}
	if shouldPostDiscordBirthday(settings, "channel", "") {
		t.Fatal("did not expect an announcement without a configured Discord channel")
	}
}