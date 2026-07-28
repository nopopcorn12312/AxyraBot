package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bwmarrin/discordgo"
)

// discordHTTPClient is a shared HTTP client for external API calls.
var discordHTTPClient = &http.Client{Timeout: 10 * time.Second}

// ── Module guard ──────────────────────────────────────────────────────────────

// isGuildModuleEnabled returns true (default) unless the guild has explicitly
// disabled the named module via /module disable.
func isGuildModuleEnabled(guildID, module string) bool {
	if guildID == "" {
		return true
	}
	enabled, err := GetDiscordGuildModuleEnabled(guildID, module)
	if err != nil {
		return true
	}
	return enabled
}

// moduleDisabledReply sends a standard "module disabled" ephemeral reply.
func moduleDisabledReply(s *discordgo.Session, i *discordgo.InteractionCreate, module string) {
	respondEphemeral(s, i, fmt.Sprintf("❌ The **%s** module is disabled in this server. An admin can re-enable it with `/module enable %s`.", module, module))
}

// ── Shared helpers ────────────────────────────────────────────────────────────

// logModCase creates a mod case entry after a successful moderation action.
// Errors are non-fatal (logged only).
func logModCase(guildID, action, targetID, targetName, modID, modName, reason string) {
	if _, err := CreateDiscordModCase(guildID, action, targetID, targetName, modID, modName, reason); err != nil {
		log.Println("[Discord] failed to log mod case:", err)
	}
}

// ── Moderation — new commands ─────────────────────────────────────────────────

func handleSoftbanSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	reason := "No reason provided"
	if r, ok := opts["reason"]; ok {
		reason = r.StringValue()
	}
	// Ban with 7 days of message deletion, then immediately unban.
	if err := s.GuildBanCreateWithReason(i.GuildID, target.ID, reason, 7); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to ban: %s", err))
		return
	}
	if err := s.GuildBanDelete(i.GuildID, target.ID); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("⚠️ Banned but could not unban: %s", err))
		return
	}
	logModCase(i.GuildID, "softban", target.ID, target.Username, i.Member.User.ID, i.Member.User.Username, reason)
	postModLogEmbed(s, i.GuildID, "🧹 Member Softbanned", target, i.Member.User, reason, 0xFFA500)
	respondPublic(s, i, fmt.Sprintf("🧹 **%s** has been softbanned (messages deleted). Reason: %s", target.Username, reason))
}

func handleDeafenSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	reason := "No reason provided"
	if r, ok := opts["reason"]; ok {
		reason = r.StringValue()
	}
	if err := s.GuildMemberDeafen(i.GuildID, target.ID, true); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to deafen (user may not be in a voice channel): %s", err))
		return
	}
	logModCase(i.GuildID, "deafen", target.ID, target.Username, i.Member.User.ID, i.Member.User.Username, reason)
	postModLogEmbed(s, i.GuildID, "🔇 Member Deafened", target, i.Member.User, reason, 0xED4245)
	respondPublic(s, i, fmt.Sprintf("🔇 **%s** has been server-deafened. Reason: %s", target.Username, reason))
}

func handleUndeafenSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	if err := s.GuildMemberDeafen(i.GuildID, target.ID, false); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to undeafen: %s", err))
		return
	}
	postModLogEmbed(s, i.GuildID, "🔊 Member Undeafened", target, i.Member.User, "Deafen removed", 0x57F287)
	respondPublic(s, i, fmt.Sprintf("🔊 **%s** has been undeafened.", target.Username))
}

func handleLockdownSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	data := i.ApplicationCommandData()
	if len(data.Options) == 0 {
		return
	}
	sub := data.Options[0]
	switch sub.Name {
	case "start":
		reason := "Lockdown initiated"
		if len(sub.Options) > 0 {
			reason = sub.Options[0].StringValue()
		}
		channels, err := s.GuildChannels(i.GuildID)
		if err != nil {
			respondEphemeral(s, i, "❌ Failed to fetch channels.")
			return
		}
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		})
		locked := 0
		for _, ch := range channels {
			if ch.Type != discordgo.ChannelTypeGuildText {
				continue
			}
			if err := s.ChannelPermissionSet(ch.ID, i.GuildID, discordgo.PermissionOverwriteTypeRole, 0, discordgo.PermissionSendMessages); err == nil {
				_ = AddDiscordLockdownChannel(i.GuildID, ch.ID)
				locked++
			}
		}
		msg := fmt.Sprintf("🔒 **Server Lockdown Active** — %d channels locked. Reason: %s", locked, reason)
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &msg})
	case "end":
		reason := "Lockdown ended"
		if len(sub.Options) > 0 {
			reason = sub.Options[0].StringValue()
		}
		lockedChannels, err := GetDiscordLockdownChannels(i.GuildID)
		if err != nil || len(lockedChannels) == 0 {
			respondEphemeral(s, i, "ℹ️ No active lockdown found.")
			return
		}
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		})
		unlocked := 0
		for _, chID := range lockedChannels {
			if err := s.ChannelPermissionSet(chID, i.GuildID, discordgo.PermissionOverwriteTypeRole, discordgo.PermissionSendMessages, 0); err == nil {
				unlocked++
			}
		}
		_ = ClearDiscordLockdownChannels(i.GuildID)
		msg := fmt.Sprintf("🔓 **Lockdown Lifted** — %d channels unlocked. Reason: %s", unlocked, reason)
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &msg})
	}
}

func handleTempRoleSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	role := opts["role"].RoleValue(s, i.GuildID)
	durStr := opts["duration"].StringValue()
	reason := "No reason provided"
	if r, ok := opts["reason"]; ok {
		reason = r.StringValue()
	}
	dur, err := parseDuration(durStr)
	if err != nil {
		respondEphemeral(s, i, "❌ Invalid duration. Use e.g. `10m`, `2h`, `7d`.")
		return
	}
	if err := s.GuildMemberRoleAdd(i.GuildID, target.ID, role.ID); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to assign role: %s", err))
		return
	}
	expiresAt := time.Now().Add(dur)
	if err := CreateDiscordTempRole(i.GuildID, target.ID, role.ID, expiresAt); err != nil {
		log.Println("[Discord] failed to store temp role:", err)
	}
	logModCase(i.GuildID, "temprole", target.ID, target.Username, i.Member.User.ID, i.Member.User.Username, fmt.Sprintf("Role: %s, Duration: %s, %s", role.Name, durStr, reason))
	respondPublic(s, i, fmt.Sprintf("✅ Assigned **%s** to **%s** for **%s**. Reason: %s", role.Name, target.Username, durStr, reason))
}

func handleRolePersistSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	role := opts["role"].RoleValue(s, i.GuildID)
	added, err := ToggleDiscordRolePersist(i.GuildID, target.ID, role.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Database error.")
		return
	}
	if added {
		_ = s.GuildMemberRoleAdd(i.GuildID, target.ID, role.ID)
		respondPublic(s, i, fmt.Sprintf("✅ **%s** will now persistently hold the **%s** role (re-applied on rejoin).", target.Username, role.Name))
	} else {
		respondPublic(s, i, fmt.Sprintf("✅ Removed role persistence for **%s** → **%s**.", target.Username, role.Name))
	}
}

func handleModLogsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	cases, err := GetDiscordModCasesByUser(i.GuildID, target.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch mod logs.")
		return
	}
	if len(cases) == 0 {
		respondEphemeral(s, i, fmt.Sprintf("✅ No mod logs found for **%s**.", target.Username))
		return
	}
	var lines []string
	for _, c := range cases {
		lines = append(lines, fmt.Sprintf("**Case #%d** [%s] — %s *(by %s, %s)*",
			c.CaseNumber, strings.ToUpper(c.Action), c.Reason, c.ModName, c.CreatedAt.Format("Jan 2 2006")))
	}
	content := fmt.Sprintf("**Mod logs for %s (%d total):**\n%s", target.Username, len(cases), strings.Join(lines, "\n"))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}
	respondEphemeral(s, i, content)
}

func handleModStatsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	targetID := i.Member.User.ID
	targetName := i.Member.User.Username
	if u, ok := opts["user"]; ok {
		user := u.UserValue(s)
		targetID = user.ID
		targetName = user.Username
	}
	stats, err := GetDiscordModStats(i.GuildID, targetID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch mod stats.")
		return
	}
	if len(stats) == 0 {
		respondEphemeral(s, i, fmt.Sprintf("ℹ️ No mod actions recorded for **%s**.", targetName))
		return
	}
	total := 0
	var lines []string
	for action, count := range stats {
		lines = append(lines, fmt.Sprintf("• **%s**: %d", action, count))
		total += count
	}
	sort.Strings(lines)
	respondEphemeral(s, i, fmt.Sprintf("**Mod stats for %s (total: %d):**\n%s", targetName, total, strings.Join(lines, "\n")))
}

func handleCaseSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	caseNum := int(opts["number"].IntValue())
	c, err := GetDiscordModCase(i.GuildID, caseNum)
	if err != nil || c == nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Case #%d not found.", caseNum))
		return
	}
	embed := &discordgo.MessageEmbed{
		Title: fmt.Sprintf("Case #%d — %s", c.CaseNumber, strings.ToUpper(c.Action)),
		Color: 0x5865F2,
		Fields: []*discordgo.MessageEmbedField{
			{Name: "Target", Value: fmt.Sprintf("<@%s> (`%s`)", c.TargetID, c.TargetName), Inline: true},
			{Name: "Moderator", Value: fmt.Sprintf("<@%s> (`%s`)", c.ModID, c.ModName), Inline: true},
			{Name: "Reason", Value: c.Reason, Inline: false},
		},
		Timestamp: c.CreatedAt.UTC().Format(time.RFC3339),
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Embeds: []*discordgo.MessageEmbed{embed},
			Flags:  discordgo.MessageFlagsEphemeral,
		},
	})
}

func handleReasonSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	caseNum := int(opts["number"].IntValue())
	reason := opts["reason"].StringValue()
	if err := UpdateDiscordModCaseReason(i.GuildID, caseNum, reason); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to update case #%d: %s", caseNum, err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("✅ Reason updated for case #%d.", caseNum))
}

func handleNoteSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	note := opts["note"].StringValue()
	id, err := AddDiscordMemberNote(i.GuildID, target.ID, i.Member.User.ID, i.Member.User.Username, note)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to add note.")
		return
	}
	respondEphemeral(s, i, fmt.Sprintf("📝 Note #%d added for **%s**.", id, target.Username))
}

func handleNotesSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	notes, err := GetDiscordMemberNotes(i.GuildID, target.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch notes.")
		return
	}
	if len(notes) == 0 {
		respondEphemeral(s, i, fmt.Sprintf("ℹ️ No notes for **%s**.", target.Username))
		return
	}
	var lines []string
	for _, n := range notes {
		lines = append(lines, fmt.Sprintf("**#%d** (%s by %s) — %s", n.ID, n.CreatedAt.Format("Jan 2 2006"), n.ModName, n.Note))
	}
	content := fmt.Sprintf("**Notes for %s:**\n%s", target.Username, strings.Join(lines, "\n"))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}
	respondEphemeral(s, i, content)
}

func handleDelNoteSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	noteID := opts["id"].IntValue()
	if err := DeleteDiscordMemberNote(i.GuildID, noteID); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to delete note #%d.", noteID))
		return
	}
	respondEphemeral(s, i, fmt.Sprintf("🗑️ Note #%d deleted.", noteID))
}

func handleClearNotesSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	count, err := ClearDiscordMemberNotes(i.GuildID, target.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to clear notes.")
		return
	}
	respondEphemeral(s, i, fmt.Sprintf("🗑️ Cleared **%d** note(s) for **%s**.", count, target.Username))
}

func handleDelWarnSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	warnNum := int(opts["number"].IntValue())
	warnings, err := GetDiscordWarnings(i.GuildID, target.ID)
	if err != nil || warnNum < 1 || warnNum > len(warnings) {
		respondEphemeral(s, i, fmt.Sprintf("❌ Warning #%d not found for **%s**.", warnNum, target.Username))
		return
	}
	// Warnings ordered newest-first; #1 = newest.
	warnToDelete := warnings[warnNum-1]
	if err := DeleteDiscordWarningByID(i.GuildID, warnToDelete.ID); err != nil {
		respondEphemeral(s, i, "❌ Failed to delete warning.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("🗑️ Warning #%d for **%s** removed.", warnNum, target.Username))
}

func handleMembersSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "moderation") {
		moduleDisabledReply(s, i, "moderation")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Flags: discordgo.MessageFlagsEphemeral},
	})
	var members []*discordgo.Member
	after := ""
	for {
		batch, err := s.GuildMembers(i.GuildID, after, 1000)
		if err != nil || len(batch) == 0 {
			break
		}
		for _, m := range batch {
			for _, rID := range m.Roles {
				if rID == role.ID {
					members = append(members, m)
					break
				}
			}
		}
		if len(batch) < 1000 {
			break
		}
		after = batch[len(batch)-1].User.ID
	}
	if len(members) == 0 {
		msg := fmt.Sprintf("ℹ️ No members with the **%s** role.", role.Name)
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &msg})
		return
	}
	var names []string
	for _, m := range members {
		name := m.User.Username
		if m.Nick != "" {
			name = m.Nick
		}
		names = append(names, name)
	}
	sort.Strings(names)
	content := fmt.Sprintf("**Members with @%s (%d):**\n%s", role.Name, len(names), strings.Join(names, ", "))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &content})
}

// ── Manager commands ──────────────────────────────────────────────────────────

func handleAnnounceSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	ch := opts["channel"].ChannelValue(s)
	// Replace literal \n with real newlines so users can format rules, etc.
	message := strings.ReplaceAll(opts["message"].StringValue(), `\n`, "\n")

	var title string
	if opt, ok := opts["title"]; ok {
		title = strings.ReplaceAll(opt.StringValue(), `\n`, "\n")
	}

	// Parse optional hex color; default to white (0xFFFFFF).
	color := 0xFFFFFF
	if opt, ok := opts["color"]; ok {
		hexStr := strings.TrimPrefix(strings.TrimSpace(opt.StringValue()), "#")
		if v, err := strconv.ParseInt(hexStr, 16, 32); err == nil {
			color = int(v)
		}
	}

	embed := &discordgo.MessageEmbed{
		Description: message,
		Color:       color,
	}
	if title != "" {
		embed.Title = title
	}

	if _, err := s.ChannelMessageSendEmbed(ch.ID, embed); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to send: %s", err))
		return
	}
	respondEphemeral(s, i, fmt.Sprintf("✅ Announcement sent to <#%s>.", ch.ID))
}

func handleRoleSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	role := opts["role"].RoleValue(s, i.GuildID)
	member, err := s.GuildMember(i.GuildID, target.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch member.")
		return
	}
	hasRole := false
	for _, rID := range member.Roles {
		if rID == role.ID {
			hasRole = true
			break
		}
	}
	if hasRole {
		if err := s.GuildMemberRoleRemove(i.GuildID, target.ID, role.ID); err != nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ Failed to remove role: %s", err))
			return
		}
		respondPublic(s, i, fmt.Sprintf("➖ Removed **%s** from **%s**.", role.Name, target.Username))
	} else {
		if err := s.GuildMemberRoleAdd(i.GuildID, target.ID, role.ID); err != nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ Failed to add role: %s", err))
			return
		}
		respondPublic(s, i, fmt.Sprintf("➕ Added **%s** to **%s**.", role.Name, target.Username))
	}
}

func handleAddRoleSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	name := opts["name"].StringValue()
	color := 0
	hoist := false
	if c, ok := opts["color"]; ok {
		hexStr := strings.TrimPrefix(c.StringValue(), "#")
		if n, err := strconv.ParseInt(hexStr, 16, 32); err == nil {
			color = int(n)
		}
	}
	if h, ok := opts["hoist"]; ok {
		hoist = h.BoolValue()
	}
	role, err := s.GuildRoleCreate(i.GuildID, &discordgo.RoleParams{Name: name, Color: &color, Hoist: &hoist})
	if err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to create role: %s", err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("✅ Role **%s** created (ID: `%s`).", role.Name, role.ID))
}

func handleDelRoleSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	if err := s.GuildRoleDelete(i.GuildID, role.ID); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to delete role: %s", err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("🗑️ Role **%s** deleted.", role.Name))
}

func handleRoleColorSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	hexStr := strings.TrimPrefix(opts["color"].StringValue(), "#")
	n, err := strconv.ParseInt(hexStr, 16, 32)
	if err != nil {
		respondEphemeral(s, i, "❌ Invalid hex color. Use format `FF5733` or `#FF5733`.")
		return
	}
	color := int(n)
	if _, err := s.GuildRoleEdit(i.GuildID, role.ID, &discordgo.RoleParams{Color: &color}); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to change color: %s", err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("🎨 Color of **%s** updated to `#%06X`.", role.Name, color))
}

func handleRoleNameSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	newName := opts["name"].StringValue()
	if _, err := s.GuildRoleEdit(i.GuildID, role.ID, &discordgo.RoleParams{Name: newName}); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to rename role: %s", err))
		return
	}
	respondPublic(s, i, fmt.Sprintf("✅ Role renamed to **%s**.", newName))
}

func handleSetNickSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := opts["user"].UserValue(s)
	nick := ""
	if n, ok := opts["nickname"]; ok {
		nick = n.StringValue()
	}
	if err := s.GuildMemberNickname(i.GuildID, target.ID, nick); err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Failed to set nickname: %s", err))
		return
	}
	if nick == "" {
		respondPublic(s, i, fmt.Sprintf("✅ Nickname reset for **%s**.", target.Username))
	} else {
		respondPublic(s, i, fmt.Sprintf("✅ Nickname of **%s** set to **%s**.", target.Username, nick))
	}
}

func handleAddModSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	if err := AddDiscordModRole(i.GuildID, role.ID, role.Name); err != nil {
		respondEphemeral(s, i, "❌ Failed to add mod role.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("✅ **%s** is now a moderator role.", role.Name))
}

func handleDelModSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	if err := RemoveDiscordModRole(i.GuildID, role.ID); err != nil {
		respondEphemeral(s, i, "❌ Failed to remove mod role.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("✅ **%s** is no longer a moderator role.", role.Name))
}

func handleListModsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	roles, err := GetDiscordModRoles(i.GuildID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch mod roles.")
		return
	}
	if len(roles) == 0 {
		respondEphemeral(s, i, "ℹ️ No moderator roles configured. Use `/addmod` to add one.")
		return
	}
	var lines []string
	for _, r := range roles {
		lines = append(lines, fmt.Sprintf("• <@&%s> (`%s`)", r.RoleID, r.RoleName))
	}
	respondEphemeral(s, i, fmt.Sprintf("**Moderator Roles:**\n%s", strings.Join(lines, "\n")))
}

func handleGiveawaySlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "giveaway") {
		moduleDisabledReply(s, i, "giveaway")
		return
	}
	data := i.ApplicationCommandData()
	if len(data.Options) == 0 {
		return
	}
	sub := data.Options[0]
	subOpts := optMap(sub.Options)

	switch sub.Name {
	case "start":
		prize := subOpts["prize"].StringValue()
		durStr := subOpts["duration"].StringValue()
		winners := 1
		if w, ok := subOpts["winners"]; ok {
			winners = int(w.IntValue())
			if winners < 1 {
				winners = 1
			}
		}
		dur, err := parseDuration(durStr)
		if err != nil {
			respondEphemeral(s, i, "❌ Invalid duration. Use e.g. `10m`, `2h`, `1d`.")
			return
		}
		endsAt := time.Now().Add(dur)
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		})
		embed := &discordgo.MessageEmbed{
			Title:       "🎉 GIVEAWAY 🎉",
			Description: fmt.Sprintf("**Prize:** %s\n\nReact with 🎉 to enter!\n**Winners:** %d\n**Ends:** <t:%d:R>", prize, winners, endsAt.Unix()),
			Color:       0x57F287,
			Footer:      &discordgo.MessageEmbedFooter{Text: fmt.Sprintf("Hosted by %s", i.Member.User.Username)},
		}
		msg, err := s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
		if err != nil || msg == nil {
			return
		}
		_ = s.MessageReactionAdd(i.ChannelID, msg.ID, "🎉")
		id, err := CreateDiscordGiveaway(i.GuildID, i.ChannelID, prize, winners, i.Member.User.ID, endsAt)
		if err != nil {
			log.Println("[Discord] failed to store giveaway:", err)
			return
		}
		_ = SetDiscordGiveawayMessageID(id, msg.ID)

	case "end":
		msgID := subOpts["message_id"].StringValue()
		g, err := GetDiscordGiveawayByMessage(msgID)
		if err != nil || g == nil {
			respondEphemeral(s, i, "❌ Giveaway not found.")
			return
		}
		if g.Ended {
			respondEphemeral(s, i, "❌ This giveaway has already ended.")
			return
		}
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{Flags: discordgo.MessageFlagsEphemeral},
		})
		resolveGiveaway(s, g, false)
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("✅ Giveaway ended.")})

	case "reroll":
		msgID := subOpts["message_id"].StringValue()
		g, err := GetDiscordGiveawayByMessage(msgID)
		if err != nil || g == nil {
			respondEphemeral(s, i, "❌ Giveaway not found.")
			return
		}
		_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
			Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
			Data: &discordgo.InteractionResponseData{Flags: discordgo.MessageFlagsEphemeral},
		})
		resolveGiveaway(s, g, true)
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("✅ Giveaway rerolled.")})
	}
}

// resolveGiveaway picks winners from 🎉 reactors and announces them in the channel.
func resolveGiveaway(s *discordgo.Session, g *DiscordGiveaway, isReroll bool) {
	reactors, err := s.MessageReactions(g.ChannelID, g.MessageID, "🎉", 100, "", "")
	if err != nil {
		log.Println("[Discord] failed to get giveaway reactors:", err)
		return
	}
	var eligible []string
	for _, u := range reactors {
		if !u.Bot {
			eligible = append(eligible, u.ID)
		}
	}
	if len(eligible) == 0 {
		_, _ = s.ChannelMessageSend(g.ChannelID, "😔 No valid entries for the giveaway.")
		_ = EndDiscordGiveaway(g.ID)
		return
	}
	rand.Shuffle(len(eligible), func(a, b int) { eligible[a], eligible[b] = eligible[b], eligible[a] })
	count := g.WinnerCount
	if count > len(eligible) {
		count = len(eligible)
	}
	winners := eligible[:count]
	var mentions []string
	for _, w := range winners {
		mentions = append(mentions, fmt.Sprintf("<@%s>", w))
	}
	prefix := "🎉 Congratulations"
	if isReroll {
		prefix = "🔁 New winner(s)"
	}
	_, _ = s.ChannelMessageSend(g.ChannelID, fmt.Sprintf("%s %s! You won **%s**!", prefix, strings.Join(mentions, ", "), g.Prize))
	if !isReroll {
		_ = EndDiscordGiveaway(g.ID)
	}
}

func handleAddEmoteSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	name := opts["name"].StringValue()
	imageURL := opts["url"].StringValue()
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Flags: discordgo.MessageFlagsEphemeral},
	})
	resp, err := discordHTTPClient.Get(imageURL)
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to download image.")})
		return
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to read image.")})
		return
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/png"
	}
	if idx := strings.Index(contentType, ";"); idx > 0 {
		contentType = contentType[:idx]
	}
	encoded := fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(data))
	emoji, err := s.GuildEmojiCreate(i.GuildID, &discordgo.EmojiParams{Name: name, Image: encoded})
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr(fmt.Sprintf("❌ Failed to create emoji: %s", err))})
		return
	}
	msg := fmt.Sprintf("✅ Emote <:%s:%s> added!", emoji.Name, emoji.ID)
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &msg})
}

func handleIgnoreChannelSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "manager") {
		moduleDisabledReply(s, i, "manager")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	ch := opts["channel"].ChannelValue(s)
	ignored, err := ToggleDiscordIgnoredChannel(i.GuildID, ch.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Database error.")
		return
	}
	if ignored {
		respondPublic(s, i, fmt.Sprintf("🚫 <#%s> is now **ignored** — bot commands will not work there.", ch.ID))
	} else {
		respondPublic(s, i, fmt.Sprintf("✅ <#%s> is no longer ignored.", ch.ID))
	}
}

// handleModuleSlash enables or disables a bot module for the guild.
func handleModuleSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	validModules := map[string]bool{
		"moderation": true,
		"manager":    true,
		"roles":      true,
		"info":       true,
		"fun":        true,
		"tags":       true,
		"giveaway":   true,
	}
	data := i.ApplicationCommandData()
	if len(data.Options) == 0 {
		return
	}
	sub := data.Options[0]
	switch sub.Name {
	case "enable", "disable":
		subOpts := optMap(sub.Options)
		module := strings.ToLower(subOpts["module"].StringValue())
		if !validModules[module] {
			keys := make([]string, 0, len(validModules))
			for k := range validModules {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			respondEphemeral(s, i, fmt.Sprintf("❌ Unknown module. Valid modules: %s", strings.Join(keys, ", ")))
			return
		}
		enabled := sub.Name == "enable"
		if err := SetDiscordGuildModuleEnabled(i.GuildID, module, enabled); err != nil {
			respondEphemeral(s, i, "❌ Failed to update module setting.")
			return
		}
		status := "✅ **Enabled**"
		if !enabled {
			status = "❌ **Disabled**"
		}
		respondPublic(s, i, fmt.Sprintf("%s the **%s** module.", status, module))
	case "list":
		modules, err := GetDiscordGuildModules(i.GuildID)
		if err != nil {
			respondEphemeral(s, i, "❌ Failed to fetch module settings.")
			return
		}
		var lines []string
		for _, name := range []string{"moderation", "manager", "roles", "info", "fun", "tags", "giveaway"} {
			enabled := true
			if v, ok := modules[name]; ok {
				enabled = v
			}
			icon := "✅"
			if !enabled {
				icon = "❌"
			}
			lines = append(lines, fmt.Sprintf("%s **%s**", icon, name))
		}
		respondEphemeral(s, i, fmt.Sprintf("**Bot Modules:**\n%s", strings.Join(lines, "\n")))
	}
}

// ── Roles (self-assignable) ───────────────────────────────────────────────────

func handleRankSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "roles") {
		moduleDisabledReply(s, i, "roles")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	name := opts["name"].StringValue()
	rank, err := GetDiscordJoinableRankByName(i.GuildID, name)
	if err != nil || rank == nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ No joinable rank named **%s**. Use `/ranks` to see available ranks.", name))
		return
	}
	member, err := s.GuildMember(i.GuildID, i.Member.User.ID)
	if err != nil {
		respondEphemeral(s, i, "❌ Could not fetch your member info.")
		return
	}
	hasRole := false
	for _, rID := range member.Roles {
		if rID == rank.RoleID {
			hasRole = true
			break
		}
	}
	if hasRole {
		if err := s.GuildMemberRoleRemove(i.GuildID, i.Member.User.ID, rank.RoleID); err != nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ Failed to remove rank: %s", err))
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("➖ You left the **%s** rank.", rank.RoleName))
	} else {
		if err := s.GuildMemberRoleAdd(i.GuildID, i.Member.User.ID, rank.RoleID); err != nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ Failed to assign rank: %s", err))
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("➕ You joined the **%s** rank!", rank.RoleName))
	}
}

func handleRanksSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "roles") {
		moduleDisabledReply(s, i, "roles")
		return
	}
	ranks, err := GetDiscordJoinableRanks(i.GuildID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch ranks.")
		return
	}
	if len(ranks) == 0 {
		respondEphemeral(s, i, "ℹ️ No joinable ranks configured. Admins can add ranks with `/addrank`.")
		return
	}
	var lines []string
	for _, r := range ranks {
		lines = append(lines, fmt.Sprintf("• **%s** — use `/rank %s` to join", r.RoleName, r.RoleName))
	}
	respondEphemeral(s, i, fmt.Sprintf("**Joinable Ranks:**\n%s", strings.Join(lines, "\n")))
}

func handleAddRankSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "roles") {
		moduleDisabledReply(s, i, "roles")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	if err := AddDiscordJoinableRank(i.GuildID, role.ID, role.Name); err != nil {
		respondEphemeral(s, i, "❌ Failed to add rank.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("✅ **%s** is now a joinable rank. Members can use `/rank %s`.", role.Name, role.Name))
}

func handleDelRankSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "roles") {
		moduleDisabledReply(s, i, "roles")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	if err := RemoveDiscordJoinableRankByID(i.GuildID, role.ID); err != nil {
		respondEphemeral(s, i, "❌ Failed to remove rank.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("🗑️ **%s** removed from joinable ranks.", role.Name))
}

func handleRoleInfoSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "roles") {
		moduleDisabledReply(s, i, "roles")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	role := opts["role"].RoleValue(s, i.GuildID)
	// Count members with this role
	count := 0
	after := ""
	for {
		batch, err := s.GuildMembers(i.GuildID, after, 1000)
		if err != nil || len(batch) == 0 {
			break
		}
		for _, m := range batch {
			for _, rID := range m.Roles {
				if rID == role.ID {
					count++
					break
				}
			}
		}
		if len(batch) < 1000 {
			break
		}
		after = batch[len(batch)-1].User.ID
	}
	embed := &discordgo.MessageEmbed{
		Title: fmt.Sprintf("Role: %s", role.Name),
		Color: role.Color,
		Fields: []*discordgo.MessageEmbedField{
			{Name: "ID", Value: role.ID, Inline: true},
			{Name: "Color", Value: fmt.Sprintf("#%06X", role.Color), Inline: true},
			{Name: "Members", Value: strconv.Itoa(count), Inline: true},
			{Name: "Hoisted", Value: strconv.FormatBool(role.Hoist), Inline: true},
			{Name: "Mentionable", Value: strconv.FormatBool(role.Mentionable), Inline: true},
			{Name: "Managed", Value: strconv.FormatBool(role.Managed), Inline: true},
		},
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

// ── Info commands ─────────────────────────────────────────────────────────────

func handleServerInfoSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	guild, err := s.Guild(i.GuildID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch server info.")
		return
	}
	iconURL := ""
	if guild.Icon != "" {
		ext := "png"
		if strings.HasPrefix(guild.Icon, "a_") {
			ext = "gif"
		}
		iconURL = fmt.Sprintf("https://cdn.discordapp.com/icons/%s/%s.%s?size=256", guild.ID, guild.Icon, ext)
	}
	embed := &discordgo.MessageEmbed{
		Title: guild.Name,
		Color: 0x5865F2,
		Thumbnail: func() *discordgo.MessageEmbedThumbnail {
			if iconURL != "" {
				return &discordgo.MessageEmbedThumbnail{URL: iconURL}
			}
			return nil
		}(),
		Fields: []*discordgo.MessageEmbedField{
			{Name: "Owner", Value: fmt.Sprintf("<@%s>", guild.OwnerID), Inline: true},
			{Name: "Members", Value: strconv.Itoa(guild.MemberCount), Inline: true},
			{Name: "Channels", Value: strconv.Itoa(len(guild.Channels)), Inline: true},
			{Name: "Roles", Value: strconv.Itoa(len(guild.Roles)), Inline: true},
			{Name: "Boost Level", Value: strconv.Itoa(int(guild.PremiumTier)), Inline: true},
			{Name: "Boosts", Value: strconv.Itoa(guild.PremiumSubscriptionCount), Inline: true},
			{Name: "Server ID", Value: guild.ID, Inline: false},
		},
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

func handleWhoisSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	var target *discordgo.User
	var member *discordgo.Member
	if u, ok := opts["user"]; ok {
		target = u.UserValue(s)
		member, _ = s.GuildMember(i.GuildID, target.ID)
	} else {
		target = i.Member.User
		member = i.Member
	}
	avatarURL := target.AvatarURL("256")
	nickStr := "None"
	joinedStr := "Unknown"
	var roleNames []string
	if member != nil {
		if member.Nick != "" {
			nickStr = member.Nick
		}
		if member.JoinedAt != (time.Time{}) {
			joinedStr = member.JoinedAt.Format("Jan 2, 2006")
		}
		guild, _ := s.Guild(i.GuildID)
		if guild != nil {
			roleMap := map[string]string{}
			for _, r := range guild.Roles {
				roleMap[r.ID] = r.Name
			}
			for _, rID := range member.Roles {
				if name, ok := roleMap[rID]; ok {
					roleNames = append(roleNames, "@"+name)
				}
			}
		}
	}
	rolesStr := "None"
	if len(roleNames) > 0 {
		sort.Strings(roleNames)
		rolesStr = strings.Join(roleNames, ", ")
		if len(rolesStr) > 300 {
			rolesStr = rolesStr[:297] + "..."
		}
	}
	embed := &discordgo.MessageEmbed{
		Title:     fmt.Sprintf("%s#%s", target.Username, target.Discriminator),
		Thumbnail: &discordgo.MessageEmbedThumbnail{URL: avatarURL},
		Color:     0x5865F2,
		Fields: []*discordgo.MessageEmbedField{
			{Name: "ID", Value: target.ID, Inline: true},
			{Name: "Nickname", Value: nickStr, Inline: true},
			{Name: "Bot", Value: strconv.FormatBool(target.Bot), Inline: true},
			{Name: "Joined Server", Value: joinedStr, Inline: true},
			{Name: "Roles", Value: rolesStr, Inline: false},
		},
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

func handleAvatarSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	target := i.Member.User
	if u, ok := opts["user"]; ok {
		target = u.UserValue(s)
	}
	avatarURL := target.AvatarURL("1024")
	embed := &discordgo.MessageEmbed{
		Title: fmt.Sprintf("%s's avatar", target.Username),
		Image: &discordgo.MessageEmbedImage{URL: avatarURL},
		Color: 0x5865F2,
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

func handleMemberCountSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	guild, err := s.Guild(i.GuildID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch server info.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("👥 **%s** has **%d** members.", guild.Name, guild.MemberCount))
}

func handlePingSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	start := time.Now()
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Content: "🏓 Pinging..."},
	})
	elapsed := time.Since(start)
	content := fmt.Sprintf("🏓 Pong! Response time: **%dms**", elapsed.Milliseconds())
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &content})
}

func handleEmotesSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	search := ""
	if q, ok := opts["search"]; ok {
		search = strings.ToLower(q.StringValue())
	}
	guild, err := s.Guild(i.GuildID)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch emotes.")
		return
	}
	var emotes []string
	for _, e := range guild.Emojis {
		if search == "" || strings.Contains(strings.ToLower(e.Name), search) {
			if e.Animated {
				emotes = append(emotes, fmt.Sprintf("<a:%s:%s>", e.Name, e.ID))
			} else {
				emotes = append(emotes, fmt.Sprintf("<:%s:%s>", e.Name, e.ID))
			}
		}
	}
	if len(emotes) == 0 {
		respondEphemeral(s, i, "ℹ️ No custom emotes found.")
		return
	}
	content := fmt.Sprintf("**Custom Emotes (%d):** %s", len(emotes), strings.Join(emotes, " "))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}
	respondPublic(s, i, content)
}

func handleInviteInfoSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	code := opts["code"].StringValue()
	// Strip URL if pasted as full URL
	code = strings.TrimPrefix(code, "https://discord.gg/")
	code = strings.TrimPrefix(code, "http://discord.gg/")
	code = strings.TrimPrefix(code, "discord.gg/")
	invite, err := s.InviteWithCounts(code)
	if err != nil {
		respondEphemeral(s, i, fmt.Sprintf("❌ Invalid or expired invite code: %s", code))
		return
	}
	guildName := "Unknown"
	guildID := ""
	if invite.Guild != nil {
		guildName = invite.Guild.Name
		guildID = invite.Guild.ID
	}
	inviterName := "Unknown"
	if invite.Inviter != nil {
		inviterName = invite.Inviter.Username
	}
	embed := &discordgo.MessageEmbed{
		Title: fmt.Sprintf("Invite: %s", code),
		Color: 0x5865F2,
		Fields: []*discordgo.MessageEmbedField{
			{Name: "Server", Value: guildName, Inline: true},
			{Name: "Server ID", Value: guildID, Inline: true},
			{Name: "Channel", Value: fmt.Sprintf("#%s", invite.Channel.Name), Inline: true},
			{Name: "Inviter", Value: inviterName, Inline: true},
			{Name: "Uses", Value: strconv.Itoa(invite.Uses), Inline: true},
			{Name: "Max Uses", Value: func() string {
				if invite.MaxUses == 0 {
					return "∞"
				}
				return strconv.Itoa(invite.MaxUses)
			}(), Inline: true},
			{Name: "Online", Value: strconv.Itoa(invite.ApproximatePresenceCount), Inline: true},
			{Name: "Total", Value: strconv.Itoa(invite.ApproximateMemberCount), Inline: true},
		},
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

func handleAFKSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	status := "AFK"
	if st, ok := opts["status"]; ok {
		status = st.StringValue()
	}
	if err := SetDiscordAFK(i.GuildID, i.Member.User.ID, status); err != nil {
		respondEphemeral(s, i, "❌ Failed to set AFK status.")
		return
	}
	respondPublic(s, i, fmt.Sprintf("💤 **%s** is now AFK: %s", i.Member.User.Username, status))
}

func handleHighlightsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	data := i.ApplicationCommandData()
	if len(data.Options) == 0 {
		return
	}
	sub := data.Options[0]
	subOpts := optMap(sub.Options)
	switch sub.Name {
	case "add":
		phrase := subOpts["phrase"].StringValue()
		if err := AddDiscordHighlight(i.GuildID, i.Member.User.ID, phrase); err != nil {
			respondEphemeral(s, i, "❌ Failed to add highlight.")
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("✅ You will now be notified when \"**%s**\" is mentioned.", phrase))
	case "remove":
		phrase := subOpts["phrase"].StringValue()
		if err := RemoveDiscordHighlight(i.GuildID, i.Member.User.ID, phrase); err != nil {
			respondEphemeral(s, i, "❌ Failed to remove highlight.")
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("✅ Removed highlight: \"**%s**\".", phrase))
	case "list":
		phrases, err := GetDiscordHighlightsForUser(i.GuildID, i.Member.User.ID)
		if err != nil || len(phrases) == 0 {
			respondEphemeral(s, i, "ℹ️ You have no highlights set. Use `/highlights add` to add one.")
			return
		}
		var lines []string
		for _, p := range phrases {
			lines = append(lines, fmt.Sprintf("• %s", p))
		}
		respondEphemeral(s, i, fmt.Sprintf("**Your Highlights:**\n%s", strings.Join(lines, "\n")))
	}
}

func handleRemindMeSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "info") {
		moduleDisabledReply(s, i, "info")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	durStr := opts["time"].StringValue()
	reminder := opts["reminder"].StringValue()
	dur, err := parseDuration(durStr)
	if err != nil {
		respondEphemeral(s, i, "❌ Invalid time. Use e.g. `10m`, `2h`, `1d`.")
		return
	}
	remindAt := time.Now().Add(dur)
	if err := CreateDiscordReminder(i.Member.User.ID, i.ChannelID, reminder, remindAt); err != nil {
		respondEphemeral(s, i, "❌ Failed to save reminder.")
		return
	}
	respondEphemeral(s, i, fmt.Sprintf("⏰ Reminder set! I'll remind you in **%s**: %s", durStr, reminder))
}

// ── Fun commands ──────────────────────────────────────────────────────────────

func handlePollSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	question := opts["question"].StringValue()
	var options []string
	for _, name := range []string{"option1", "option2", "option3", "option4"} {
		if o, ok := opts[name]; ok {
			options = append(options, o.StringValue())
		}
	}
	if len(options) < 2 {
		respondEphemeral(s, i, "❌ You need at least 2 options.")
		return
	}
	emojis := []string{"🇦", "🇧", "🇨", "🇩"}
	description := ""
	for idx, opt := range options {
		description += fmt.Sprintf("%s %s\n", emojis[idx], opt)
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})
	embed := &discordgo.MessageEmbed{
		Title:       "📊 " + question,
		Description: description,
		Color:       0x5865F2,
		Footer:      &discordgo.MessageEmbedFooter{Text: fmt.Sprintf("Poll by %s", i.Member.User.Username)},
	}
	msg, err := s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
	if err != nil || msg == nil {
		return
	}
	for idx := range options {
		_ = s.MessageReactionAdd(i.ChannelID, msg.ID, emojis[idx])
	}
}

func handleFlipSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	result := "Heads 🪙"
	if rand.Intn(2) == 1 {
		result = "Tails 🪙"
	}
	respondPublic(s, i, fmt.Sprintf("🪙 **%s**!", result))
}

func handleRollSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	diceStr := "1d6"
	if d, ok := opts["dice"]; ok {
		diceStr = strings.ToLower(d.StringValue())
	}
	// Parse NdN format (e.g. "2d6", "d20", "1d100")
	diceStr = strings.TrimPrefix(diceStr, "d")
	parts := strings.SplitN(diceStr, "d", 2)
	count := 1
	sides := 6
	var err error
	if len(parts) == 2 {
		count, err = strconv.Atoi(parts[0])
		if err != nil || count < 1 {
			count = 1
		}
		sides, err = strconv.Atoi(parts[1])
		if err != nil || sides < 2 {
			sides = 6
		}
	} else {
		sides, err = strconv.Atoi(parts[0])
		if err != nil || sides < 2 {
			sides = 6
		}
	}
	if count > 20 {
		count = 20
	}
	if sides > 1000 {
		sides = 1000
	}
	var results []string
	total := 0
	for n := 0; n < count; n++ {
		r := rand.Intn(sides) + 1
		total += r
		results = append(results, strconv.Itoa(r))
	}
	if count == 1 {
		respondPublic(s, i, fmt.Sprintf("🎲 Rolled **1d%d**: **%d**", sides, total))
	} else {
		respondPublic(s, i, fmt.Sprintf("🎲 Rolled **%dd%d**: %s = **%d**", count, sides, strings.Join(results, " + "), total))
	}
}

func handleRPSSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	playerChoice := strings.ToLower(opts["choice"].StringValue())
	choices := []string{"rock", "paper", "scissors"}
	botChoice := choices[rand.Intn(3)]
	emojis := map[string]string{"rock": "🪨", "paper": "📄", "scissors": "✂️"}
	var result string
	if playerChoice == botChoice {
		result = "It's a **tie**! 🤝"
	} else if (playerChoice == "rock" && botChoice == "scissors") ||
		(playerChoice == "paper" && botChoice == "rock") ||
		(playerChoice == "scissors" && botChoice == "paper") {
		result = "You **win**! 🎉"
	} else {
		result = "You **lose**! 😔"
	}
	respondPublic(s, i, fmt.Sprintf("You: %s%s | Bot: %s%s\n%s",
		emojis[playerChoice], playerChoice, emojis[botChoice], botChoice, result))
}

func handleDadJokeSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})
	req, _ := http.NewRequest("GET", "https://icanhazdadjoke.com/", nil)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "AxyraBot/1.0")
	resp, err := discordHTTPClient.Do(req)
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to fetch a dad joke.")})
		return
	}
	defer resp.Body.Close()
	var result struct {
		Joke string `json:"joke"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.Joke == "" {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to parse dad joke.")})
		return
	}
	content := fmt.Sprintf("😄 %s", result.Joke)
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &content})
}

func handleCatSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	fetchAnimalImage(s, i, "https://api.thecatapi.com/v1/images/search", func(body []byte) string {
		var results []struct {
			URL string `json:"url"`
		}
		if err := json.Unmarshal(body, &results); err != nil || len(results) == 0 {
			return ""
		}
		return results[0].URL
	}, "🐱 Meow!")
}

func handleDogSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	fetchAnimalImage(s, i, "https://dog.ceo/api/breeds/image/random", func(body []byte) string {
		var result struct {
			Message string `json:"message"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return ""
		}
		return result.Message
	}, "🐶 Woof!")
}

func handlePugSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	fetchAnimalImage(s, i, "https://dog.ceo/api/breed/pug/images/random", func(body []byte) string {
		var result struct {
			Message string `json:"message"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return ""
		}
		return result.Message
	}, "🐾 Pug time!")
}

// fetchAnimalImage is a shared helper for cat/dog/pug commands.
func fetchAnimalImage(s *discordgo.Session, i *discordgo.InteractionCreate, apiURL string, parseURL func([]byte) string, caption string) {
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})
	resp, err := discordHTTPClient.Get(apiURL)
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ API request failed.")})
		return
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to read response.")})
		return
	}
	imageURL := parseURL(body)
	if imageURL == "" {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ No image found.")})
		return
	}
	embed := &discordgo.MessageEmbed{
		Description: caption,
		Image:       &discordgo.MessageEmbedImage{URL: imageURL},
		Color:       0x57F287,
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
}

func handleColorSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	hexStr := strings.TrimPrefix(opts["hex"].StringValue(), "#")
	n, err := strconv.ParseInt(hexStr, 16, 32)
	if err != nil {
		respondEphemeral(s, i, "❌ Invalid hex color. Use format `FF5733` or `#FF5733`.")
		return
	}
	color := int(n)
	embed := &discordgo.MessageEmbed{
		Title:       fmt.Sprintf("Color: #%06X", color),
		Description: fmt.Sprintf("RGB: (%d, %d, %d)", (color>>16)&0xFF, (color>>8)&0xFF, color&0xFF),
		Color:       color,
		Thumbnail:   &discordgo.MessageEmbedThumbnail{URL: fmt.Sprintf("https://singlecolorimage.com/get/%06x/64x64", color)},
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

func handleRandomColorSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	color := rand.Intn(0xFFFFFF + 1)
	embed := &discordgo.MessageEmbed{
		Title:       fmt.Sprintf("Random Color: #%06X", color),
		Description: fmt.Sprintf("RGB: (%d, %d, %d)", (color>>16)&0xFF, (color>>8)&0xFF, color&0xFF),
		Color:       color,
		Thumbnail:   &discordgo.MessageEmbedThumbnail{URL: fmt.Sprintf("https://singlecolorimage.com/get/%06x/64x64", color)},
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{Embeds: []*discordgo.MessageEmbed{embed}},
	})
}

func handlePokemonSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	name := strings.ToLower(strings.TrimSpace(opts["name"].StringValue()))
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})
	resp, err := discordHTTPClient.Get("https://pokeapi.co/api/v2/pokemon/" + name)
	if err != nil || resp.StatusCode != 200 {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr(fmt.Sprintf("❌ Pokémon **%s** not found.", name))})
		return
	}
	defer resp.Body.Close()
	var poke struct {
		Name    string `json:"name"`
		Height  int    `json:"height"`
		Weight  int    `json:"weight"`
		BaseXP  int    `json:"base_experience"`
		Sprites struct {
			Front string `json:"front_default"`
		} `json:"sprites"`
		Types []struct {
			Type struct {
				Name string `json:"name"`
			} `json:"type"`
		} `json:"types"`
		Stats []struct {
			Base int `json:"base_stat"`
			Stat struct {
				Name string `json:"name"`
			} `json:"stat"`
		} `json:"stats"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&poke); err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to parse Pokémon data.")})
		return
	}
	var typeNames []string
	for _, t := range poke.Types {
		typeNames = append(typeNames, strings.Title(t.Type.Name))
	}
	var statsLines []string
	for _, st := range poke.Stats {
		statsLines = append(statsLines, fmt.Sprintf("**%s**: %d", strings.Title(st.Stat.Name), st.Base))
	}
	embed := &discordgo.MessageEmbed{
		Title:     strings.Title(poke.Name),
		Color:     0xFFCC00,
		Thumbnail: &discordgo.MessageEmbedThumbnail{URL: poke.Sprites.Front},
		Fields: []*discordgo.MessageEmbedField{
			{Name: "Type", Value: strings.Join(typeNames, ", "), Inline: true},
			{Name: "Height", Value: fmt.Sprintf("%.1fm", float64(poke.Height)/10), Inline: true},
			{Name: "Weight", Value: fmt.Sprintf("%.1fkg", float64(poke.Weight)/10), Inline: true},
			{Name: "Base XP", Value: strconv.Itoa(poke.BaseXP), Inline: true},
			{Name: "Base Stats", Value: strings.Join(statsLines, "\n"), Inline: false},
		},
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
}

func handleGitHubSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	repoStr := opts["repo"].StringValue()
	// Accept "owner/repo" or just "repo" (for repos without owner specified)
	if !strings.Contains(repoStr, "/") {
		respondEphemeral(s, i, "❌ Please specify in `owner/repo` format, e.g. `torvalds/linux`.")
		return
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})
	req, _ := http.NewRequest("GET", "https://api.github.com/repos/"+repoStr, nil)
	req.Header.Set("User-Agent", "AxyraBot/1.0")
	resp, err := discordHTTPClient.Do(req)
	if err != nil || resp.StatusCode != 200 {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr(fmt.Sprintf("❌ Repository **%s** not found.", repoStr))})
		return
	}
	defer resp.Body.Close()
	var repo struct {
		Name        string `json:"name"`
		FullName    string `json:"full_name"`
		Description string `json:"description"`
		Stars       int    `json:"stargazers_count"`
		Forks       int    `json:"forks_count"`
		Watchers    int    `json:"watchers_count"`
		Language    string `json:"language"`
		HTMLURL     string `json:"html_url"`
		OpenIssues  int    `json:"open_issues_count"`
		Private     bool   `json:"private"`
		Owner       struct {
			AvatarURL string `json:"avatar_url"`
		} `json:"owner"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&repo); err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to parse repository data.")})
		return
	}
	desc := repo.Description
	if desc == "" {
		desc = "*No description*"
	}
	lang := repo.Language
	if lang == "" {
		lang = "Unknown"
	}
	embed := &discordgo.MessageEmbed{
		Title:       repo.FullName,
		URL:         repo.HTMLURL,
		Description: desc,
		Color:       0x24292E,
		Thumbnail:   &discordgo.MessageEmbedThumbnail{URL: repo.Owner.AvatarURL},
		Fields: []*discordgo.MessageEmbedField{
			{Name: "⭐ Stars", Value: strconv.Itoa(repo.Stars), Inline: true},
			{Name: "🍴 Forks", Value: strconv.Itoa(repo.Forks), Inline: true},
			{Name: "👁️ Watchers", Value: strconv.Itoa(repo.Watchers), Inline: true},
			{Name: "🐛 Open Issues", Value: strconv.Itoa(repo.OpenIssues), Inline: true},
			{Name: "💻 Language", Value: lang, Inline: true},
			{Name: "🔒 Private", Value: strconv.FormatBool(repo.Private), Inline: true},
		},
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
}

func handleSpaceSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "fun") {
		moduleDisabledReply(s, i, "fun")
		return
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})
	resp, err := discordHTTPClient.Get("https://api.wheretheiss.at/v1/satellites/25544")
	if err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to fetch ISS data.")})
		return
	}
	defer resp.Body.Close()
	var iss struct {
		Latitude   float64 `json:"latitude"`
		Longitude  float64 `json:"longitude"`
		Altitude   float64 `json:"altitude"`
		Velocity   float64 `json:"velocity"`
		Visibility string  `json:"visibility"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&iss); err != nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: strPtr("❌ Failed to parse ISS data.")})
		return
	}
	embed := &discordgo.MessageEmbed{
		Title: "🛸 International Space Station",
		Color: 0x0078D4,
		Fields: []*discordgo.MessageEmbedField{
			{Name: "📍 Latitude", Value: fmt.Sprintf("%.4f°", iss.Latitude), Inline: true},
			{Name: "📍 Longitude", Value: fmt.Sprintf("%.4f°", iss.Longitude), Inline: true},
			{Name: "🏔️ Altitude", Value: fmt.Sprintf("%.2f km", iss.Altitude), Inline: true},
			{Name: "🚀 Velocity", Value: fmt.Sprintf("%.2f km/h", iss.Velocity), Inline: true},
			{Name: "☀️ Visibility", Value: iss.Visibility, Inline: true},
			{Name: "🗺️ Map", Value: fmt.Sprintf("[View on map](https://www.google.com/maps?q=%.4f,%.4f)", iss.Latitude, iss.Longitude), Inline: false},
		},
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
}

// ── Tags ──────────────────────────────────────────────────────────────────────

func handleTagSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "tags") {
		moduleDisabledReply(s, i, "tags")
		return
	}
	data := i.ApplicationCommandData()
	if len(data.Options) == 0 {
		return
	}
	sub := data.Options[0]
	subOpts := optMap(sub.Options)
	switch sub.Name {
	case "get":
		name := subOpts["name"].StringValue()
		tag, err := GetDiscordTag(i.GuildID, name)
		if err != nil || tag == nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ No tag named **%s**.", name))
			return
		}
		respondPublic(s, i, tag.Content)
	case "create":
		name := subOpts["name"].StringValue()
		content := subOpts["content"].StringValue()
		if err := CreateDiscordTag(i.GuildID, name, content, i.Member.User.ID); err != nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ Tag **%s** already exists or could not be created.", name))
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("✅ Tag **%s** created.", name))
	case "edit":
		name := subOpts["name"].StringValue()
		content := subOpts["content"].StringValue()
		if err := UpdateDiscordTag(i.GuildID, name, content); err != nil {
			respondEphemeral(s, i, fmt.Sprintf("❌ Tag **%s** not found.", name))
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("✅ Tag **%s** updated.", name))
	case "delete":
		name := subOpts["name"].StringValue()
		if err := DeleteDiscordTag(i.GuildID, name); err != nil {
			respondEphemeral(s, i, "❌ Failed to delete tag.")
			return
		}
		respondEphemeral(s, i, fmt.Sprintf("🗑️ Tag **%s** deleted.", name))
	}
}

func handleTagsSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if !isGuildModuleEnabled(i.GuildID, "tags") {
		moduleDisabledReply(s, i, "tags")
		return
	}
	opts := optMap(i.ApplicationCommandData().Options)
	search := ""
	if q, ok := opts["search"]; ok {
		search = q.StringValue()
	}
	tags, err := ListDiscordTags(i.GuildID, search)
	if err != nil {
		respondEphemeral(s, i, "❌ Failed to fetch tags.")
		return
	}
	if len(tags) == 0 {
		respondEphemeral(s, i, "ℹ️ No tags found. Create one with `/tag create`.")
		return
	}
	var names []string
	for _, t := range tags {
		names = append(names, t.Name)
	}
	content := fmt.Sprintf("**Tags (%d):** %s", len(names), strings.Join(names, ", "))
	if len(content) > 2000 {
		content = content[:1997] + "..."
	}
	respondEphemeral(s, i, content)
}

// ── Background schedulers ─────────────────────────────────────────────────────

// StartDiscordTempRoleScheduler runs every minute and removes expired temp roles.
func StartDiscordTempRoleScheduler() {
	for {
		time.Sleep(time.Minute)
		if discordSession == nil {
			continue
		}
		expired, err := GetExpiredDiscordTempRoles()
		if err != nil {
			log.Println("[Discord] temp role scheduler error:", err)
			continue
		}
		for _, tr := range expired {
			if err := discordSession.GuildMemberRoleRemove(tr.GuildID, tr.UserID, tr.RoleID); err != nil {
				log.Println("[Discord] failed to remove temp role:", err)
			}
			_ = DeleteDiscordTempRole(tr.ID)
		}
	}
}

// StartDiscordReminderScheduler runs every minute and delivers due reminders.
func StartDiscordReminderScheduler() {
	for {
		time.Sleep(time.Minute)
		if discordSession == nil {
			continue
		}
		due, err := GetDueDiscordReminders()
		if err != nil {
			log.Println("[Discord] reminder scheduler error:", err)
			continue
		}
		for _, r := range due {
			ch, err := discordSession.UserChannelCreate(r.UserID)
			if err != nil {
				// Fall back to original channel if DM fails
				_, _ = discordSession.ChannelMessageSend(r.ChannelID, fmt.Sprintf("<@%s> ⏰ Reminder: %s", r.UserID, r.Reminder))
			} else {
				_, _ = discordSession.ChannelMessageSend(ch.ID, fmt.Sprintf("⏰ **Reminder:** %s", r.Reminder))
			}
			_ = DeleteDiscordReminder(r.ID)
		}
	}
}

// StartDiscordGiveawayScheduler runs every minute and ends giveaways that have expired.
func StartDiscordGiveawayScheduler() {
	for {
		time.Sleep(time.Minute)
		if discordSession == nil {
			continue
		}
		active, err := GetActiveDiscordGiveaways()
		if err != nil {
			log.Println("[Discord] giveaway scheduler error:", err)
			continue
		}
		for _, g := range active {
			resolveGiveaway(discordSession, g, false)
		}
	}
}

// ── Extended message handler (AFK + highlights) ───────────────────────────────

// discordExtendedMessageHandler handles AFK checking and keyword highlights
// in addition to the regular command handler.
func discordExtendedMessageHandler(s *discordgo.Session, m *discordgo.MessageCreate) {
	if m.Author == nil || m.Author.Bot || m.GuildID == "" {
		return
	}

	// Check if the author is AFK — if so, clear their status.
	if afkStatus, isAFK, _ := GetDiscordAFK(m.GuildID, m.Author.ID); isAFK {
		_ = ClearDiscordAFK(m.GuildID, m.Author.ID)
		_, _ = s.ChannelMessageSendReply(m.ChannelID,
			fmt.Sprintf("👋 Welcome back, **%s**! Your AFK status has been cleared (was: %s).", m.Author.Username, afkStatus),
			m.Reference())
	}

	// Notify users whose highlighted phrases appear in this message.
	if isGuildModuleEnabled(m.GuildID, "info") {
		highlights, err := GetDiscordHighlightsInGuild(m.GuildID)
		if err == nil {
			msgLower := strings.ToLower(m.Content)
			for userID, phrases := range highlights {
				if userID == m.Author.ID {
					continue // don't notify the message author about their own highlights
				}
				for _, phrase := range phrases {
					if strings.Contains(msgLower, phrase) {
						ch, err := s.UserChannelCreate(userID)
						if err == nil {
							_, _ = s.ChannelMessageSend(ch.ID, fmt.Sprintf(
								"🔔 Your highlight **\"%s\"** was mentioned by **%s** in <#%s>:\n> %s",
								phrase, m.Author.Username, m.ChannelID, m.Content))
						}
						break // only notify once per user per message
					}
				}
			}
		}
	}

	// Notify in-channel if a @mentioned user is AFK.
	for _, mention := range m.Mentions {
		if mention.Bot || mention.ID == m.Author.ID {
			continue
		}
		if afkStatus, isAFK, _ := GetDiscordAFK(m.GuildID, mention.ID); isAFK {
			_, _ = s.ChannelMessageSend(m.ChannelID,
				fmt.Sprintf("💤 **%s** is currently AFK: %s", mention.Username, afkStatus))
		}
	}
}

// discordGuildMemberAddHandler re-applies persistent roles when a member rejoins.
func discordGuildMemberAddHandler(s *discordgo.Session, e *discordgo.GuildMemberAdd) {
	if e.User == nil {
		return
	}

	// 1. Re-apply any persistent roles (e.g. from temprole).
	roleIDs, err := GetDiscordRolePersist(e.GuildID, e.User.ID)
	if err == nil {
		for _, roleID := range roleIDs {
			if err := s.GuildMemberRoleAdd(e.GuildID, e.User.ID, roleID); err != nil {
				log.Printf("[Discord] failed to re-apply persistent role %s to %s: %v", roleID, e.User.ID, err)
			}
		}
	}

	// 2. Apply welcome settings: auto-roles + welcome message.
	ws, err := GetDiscordWelcomeSettings(e.GuildID)
	if err != nil {
		// No settings configured — nothing to do.
		return
	}

	// Auto-assign roles.
	for _, rid := range strings.Split(ws.AutoRoleIDs, ",") {
		rid = strings.TrimSpace(rid)
		if rid == "" {
			continue
		}
		if err := s.GuildMemberRoleAdd(e.GuildID, e.User.ID, rid); err != nil {
			log.Printf("[Discord] failed to assign auto-role %s to %s: %v", rid, e.User.ID, err)
		}
	}

	// Send welcome message.
	if ws.WelcomeChannelID != "" && ws.WelcomeMessage != "" {
		// Resolve server name for $(server) variable.
		serverName := e.GuildID
		if g, err := s.State.Guild(e.GuildID); err == nil {
			serverName = g.Name
		} else if g, err := s.Guild(e.GuildID); err == nil {
			serverName = g.Name
		}
		msg := ws.WelcomeMessage
		msg = strings.ReplaceAll(msg, "$(user)", "<@"+e.User.ID+">")
		msg = strings.ReplaceAll(msg, "$(username)", e.User.Username)
		msg = strings.ReplaceAll(msg, "$(server)", serverName)
		if _, err := s.ChannelMessageSend(ws.WelcomeChannelID, msg); err != nil {
			log.Printf("[Discord] failed to send welcome message: %v", err)
		}
	}
}

// discordGuildMemberRemoveHandler sends a leave message to the configured
// channel when a member leaves the server.
func discordGuildMemberRemoveHandler(s *discordgo.Session, e *discordgo.GuildMemberRemove) {
	if e.User == nil {
		return
	}
	ws, err := GetDiscordWelcomeSettings(e.GuildID)
	if err != nil || ws.LeaveChannelID == "" {
		return
	}
	msg := fmt.Sprintf("**%s** has left the server", e.User.Username)
	if _, err := s.ChannelMessageSend(ws.LeaveChannelID, msg); err != nil {
		log.Printf("[Discord] failed to send leave message: %v", err)
	}
}

// ── Ticket system ─────────────────────────────────────────────────────────────

// sendTicketPanel posts (or re-posts) the ticket panel embed+button to the
// configured channel. Returns the message ID.
func sendTicketPanel(s *discordgo.Session, cfg *DiscordTicketConfig) (string, error) {
	title := cfg.PanelTitle
	if title == "" {
		title = "Support Tickets"
	}
	body := cfg.PanelBody
	if body == "" {
		body = "Click the button below to open a support ticket."
	}
	label := cfg.ButtonLabel
	if label == "" {
		label = "🎫 Open Ticket"
	}

	embed := &discordgo.MessageEmbed{
		Title:       title,
		Description: body,
		Color:       0x5865F2, // Discord blurple
	}
	btn := discordgo.Button{
		Label:    label,
		Style:    discordgo.PrimaryButton,
		CustomID: "ticket_create",
	}
	data := &discordgo.MessageSend{
		Embeds: []*discordgo.MessageEmbed{embed},
		Components: []discordgo.MessageComponent{
			discordgo.ActionsRow{Components: []discordgo.MessageComponent{btn}},
		},
	}

	msg, err := s.ChannelMessageSendComplex(cfg.PanelChannelID, data)
	if err != nil {
		return "", err
	}
	// Persist the new message ID
	_ = UpdateTicketPanelMessageID(cfg.GuildID, msg.ID)
	return msg.ID, nil
}

// handleTicketCreate handles the "Open Ticket" button interaction.
func handleTicketCreate(s *discordgo.Session, i *discordgo.InteractionCreate) {
	// Acknowledge immediately with an ephemeral deferred response.
	if err := s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Flags: discordgo.MessageFlagsEphemeral,
		},
	}); err != nil {
		log.Println("[tickets] defer respond:", err)
		return
	}

	guildID := i.GuildID
	user := i.Member.User
	if user == nil {
		return
	}

	cfg, err := GetTicketConfig(guildID)
	if err != nil || cfg == nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr("❌ Ticket system is not configured for this server."),
		})
		return
	}

	// Check if user already has an open ticket.
	has, _ := HasOpenTicket(guildID, user.ID)
	if has {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr("❌ You already have an open ticket. Please use your existing ticket channel."),
		})
		return
	}

	// Determine the next ticket number.
	ticketNum, err := NextTicketNumber(guildID)
	if err != nil {
		ticketNum = 1
	}
	channelName := fmt.Sprintf("ticket-%04d", ticketNum)

	// Build permission overwrites:
	// @everyone: deny ViewChannel
	// ticket opener: allow ViewChannel + SendMessages + ReadMessageHistory
	// each support role: allow ViewChannel + SendMessages + ReadMessageHistory + ManageMessages
	// bot (self): allow all
	perms := []*discordgo.PermissionOverwrite{
		{
			ID:   guildID, // @everyone role
			Type: discordgo.PermissionOverwriteTypeRole,
			Deny: discordgo.PermissionViewChannel,
		},
		{
			ID:    user.ID,
			Type:  discordgo.PermissionOverwriteTypeMember,
			Allow: discordgo.PermissionViewChannel | discordgo.PermissionSendMessages | discordgo.PermissionReadMessageHistory,
		},
	}
	for _, roleID := range cfg.SupportRoleIDs {
		if roleID == "" {
			continue
		}
		perms = append(perms, &discordgo.PermissionOverwrite{
			ID:    roleID,
			Type:  discordgo.PermissionOverwriteTypeRole,
			Allow: discordgo.PermissionViewChannel | discordgo.PermissionSendMessages | discordgo.PermissionReadMessageHistory | discordgo.PermissionManageMessages,
		})
	}
	// Bot self
	self, err := s.User("@me")
	if err == nil {
		perms = append(perms, &discordgo.PermissionOverwrite{
			ID:    self.ID,
			Type:  discordgo.PermissionOverwriteTypeMember,
			Allow: discordgo.PermissionAllText,
		})
	}

	createData := &discordgo.GuildChannelCreateData{
		Name:                 channelName,
		Type:                 discordgo.ChannelTypeGuildText,
		Topic:                fmt.Sprintf("Support ticket for %s", user.Username),
		PermissionOverwrites: perms,
	}
	if cfg.CategoryID != "" {
		createData.ParentID = cfg.CategoryID
	}

	ch, err := s.GuildChannelCreateComplex(guildID, *createData)
	if err != nil {
		log.Println("[tickets] create channel:", err)
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr("❌ Failed to create ticket channel. Please contact an admin."),
		})
		return
	}

	// Persist ticket to DB.
	_ = CreateTicketRecord(guildID, ch.ID, user.ID, user.Username, ticketNum)

	// Send welcome message in new channel.
	closeBtn := discordgo.Button{
		Label:    "🔒 Close Ticket",
		Style:    discordgo.DangerButton,
		CustomID: "ticket_close",
	}
	welcomeEmbed := &discordgo.MessageEmbed{
		Title:       fmt.Sprintf("🎫 Ticket #%04d", ticketNum),
		Description: fmt.Sprintf("Welcome <@%s>! Support staff will be with you shortly.\n\nDescribe your issue in this channel.", user.ID),
		Color:       0x57F287, // green
	}
	_, _ = s.ChannelMessageSendComplex(ch.ID, &discordgo.MessageSend{
		Embeds: []*discordgo.MessageEmbed{welcomeEmbed},
		Components: []discordgo.MessageComponent{
			discordgo.ActionsRow{Components: []discordgo.MessageComponent{closeBtn}},
		},
	})

	// Log if configured.
	if cfg.LogChannelID != "" {
		logEmbed := &discordgo.MessageEmbed{
			Title:       "🎫 Ticket Opened",
			Description: fmt.Sprintf("<@%s> opened <#%s> (Ticket #%04d)", user.ID, ch.ID, ticketNum),
			Color:       0x57F287,
		}
		_, _ = s.ChannelMessageSendEmbed(cfg.LogChannelID, logEmbed)
	}

	// Edit the ephemeral reply.
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
		Content: strPtr(fmt.Sprintf("✅ Your ticket has been created: <#%s>", ch.ID)),
	})
}

// handleTicketClose handles the "Close Ticket" button interaction.
func handleTicketClose(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if err := s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Flags: discordgo.MessageFlagsEphemeral,
		},
	}); err != nil {
		log.Println("[tickets] close defer respond:", err)
		return
	}

	channelID := i.ChannelID
	guildID := i.GuildID
	closer := i.Member.User
	if closer == nil {
		return
	}

	ticket, err := GetTicketByChannel(channelID)
	if err != nil || ticket == nil {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr("❌ This channel is not a ticket."),
		})
		return
	}
	if ticket.Status != "open" {
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr("❌ This ticket is already closed."),
		})
		return
	}

	_ = CloseTicketRecord(channelID, closer.ID, closer.Username)

	cfg, _ := GetTicketConfig(guildID)

	// Log if configured.
	if cfg != nil && cfg.LogChannelID != "" {
		logEmbed := &discordgo.MessageEmbed{
			Title:       "🔒 Ticket Closed",
			Description: fmt.Sprintf("<@%s> closed <#%s> (Ticket #%04d, opened by <@%s>)", closer.ID, channelID, ticket.TicketNumber, ticket.UserID),
			Color:       0xED4245, // red
		}
		_, _ = s.ChannelMessageSendEmbed(cfg.LogChannelID, logEmbed)
	}

	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
		Content: strPtr("🔒 Ticket closed. This channel will be deleted in 5 seconds."),
	})

	// Delete channel after a short delay.
	go func() {
		time.Sleep(5 * time.Second)
		if _, err := s.ChannelDelete(channelID); err != nil {
			log.Println("[tickets] delete channel:", err)
		}
	}()
}
