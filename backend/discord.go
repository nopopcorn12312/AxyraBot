package main

import (
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/bwmarrin/discordgo"
)

var discordSession *discordgo.Session

// InitDiscord starts the Discord bot. It reads DISCORD_BOT_TOKEN from the
// environment. If the token is absent the function returns silently and all
// Discord helpers become no-ops.
func InitDiscord() {
	token := os.Getenv("DISCORD_BOT_TOKEN")
	if token == "" {
		log.Println("[Discord] DISCORD_BOT_TOKEN not set; Discord integration disabled")
		return
	}

	var err error
	discordSession, err = discordgo.New("Bot " + token)
	if err != nil {
		log.Println("[Discord] failed to create session:", err)
		return
	}

	discordSession.Identify.Intents = discordgo.IntentsGuilds | discordgo.IntentsGuildMessages

	discordSession.AddHandler(func(s *discordgo.Session, r *discordgo.Ready) {
		log.Printf("[Discord] logged in as %s\n", r.User.Username)
		registerSlashCommands(s, r.User.ID)
	})
	discordSession.AddHandler(discordInteractionHandler)

	if err = discordSession.Open(); err != nil {
		log.Println("[Discord] failed to open connection:", err)
		discordSession = nil
	}
}

// registerSlashCommands registers global (or guild-scoped if DISCORD_DEV_GUILD_ID
// is set) application commands. Guild commands update instantly; global commands
// can take up to one hour to propagate across all servers.
func registerSlashCommands(s *discordgo.Session, appID string) {
	guildID := os.Getenv("DISCORD_DEV_GUILD_ID") // leave empty for global

	commands := []*discordgo.ApplicationCommand{
		{
			Name:        "commands",
			Description: "List custom Twitch bot commands for a channel",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "channel",
					Description: "Twitch channel name (defaults to this server's linked channel)",
					Required:    false,
				},
			},
		},
	}

	for _, cmd := range commands {
		if _, err := s.ApplicationCommandCreate(appID, guildID, cmd); err != nil {
			log.Println("[Discord] failed to register slash command:", cmd.Name, err)
		} else {
			log.Println("[Discord] registered slash command:", cmd.Name)
		}
	}
}

func discordInteractionHandler(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if i.Type != discordgo.InteractionApplicationCommand {
		return
	}
	switch i.ApplicationCommandData().Name {
	case "commands":
		handleCommandsSlash(s, i)
	}
}

func handleCommandsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	channelLogin := ""
	if opts := i.ApplicationCommandData().Options; len(opts) > 0 {
		channelLogin = strings.ToLower(strings.TrimSpace(opts[0].StringValue()))
	}

	// Fall back to the guild's linked Twitch channel if no channel was provided.
	if channelLogin == "" && i.GuildID != "" {
		if settings, err := GetDiscordSettingsByGuild(i.GuildID); err == nil && settings != nil {
			channelLogin = settings.BroadcasterLogin
		}
	}

	if channelLogin == "" {
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: "Please specify a channel name, e.g. `/commands channel:streamername`",
				Flags:   discordgo.MessageFlagsEphemeral,
			},
		})
		return
	}

	cmds, err := ListCustomCommands(channelLogin)
	if err != nil || len(cmds) == 0 {
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{
				Content: fmt.Sprintf("No custom commands found for **%s**.", channelLogin),
			},
		})
		return
	}

	var lines []string
	for _, c := range cmds {
		if c.Enabled {
			lines = append(lines, fmt.Sprintf("`%s` — %s", c.Command, c.Response))
		}
	}

	content := fmt.Sprintf("**Custom commands for %s:**\n%s", channelLogin, strings.Join(lines, "\n"))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}

	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Content: content},
	})
}

// PostDiscordLiveNotification sends a live alert to the broadcaster's
// configured Discord channel when they go live on Twitch.
func PostDiscordLiveNotification(broadcasterLogin, title, game string) {
	if discordSession == nil {
		return
	}
	settings, err := GetDiscordSettings(broadcasterLogin)
	if err != nil || settings == nil || settings.LiveChannelID == "" {
		return
	}
	if title == "" {
		title = "Untitled stream"
	}
	if game == "" {
		game = "Just Chatting"
	}
	msg := fmt.Sprintf("🔴 **%s is now live!**\n🎮 %s\n📺 %s\nhttps://twitch.tv/%s",
		broadcasterLogin, game, title, broadcasterLogin)
	if _, err := discordSession.ChannelMessageSend(settings.LiveChannelID, msg); err != nil {
		log.Println("[Discord] failed to post live notification:", err)
	}
}

// PostDiscordModAlert sends a ban or timeout alert to the broadcaster's
// configured mod-log Discord channel.
func PostDiscordModAlert(broadcasterLogin, moderator, target, action, reason string) {
	if discordSession == nil {
		return
	}
	settings, err := GetDiscordSettings(broadcasterLogin)
	if err != nil || settings == nil || settings.ModChannelID == "" {
		return
	}
	emoji := "🔨"
	if action == "timeout" {
		emoji = "⏱️"
	}
	msg := fmt.Sprintf("%s **[%s]** `%s` was %sed by `%s`", emoji, broadcasterLogin, target, action, moderator)
	if reason != "" {
		msg += "\nReason: " + reason
	}
	if _, err := discordSession.ChannelMessageSend(settings.ModChannelID, msg); err != nil {
		log.Println("[Discord] failed to post mod alert:", err)
	}
}

// PostDiscordBirthdayAnnouncement sends a birthday message to the broadcaster's
// configured birthday Discord channel.
func PostDiscordBirthdayAnnouncement(broadcasterLogin, names string) {
	if discordSession == nil {
		return
	}
	settings, err := GetDiscordSettings(broadcasterLogin)
	if err != nil || settings == nil || settings.BdayChannelID == "" {
		return
	}
	msg := fmt.Sprintf("🎂 Happy Birthday to **%s** in **%s**'s community! 🎉", names, broadcasterLogin)
	if _, err := discordSession.ChannelMessageSend(settings.BdayChannelID, msg); err != nil {
		log.Println("[Discord] failed to post birthday announcement:", err)
	}
}

// PostOwnerAnnouncement sends a message to the owner's global announcement
// channel defined by DISCORD_ANNOUNCEMENT_CHANNEL_ID. Useful for bot-wide
// update notices.
func PostOwnerAnnouncement(message string) {
	if discordSession == nil {
		return
	}
	channelID := os.Getenv("DISCORD_ANNOUNCEMENT_CHANNEL_ID")
	if channelID == "" {
		return
	}
	if _, err := discordSession.ChannelMessageSend(channelID, message); err != nil {
		log.Println("[Discord] failed to post owner announcement:", err)
	}
}

// BotGuild represents a Discord server the bot is currently in.
type BotGuild struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GuildChannel represents a text channel in a Discord server.
type GuildChannel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GetBotGuilds returns all Discord servers (guilds) the bot is currently in.
func GetBotGuilds() []BotGuild {
	if discordSession == nil {
		return nil
	}
	out := make([]BotGuild, 0)
	for _, g := range discordSession.State.Guilds {
		out = append(out, BotGuild{ID: g.ID, Name: g.Name})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// GetGuildTextChannels returns all text channels in a Discord server the bot
// is in, sorted alphabetically by name.
func GetGuildTextChannels(guildID string) ([]GuildChannel, error) {
	if discordSession == nil {
		return nil, fmt.Errorf("discord not initialized")
	}
	channels, err := discordSession.GuildChannels(guildID)
	if err != nil {
		return nil, err
	}
	var out []GuildChannel
	for _, ch := range channels {
		if ch.Type == discordgo.ChannelTypeGuildText {
			out = append(out, GuildChannel{ID: ch.ID, Name: ch.Name})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}
