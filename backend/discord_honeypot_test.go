package main

import (
	"testing"

	"github.com/bwmarrin/discordgo"
)

func TestShouldTriggerHoneypotMessage(t *testing.T) {
	message := &discordgo.MessageCreate{Message: &discordgo.Message{
		GuildID:   "guild-1",
		ChannelID: "honeypot-channel",
		Author:    &discordgo.User{ID: "spam-bot", Bot: true},
	}}
	if !shouldTriggerHoneypotMessage(message, "axyra-bot", "honeypot-channel") {
		t.Fatal("other bot accounts should trigger the honeypot")
	}
	if shouldTriggerHoneypotMessage(message, "spam-bot", "honeypot-channel") {
		t.Fatal("the bot's own messages must not trigger the honeypot")
	}
	if shouldTriggerHoneypotMessage(message, "axyra-bot", "another-channel") {
		t.Fatal("messages outside the configured honeypot channel must not trigger it")
	}

	webhookMessage := *message
	webhookMessage.Message = &discordgo.Message{
		GuildID:   "guild-1",
		ChannelID: "honeypot-channel",
		WebhookID: "webhook-1",
		Author:    &discordgo.User{ID: "webhook-user", Bot: true},
	}
	if shouldTriggerHoneypotMessage(&webhookMessage, "axyra-bot", "honeypot-channel") {
		t.Fatal("webhook posts must not trigger the honeypot")
	}

	directMessage := *message
	directMessage.Message = &discordgo.Message{
		ChannelID: "honeypot-channel",
		Author:    &discordgo.User{ID: "user-1"},
	}
	if shouldTriggerHoneypotMessage(&directMessage, "axyra-bot", "honeypot-channel") {
		t.Fatal("direct messages must not trigger the honeypot")
	}
}

func TestIsHoneypotHistoryChannelType(t *testing.T) {
	messageChannelTypes := []discordgo.ChannelType{
		discordgo.ChannelTypeGuildText,
		discordgo.ChannelTypeGuildNews,
		discordgo.ChannelTypeGuildVoice,
		discordgo.ChannelTypeGuildStageVoice,
		discordgo.ChannelTypeGuildNewsThread,
		discordgo.ChannelTypeGuildPublicThread,
		discordgo.ChannelTypeGuildPrivateThread,
		discordgo.ChannelTypeGuildForum,
		discordgo.ChannelTypeGuildMedia,
	}
	for _, channelType := range messageChannelTypes {
		if !isHoneypotHistoryChannelType(channelType) {
			t.Errorf("channel type %d should be scanned for messages", channelType)
		}
	}
	if isHoneypotHistoryChannelType(discordgo.ChannelTypeGuildCategory) {
		t.Fatal("category channels do not contain message history")
	}
}
