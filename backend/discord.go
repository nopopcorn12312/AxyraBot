package main

import (
	"fmt"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

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

	discordSession.Identify.Intents = discordgo.IntentsGuilds | discordgo.IntentsGuildMessages | discordgo.IntentsGuildMembers | discordgo.IntentsMessageContent

	discordSession.AddHandler(func(s *discordgo.Session, r *discordgo.Ready) {
		log.Printf("[Discord] logged in as %s\n", r.User.Username)
		registerSlashCommands(s, r.User.ID)
	})
	discordSession.AddHandler(discordInteractionHandler)
	discordSession.AddHandler(discordMessageHandler)

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

	var (
		permBan     int64 = discordgo.PermissionBanMembers
		permKick    int64 = discordgo.PermissionKickMembers
		permTimeout int64 = discordgo.PermissionModerateMembers
		permManMsg  int64 = discordgo.PermissionManageMessages
		permManChan int64 = discordgo.PermissionManageChannels
	)

	commands := []*discordgo.ApplicationCommand{
		{
			Name:        "commands",
			Description: "List custom Twitch bot commands for a channel",
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionString, Name: "channel", Description: "Twitch channel name (defaults to this server's linked channel)", Required: false},
			},
		},
		{
			Name:                     "ban",
			Description:              "Ban a member from the server",
			DefaultMemberPermissions: &permBan,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to ban", Required: true},
				{Type: discordgo.ApplicationCommandOptionString, Name: "reason", Description: "Reason for the ban", Required: false},
			},
		},
		{
			Name:                     "kick",
			Description:              "Kick a member from the server",
			DefaultMemberPermissions: &permKick,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to kick", Required: true},
				{Type: discordgo.ApplicationCommandOptionString, Name: "reason", Description: "Reason for the kick", Required: false},
			},
		},
		{
			Name:                     "timeout",
			Description:              "Timeout a member (e.g. 10m, 2h, 1d — max 28d)",
			DefaultMemberPermissions: &permTimeout,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to timeout", Required: true},
				{Type: discordgo.ApplicationCommandOptionString, Name: "duration", Description: "Duration e.g. 10m 2h 1d", Required: true},
				{Type: discordgo.ApplicationCommandOptionString, Name: "reason", Description: "Reason for the timeout", Required: false},
			},
		},
		{
			Name:                     "untimeout",
			Description:              "Remove a timeout from a member",
			DefaultMemberPermissions: &permTimeout,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to un-timeout", Required: true},
			},
		},
		{
			Name:                     "warn",
			Description:              "Issue a warning to a member (stored in the database)",
			DefaultMemberPermissions: &permTimeout,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to warn", Required: true},
				{Type: discordgo.ApplicationCommandOptionString, Name: "reason", Description: "Reason for the warning", Required: true},
			},
		},
		{
			Name:                     "warnings",
			Description:              "View the warning history for a member",
			DefaultMemberPermissions: &permTimeout,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to check", Required: true},
			},
		},
		{
			Name:                     "clearwarnings",
			Description:              "Clear all warnings for a member",
			DefaultMemberPermissions: &permTimeout,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionUser, Name: "user", Description: "The user to clear warnings for", Required: true},
			},
		},
		{
			Name:                     "purge",
			Description:              "Bulk delete messages in the current channel (max 100)",
			DefaultMemberPermissions: &permManMsg,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionInteger, Name: "amount", Description: "Number of messages to delete (1–100)", Required: true},
			},
		},
		{
			Name:                     "lock",
			Description:              "Lock a channel so @everyone cannot send messages",
			DefaultMemberPermissions: &permManChan,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionChannel, Name: "channel", Description: "Channel to lock (defaults to current)", Required: false},
			},
		},
		{
			Name:                     "unlock",
			Description:              "Unlock a channel so @everyone can send messages again",
			DefaultMemberPermissions: &permManChan,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionChannel, Name: "channel", Description: "Channel to unlock (defaults to current)", Required: false},
			},
		},
		{
			Name:                     "slowmode",
			Description:              "Set slowmode delay in a channel (0 to disable, max 21600s)",
			DefaultMemberPermissions: &permManChan,
			Options: []*discordgo.ApplicationCommandOption{
				{Type: discordgo.ApplicationCommandOptionInteger, Name: "seconds", Description: "Delay in seconds (0–21600)", Required: true},
				{Type: discordgo.ApplicationCommandOptionChannel, Name: "channel", Description: "Channel to configure (defaults to current)", Required: false},
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
	case "ban":
		handleBanSlash(s, i)
	case "kick":
		handleKickSlash(s, i)
	case "timeout":
		handleTimeoutSlash(s, i)
	case "untimeout":
		handleUntimeoutSlash(s, i)
	case "warn":
		handleWarnSlash(s, i)
	case "warnings":
		handleWarningsSlash(s, i)
	case "clearwarnings":
		handleClearWarningsSlash(s, i)
	case "purge":
		handlePurgeSlash(s, i)
	case "lock":
		handleLockSlash(s, i)
	case "unlock":
		handleUnlockSlash(s, i)
	case "slowmode":
		handleSlowmodeSlash(s, i)
	}
}

// discordMessageHandler listens for regular chat messages and fires custom
// Twitch-style commands (e.g. "!hello") in any guild channel that has a
// linked Twitch broadcaster via discord_settings.
func discordMessageHandler(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Ignore messages from the bot itself.
	if m.Author == nil || m.Author.Bot {
		return
	}
	// Only handle guild (server) messages.
	if m.GuildID == "" {
		return
	}
	// Must start with "!" to be a potential command.
	msg := strings.TrimSpace(m.Content)
	if !strings.HasPrefix(msg, "!") {
		return
	}

	// Look up which Twitch broadcaster is linked to this guild.
	settings, err := GetDiscordSettingsByGuild(m.GuildID)
	if err != nil || settings == nil || settings.BroadcasterLogin == "" {
		return
	}
	broadcasterLogin := settings.BroadcasterLogin

	fields := strings.Fields(msg)
	if len(fields) == 0 {
		return
	}
	trigger := strings.ToLower(fields[0])

	resp, _, err := GetCustomCommandResponse(broadcasterLogin, trigger)
	if err != nil || resp == "" {
		return
	}

	// Increment usage counter (used by $(count)).
	usageCount, err := IncrementCustomCommandCount(broadcasterLogin, trigger)
	if err != nil {
		log.Println("[Discord] failed to increment command count:", err)
	}
	if usageCount <= 0 {
		usageCount = 1
	}

	// Build $(touser) from the argument after the trigger word.
	toUser := ""
	if len(fields) > 1 {
		toUser = strings.TrimPrefix(strings.Join(fields[1:], " "), "@")
	}

	// Use the Discord display name as the "chatter" for $(user) substitution.
	chatterName := m.Author.Username
	if m.Member != nil && m.Member.Nick != "" {
		chatterName = m.Member.Nick
	}

	// Render template variables.
	// We handle $(user) ourselves here to produce a Discord @mention instead
	// of a plain text username.
	wantMention := strings.Contains(resp, "$(user)")
	// Strip $(user) before calling the shared renderer so it won't add a
	// plain-text "@name" prefix — we'll add the mention ourselves.
	respWithoutUser := strings.ReplaceAll(resp, "$(user)", "")
	text := renderCustomCommandResponse(broadcasterLogin, chatterName, toUser, respWithoutUser, usageCount)
	text = strings.TrimSpace(text)

	if wantMention {
		mention := "<@" + m.Author.ID + ">"
		if text == "" {
			text = mention
		} else {
			text = mention + " " + text
		}
	}

	if text == "" {
		return
	}

	if _, err := s.ChannelMessageSendReply(m.ChannelID, text, m.Reference()); err != nil {
		log.Println("[Discord] failed to send command response:", err)
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

// ── Shared helpers ────────────────────────────────────────────────────────────

// optMap converts a slice of slash-command options into a name-keyed map for
// easy lookup without repeated linear scans.
func optMap(opts []*discordgo.ApplicationCommandInteractionDataOption) map[string]*discordgo.ApplicationCommandInteractionDataOption {
	m := make(map[string]*discordgo.ApplicationCommandInteractionDataOption, len(opts))
	for _, o := range opts {
		m[o.Name] = o
	}
	return m
}

// respondEphemeral sends a message visible only to the invoker.
func respondEphemeral(s *discordgo.Session, i *discordgo.InteractionCreate, msg string) {
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Content: msg, Flags: discordgo.MessageFlagsEphemeral},
	})
}

// respondPublic sends a message visible to everyone in the channel.
func respondPublic(s *discordgo.Session, i *discordgo.InteractionCreate, msg string) {
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Content: msg},
	})
}

// strPtr returns a pointer to a string literal — required by WebhookEdit.
func strPtr(v string) *string { return &v }

// parseDuration parses a human duration string (e.g. "10m", "2h", "7d") into
// a time.Duration. Supported suffixes: s, m, h, d.
func parseDuration(s string) (time.Duration, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	if len(s) < 2 {
		return 0, fmt.Errorf("invalid duration %q", s)
	}
	suffix := s[len(s)-1]
	val, err := strconv.ParseFloat(s[:len(s)-1], 64)
	if err != nil || val <= 0 {
		return 0, fmt.Errorf("invalid duration %q", s)
	}
	switch suffix {
	case 's':
		return time.Duration(val * float64(time.Second)), nil
	case 'm':
		return time.Duration(val * float64(time.Minute)), nil
	case 'h':
		return time.Duration(val * float64(time.Hour)), nil
	case 'd':
		return time.Duration(val * 24 * float64(time.Hour)), nil
	}
	return 0, fmt.Errorf("unknown duration unit %q — use s/m/h/d", string(suffix))
}

// postModLogEmbed sends a rich embed to the guild's configured mod-log channel.
func postModLogEmbed(s *discordgo.Session, guildID, action string, target, mod *discordgo.User, reason string, color int) {
	settings, err := GetDiscordSettingsByGuild(guildID)
	if err != nil || settings == nil || settings.ModChannelID == "" {
		return
	}
	_, _ = s.ChannelMessageSendEmbed(settings.ModChannelID, &discordgo.MessageEmbed{
		Title: action,
		Color: color,
		Fields: []*discordgo.MessageEmbedField{
			{Name: "User", Value: fmt.Sprintf("<@%s> (`%s`)", target.ID, target.Username), Inline: true},
			{Name: "Moderator", Value: fmt.Sprintf("<@%s> (`%s`)", mod.ID, mod.Username), Inline: true},
			{Name: "Reason", Value: reason, Inline: false},
		},
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// ── Moderation slash command handlers ─────────────────────────────────────────

func handleBanSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	reason := "No reason provided"
	if r, ok := opts["reason"]; ok {
		reason = r.StringValue()
	}
	if err := s.GuildBanCreateWithReason(i.GuildID, target.ID, reason, 0); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to ban: %s", err))
		return
	}
	postModLogEmbed(s, i.GuildID, "🔨 Member Banned", target, i.Member.User, reason, 0xED4245)
	respondPublic(s, i, fmt.Sprintf("✅ **%s** has been banned. Reason: %s", target.Username, reason))
}

func handleKickSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	reason := "No reason provided"
	if r, ok := opts["reason"]; ok {
		reason = r.StringValue()
	}
	if err := s.GuildMemberDeleteWithReason(i.GuildID, target.ID, reason); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to kick: %s", err))
		return
	}
	postModLogEmbed(s, i.GuildID, "👢 Member Kicked", target, i.Member.User, reason, 0xFEE75C)
	respondPublic(s, i, fmt.Sprintf("✅ **%s** has been kicked. Reason: %s", target.Username, reason))
}

func handleTimeoutSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	durStr := opts["duration"].StringValue()
	reason := "No reason provided"
	if r, ok := opts["reason"]; ok {
		reason = r.StringValue()
	}
	dur, err := parseDuration(durStr)
	if err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Invalid duration — use e.g. `10m`, `2h`, `1d` (max 28d)"))
		return
	}
	if dur > 28*24*time.Hour {
		dur = 28 * 24 * time.Hour
	}
	until := time.Now().Add(dur)
	if err := s.GuildMemberTimeout(i.GuildID, target.ID, &until); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to timeout: %s", err))
		return
	}
	postModLogEmbed(s, i.GuildID, "⏱️ Member Timed Out", target, i.Member.User,
		fmt.Sprintf("Duration: %s — %s", durStr, reason), 0xEB459E)
	respondPublic(s, i, fmt.Sprintf("⏱️ **%s** has been timed out for **%s**. Reason: %s", target.Username, durStr, reason))
}

func handleUntimeoutSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	if err := s.GuildMemberTimeout(i.GuildID, target.ID, nil); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to remove timeout: %s", err))
		return
	}
	postModLogEmbed(s, i.GuildID, "✅ Timeout Removed", target, i.Member.User, "Timeout manually removed", 0x57F287)
	respondPublic(s, i, fmt.Sprintf("✅ Timeout removed for **%s**.", target.Username))
}

func handleWarnSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	reason := opts["reason"].StringValue()
	count, err := AddDiscordWarning(i.GuildID, target.ID, target.Username, i.Member.User.ID, i.Member.User.Username, reason)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to save warning.")
		return
	}
	postModLogEmbed(s, i.GuildID, fmt.Sprintf("⚠️ Member Warned (warning #%d)", count), target, i.Member.User, reason, 0xFEE75C)
	respondPublic(s, i, fmt.Sprintf("⚠️ **%s** has been warned (warning #%d). Reason: %s", target.Username, count, reason))
}

func handleWarningsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	warnings, err := GetDiscordWarnings(i.GuildID, target.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch warnings.")
		return
	}
	if len(warnings) == 0 {
		respondEphemeral(s, i, fmt.Sprintf("✅ **%s** has no warnings.", target.Username))
		return
	}
	var lines []string
	for idx, w := range warnings {
		lines = append(lines, fmt.Sprintf("**#%d** — %s *(by %s, %s)*",
			idx+1, w.Reason, w.ModUsername, w.CreatedAt.Format("Jan 2 2006")))
	}
	content := fmt.Sprintf("**Warnings for %s (%d total):**\n%s", target.Username, len(warnings), strings.Join(lines, "\n"))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}
	respondEphemeral(s, i, content)
}

func handleClearWarningsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	count, err := ClearDiscordWarnings(i.GuildID, target.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to clear warnings.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("🗑️ Cleared **%d** warning(s) for **%s**.", count, target.Username))
}

func handlePurgeSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	amount := int(opts["amount"].IntValue())
	if amount < 1 {
		amount = 1
	}
	if amount > 100 {
		amount = 100
	}
	// Defer so we have time to fetch + delete without the interaction expiring.
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Flags: discordgo.MessageFlagsEphemeral},
	})
	msgs, err := s.ChannelMessages(i.ChannelID, amount, "", "", "")
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to fetch messages.")})
		return
	}
	ids := make([]string, len(msgs))
	for j, m := range msgs {
		ids[j] = m.ID
	}
	if err := s.ChannelMessagesBulkDelete(i.ChannelID, ids); err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr(fmt.Sprintf("❌ Bulk delete failed: %s", err))})
		return
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr(fmt.Sprintf("🗑️ Deleted **%d** message(s).", len(ids)))})
}

func handleLockSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	channelID := i.ChannelID
	opts := optMap(i.ApplicationCommandData().Options)
	if ch, ok := opts["channel"]; ok {
		channelID = ch.ChannelValue(s).ID
	}
	// Deny @everyone (role ID == guild ID) from sending messages.
	if err := s.ChannelPermissionSet(channelID, i.GuildID, discordgo.PermissionOverwriteTypeRole, 0, discordgo.PermissionSendMessages); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to lock channel: %s", err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("🔒 <#%s> has been locked.", channelID))
}

func handleUnlockSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	channelID := i.ChannelID
	opts := optMap(i.ApplicationCommandData().Options)
	if ch, ok := opts["channel"]; ok {
		channelID = ch.ChannelValue(s).ID
	}
	// Restore @everyone send-messages to neutral (remove the deny).
	if err := s.ChannelPermissionSet(channelID, i.GuildID, discordgo.PermissionOverwriteTypeRole, discordgo.PermissionSendMessages, 0); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to unlock channel: %s", err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("🔓 <#%s> has been unlocked.", channelID))
}

func handleSlowmodeSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := optMap(i.ApplicationCommandData().Options)
	seconds := int(opts["seconds"].IntValue())
	if seconds < 0 {
		seconds = 0
	}
	if seconds > 21600 {
		seconds = 21600
	}
	channelID := i.ChannelID
	if ch, ok := opts["channel"]; ok {
		channelID = ch.ChannelValue(s).ID
	}
	if _, err := s.ChannelEditComplex(channelID, &discordgo.ChannelEdit{RateLimitPerUser: &seconds}); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to set slowmode: %s", err))
		return
	}
	if seconds == 0 {
		respondPublic(s, i, fmt.Sprintf("✅ Slowmode disabled in <#%s>.", channelID))
	} else {
		respondPublic(s, i, fmt.Sprintf("✅ Slowmode set to **%ds** in <#%s>.", seconds, channelID))
	}
}

// PostDiscordLiveNotification sends a live alert to every Discord server the
// broadcaster has configured.
func PostDiscordLiveNotification(broadcasterLogin, title, game string) {
	if discordSession == nil {
		return
	}
	all, err := GetAllDiscordSettingsForBroadcaster(broadcasterLogin)
	if err != nil || len(all) == 0 {
		return
	}
	if title == "" {
		title = "Untitled stream"
	}
	if game == "" {
		game = "Just Chatting"
	}
	const defaultLiveTmpl = "🔴 **$(channel) is now live!**\n🎮 $(game)\n📺 $(title)\nhttps://twitch.tv/$(channel)"
	msg := renderDiscordTemplate(broadcasterLogin, "live", defaultLiveTmpl, map[string]string{
		"channel": broadcasterLogin,
		"title":   title,
		"game":    game,
	})
	for _, settings := range all {
		if settings.LiveChannelID == "" {
			continue
		}
		if _, err := discordSession.ChannelMessageSend(settings.LiveChannelID, msg); err != nil {
			log.Println("[Discord] failed to post live notification:", err)
		}
	}
}

// PostDiscordModAlert sends a ban or timeout alert to every Discord server the
// broadcaster has configured for mod alerts.
func PostDiscordModAlert(broadcasterLogin, moderator, target, action, reason string) {
	if discordSession == nil {
		return
	}
	all, err := GetAllDiscordSettingsForBroadcaster(broadcasterLogin)
	if err != nil || len(all) == 0 {
		return
	}
	emoji := "🔨"
	verb := action + "ed"
	switch action {
	case "ban":
		emoji = "🔨"
		verb = "banned"
	case "timeout":
		emoji = "⏱️"
		verb = "timed out"
	case "delete":
		emoji = "🗑️"
		verb = "had their message deleted"
	}
	defaultModTmpl := "$(emoji) **[$(channel)]** `$(target)` was $(verb) by `$(moderator)`"
	if reason != "" {
		defaultModTmpl += "\nReason: $(reason)"
	}
	msg := renderDiscordTemplate(broadcasterLogin, "mod", defaultModTmpl, map[string]string{
		"channel":   broadcasterLogin,
		"moderator": moderator,
		"target":    target,
		"action":    action,
		"verb":      verb,
		"emoji":     emoji,
		"reason":    reason,
	})
	for _, settings := range all {
		if settings.ModChannelID == "" {
			continue
		}
		if _, err := discordSession.ChannelMessageSend(settings.ModChannelID, msg); err != nil {
			log.Println("[Discord] failed to post mod alert:", err)
		}
	}
}

// PostDiscordBirthdayAnnouncement sends a birthday message to every Discord
// server the broadcaster has configured for birthday announcements.
func PostDiscordBirthdayAnnouncement(broadcasterLogin, names string) {
	if discordSession == nil {
		return
	}
	all, err := GetAllDiscordSettingsForBroadcaster(broadcasterLogin)
	if err != nil || len(all) == 0 {
		return
	}
	const defaultBdayTmpl = "🎂 Happy Birthday to **$(names)** in **$(channel)**'s community! 🎉"
	msg := renderDiscordTemplate(broadcasterLogin, "birthday", defaultBdayTmpl, map[string]string{
		"names":   names,
		"channel": broadcasterLogin,
	})
	for _, settings := range all {
		if settings.BdayChannelID == "" {
			continue
		}
		if _, err := discordSession.ChannelMessageSend(settings.BdayChannelID, msg); err != nil {
			log.Println("[Discord] failed to post birthday announcement:", err)
		}
	}
}

// renderDiscordTemplate substitutes $(variable) placeholders in a Discord
// notification template. If the broadcaster has a custom template stored in
// the DB it is used; otherwise defaultTmpl is used. If no custom template is
// stored (empty string), the default is returned with substitution applied.
func renderDiscordTemplate(broadcasterLogin, notificationType, defaultTmpl string, vars map[string]string) string {
	tmpl := defaultTmpl
	if stored, err := GetDiscordNotificationTemplate(broadcasterLogin, notificationType); err == nil && strings.TrimSpace(stored) != "" {
		tmpl = stored
	}
	for k, v := range vars {
		tmpl = strings.ReplaceAll(tmpl, "$("+k+")", v)
	}
	return tmpl
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
	Icon string `json:"icon"` // CDN URL, empty string if no icon
}

// GuildChannel represents a text channel in a Discord server.
type GuildChannel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GuildRole represents a role in a Discord server.
type GuildRole struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color int    `json:"color"` // RGB int from Discord (0 = no colour / default)
}

// GetGuildRoles returns all non-managed, non-@everyone roles in the guild,
// sorted alphabetically. Managed roles (e.g. bot roles) are excluded.
func GetGuildRoles(guildID string) ([]GuildRole, error) {
	if discordSession == nil {
		return nil, fmt.Errorf("discord not initialized")
	}
	roles, err := discordSession.GuildRoles(guildID)
	if err != nil {
		return nil, err
	}
	var out []GuildRole
	for _, r := range roles {
		if r.Managed || r.Name == "@everyone" {
			continue
		}
		out = append(out, GuildRole{ID: r.ID, Name: r.Name, Color: r.Color})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}


// GetBotGuilds returns all Discord servers (guilds) the bot is currently in.
func GetBotGuilds() []BotGuild {
	if discordSession == nil {
		return nil
	}
	out := make([]BotGuild, 0)
	for _, g := range discordSession.State.Guilds {
		iconURL := ""
		if g.Icon != "" {
			ext := "png"
			if strings.HasPrefix(g.Icon, "a_") {
				ext = "gif"
			}
			iconURL = fmt.Sprintf("https://cdn.discordapp.com/icons/%s/%s.%s?size=64", g.ID, g.Icon, ext)
		}
		out = append(out, BotGuild{ID: g.ID, Name: g.Name, Icon: iconURL})
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
