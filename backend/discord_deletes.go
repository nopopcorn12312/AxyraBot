package main

// Deleted-message logging for the Discord mod log.
//
// Discord's audit log says who deleted someone's message, but not what the
// message said, and Discord doesn't keep the text once it's gone. So the bot
// remembers recent server messages itself, then pairs each deletion with the
// audit log entry for it:
//
//   - A moderator deletes a message: the gateway sends MESSAGE_DELETE (with
//     only the message ID) and the audit log gets an entry naming the
//     moderator, the author and the channel. The entry is matched to the most
//     recent deleted message from that author in that channel.
//   - AxyraBot deletes a message: the code that deletes it records why first
//     (noteDiscordBotDeletion), so the log shows AxyraBot and that reason.
//   - People deleting their own messages create no audit entry and aren't
//     logged, matching how the mod log behaved before.

import (
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/bwmarrin/discordgo"
)

const (
	discordMessageCacheMax   = 20000
	discordMessageCacheTTL   = 24 * time.Hour
	discordDeleteMatchWindow = 15 * time.Second
	discordAuditMatchWait    = 2 * time.Second
	discordLoggedTextMax     = 1500
)

type discordCachedMessage struct {
	GuildID     string
	ChannelID   string
	AuthorID    string
	Content     string
	Attachments int
	At          time.Time
}

type discordDeletedMessage struct {
	ID        string
	Message   discordCachedMessage
	DeletedAt time.Time
	matched   bool
}

type discordBotDeletion struct {
	reason  string
	quiet   bool // don't log at all (e.g. honeypot clean-up, which logs the ban instead)
	expires time.Time
}

type discordDeleteTracker struct {
	mu           sync.Mutex
	messages     map[string]discordCachedMessage
	order        []string // message IDs, oldest first, for pruning
	deleted      []discordDeletedMessage
	botDeletions map[string]discordBotDeletion
}

var discordDeletes = newDiscordDeleteTracker()

func newDiscordDeleteTracker() *discordDeleteTracker {
	return &discordDeleteTracker{messages: map[string]discordCachedMessage{}, botDeletions: map[string]discordBotDeletion{}}
}

// remember stores a server message so its text is available if it's deleted.
func (t *discordDeleteTracker) remember(id string, msg discordCachedMessage) {
	if id == "" || msg.GuildID == "" {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if _, exists := t.messages[id]; !exists {
		t.order = append(t.order, id)
	}
	t.messages[id] = msg
	cutoff := msg.At.Add(-discordMessageCacheTTL)
	drop := 0
	for drop < len(t.order) {
		old, ok := t.messages[t.order[drop]]
		if ok && len(t.order)-drop <= discordMessageCacheMax && old.At.After(cutoff) {
			break
		}
		delete(t.messages, t.order[drop])
		drop++
	}
	t.order = t.order[drop:]
}

// edit updates the remembered text after a message is edited.
func (t *discordDeleteTracker) edit(id, content string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if msg, ok := t.messages[id]; ok {
		msg.Content = content
		t.messages[id] = msg
	}
}

// noteBotDeletion records that AxyraBot is about to delete a message and why.
func (t *discordDeleteTracker) noteBotDeletion(id, reason string, quiet bool, now time.Time) {
	t.mu.Lock()
	defer t.mu.Unlock()
	for k, d := range t.botDeletions {
		if now.After(d.expires) {
			delete(t.botDeletions, k)
		}
	}
	t.botDeletions[id] = discordBotDeletion{reason: reason, quiet: quiet, expires: now.Add(time.Minute)}
}

// deletedNow handles a MESSAGE_DELETE. It returns the bot deletion info when
// AxyraBot deleted the message; otherwise the message is kept for matching
// against an audit log entry.
func (t *discordDeleteTracker) deletedNow(id string, fallback *discordCachedMessage, now time.Time) (msg discordCachedMessage, known bool, bot *discordBotDeletion) {
	t.mu.Lock()
	defer t.mu.Unlock()
	msg, known = t.messages[id]
	delete(t.messages, id)
	if !known && fallback != nil {
		msg, known = *fallback, true
	}
	if d, ok := t.botDeletions[id]; ok {
		delete(t.botDeletions, id)
		return msg, known, &d
	}
	if !known {
		return msg, false, nil
	}
	kept := t.deleted[:0]
	for _, d := range t.deleted {
		if now.Sub(d.DeletedAt) <= discordDeleteMatchWindow && !d.matched {
			kept = append(kept, d)
		}
	}
	t.deleted = append(kept, discordDeletedMessage{ID: id, Message: msg, DeletedAt: now})
	return msg, true, nil
}

// matchAudit finds the most recent deleted message from authorID in
// channelID that hasn't been paired with an audit entry yet.
func (t *discordDeleteTracker) matchAudit(channelID, authorID string, now time.Time) (discordCachedMessage, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	for i := len(t.deleted) - 1; i >= 0; i-- {
		d := &t.deleted[i]
		if d.matched || now.Sub(d.DeletedAt) > discordDeleteMatchWindow {
			continue
		}
		if d.Message.ChannelID == channelID && d.Message.AuthorID == authorID {
			d.matched = true
			return d.Message, true
		}
	}
	return discordCachedMessage{}, false
}

// noteDiscordBotDeletion must be called right before AxyraBot deletes a
// server message, so the mod log can say AxyraBot did it and why.
func noteDiscordBotDeletion(messageID, reason string, quiet bool) {
	discordDeletes.noteBotDeletion(messageID, reason, quiet, time.Now())
}

func cachedFromDiscordMessage(m *discordgo.Message) *discordCachedMessage {
	if m == nil || m.Author == nil || m.GuildID == "" {
		return nil
	}
	at := m.Timestamp
	if at.IsZero() {
		at = time.Now()
	}
	return &discordCachedMessage{
		GuildID: m.GuildID, ChannelID: m.ChannelID, AuthorID: m.Author.ID,
		Content: m.Content, Attachments: len(m.Attachments), At: at,
	}
}

func discordMessageCacheHandler(s *discordgo.Session, m *discordgo.MessageCreate) {
	if m == nil {
		return
	}
	if msg := cachedFromDiscordMessage(m.Message); msg != nil {
		discordDeletes.remember(m.ID, *msg)
	}
}

func discordMessageEditCacheHandler(s *discordgo.Session, m *discordgo.MessageUpdate) {
	if m == nil || m.Message == nil || m.Author == nil {
		return // embed-only updates carry no author or text
	}
	discordDeletes.edit(m.ID, m.Content)
}

func discordMessageDeleteHandler(s *discordgo.Session, m *discordgo.MessageDelete) {
	if m == nil || m.Message == nil || m.GuildID == "" {
		return
	}
	msg, known, bot := discordDeletes.deletedNow(m.ID, cachedFromDiscordMessage(m.BeforeDelete), time.Now())
	if bot == nil || bot.quiet {
		return
	}
	botID := ""
	if s.State != nil && s.State.User != nil {
		botID = s.State.User.ID
	}
	var content *discordCachedMessage
	if known {
		content = &msg
	}
	postDiscordModLog(s, m.GuildID, discordMessageDeleteRecord(content, m.ChannelID, msg.AuthorID, botID, bot.reason))
}

// logAuditedMessageDelete posts a moderator's deletion once the matching
// MESSAGE_DELETE has had a moment to arrive (the two events can come in
// either order).
func logAuditedMessageDelete(s *discordgo.Session, guildID string, entry *discordgo.AuditLogEntry) {
	if s.State != nil && s.State.User != nil && entry.UserID == s.State.User.ID {
		return // AxyraBot's own deletions are logged when they happen, with a reason
	}
	channelID := ""
	if entry.Options != nil {
		channelID = entry.Options.ChannelID
	}
	time.Sleep(discordAuditMatchWait)
	var content *discordCachedMessage
	if msg, ok := discordDeletes.matchAudit(channelID, entry.TargetID, time.Now()); ok {
		content = &msg
	}
	postDiscordModLog(s, guildID, discordMessageDeleteRecord(content, channelID, entry.TargetID, entry.UserID, strings.TrimSpace(entry.Reason)))
}

// discordMessageDeleteRecord builds the mod log entry for one deleted
// message: who sent it, what it said, and who deleted it.
func discordMessageDeleteRecord(msg *discordCachedMessage, channelID, authorID, deleterID, reason string) discordModLogRecord {
	sender := "Unknown user"
	if authorID != "" {
		sender = fmt.Sprintf("<@%s>", authorID)
	}
	where := ""
	if channelID != "" {
		where = fmt.Sprintf(" in <#%s>", channelID)
	}
	var text string
	switch {
	case msg == nil:
		text = "*The message text isn't available. It was sent before AxyraBot started keeping track, or while it was offline.*"
	case strings.TrimSpace(msg.Content) == "" && msg.Attachments > 0:
		text = fmt.Sprintf("*No text, %d attachment(s)*", msg.Attachments)
	case strings.TrimSpace(msg.Content) == "":
		text = "*No text*"
	default:
		text = ">>> " + discordEscapeMarkdown(truncateRunes(msg.Content, discordLoggedTextMax))
		if msg.Attachments > 0 {
			text += fmt.Sprintf("\n*+ %d attachment(s)*", msg.Attachments)
		}
	}
	return discordModLogRecord{
		Event:       discordModLogMessageDelete,
		Title:       "Message deleted",
		Description: fmt.Sprintf("**Sent by** %s%s\n%s", sender, where, text),
		ActorID:     deleterID,
		ActorLabel:  "Deleted by",
		Reason:      reason,
	}
}

var discordMarkdownEscaper = strings.NewReplacer(
	`\`, `\\`, "*", `\*`, "_", `\_`, "~", `\~`, "`", "\\`", "|", `\|`, ">", `\>`, "#", `\#`, "-", `\-`, "[", `\[`, "]", `\]`,
)

// discordEscapeMarkdown makes text show up exactly as typed in a Discord
// message instead of being read as formatting.
func discordEscapeMarkdown(s string) string {
	return discordMarkdownEscaper.Replace(s)
}

func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max-1]) + "…"
}
