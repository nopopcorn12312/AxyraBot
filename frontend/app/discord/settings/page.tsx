"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../../hooks/usePersistentSectionState";
import { responsiveSidebarClassName, useResponsiveSidebar } from "../../hooks/useResponsiveSidebar";
import { useRequireAuth } from "../../hooks/useRequireAuth";
import { revokeSession } from "../../lib/session";
import NavIcon from "../../components/NavIcon";
import { BotOff, Cake, Check, Dices, Gavel, Gift, Image as ImageIcon, Info, Pencil, Settings, Shield, ShieldCheck, SmilePlus, Tag, Ticket, UserCog, X, type LucideIcon } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type Guild = { id: string; name: string; icon: string };
type Channel = { id: string; name: string };

type ModuleCommand = {
  name: string;
  description: string;
  settings?: {
    key: string;
    label: string;
    description?: string;
    type: "toggle" | "number" | "text" | "select";
    placeholder?: string;
    defaultValue?: string;
    min?: number;
    max?: number;
    options?: { label: string; value: string }[];
  }[];
};
type ModuleConfig = { key: string; icon: LucideIcon; label: string; description: string; commands: ModuleCommand[] };

const discordModLogOptions = [
  { key: "message_delete", label: "Message deleted" },
  { key: "message_bulk_delete", label: "Messages bulk-deleted" },
  { key: "member_timeout", label: "Timeout added or removed" },
  { key: "member_ban", label: "Member banned" },
  { key: "member_unban", label: "Member unbanned" },
  { key: "member_kick", label: "Member kicked" },
  { key: "member_prune", label: "Inactive members pruned" },
  { key: "member_role_add", label: "Role given to member" },
  { key: "member_role_remove", label: "Role removed from member" },
  { key: "voice_move", label: "Member moved between voice channels" },
  { key: "voice_disconnect", label: "Member disconnected from voice" },
  { key: "automod_action", label: "Discord AutoMod action" },
  { key: "nickname_change", label: "Nickname changed" },
  { key: "channel_create", label: "Channel created" },
  { key: "channel_update", label: "Channel settings changed" },
  { key: "channel_delete", label: "Channel deleted" },
  { key: "role_create", label: "Server role created" },
  { key: "role_update", label: "Server role changed" },
  { key: "role_delete", label: "Server role deleted" },
] as const;

const discordModuleConfig: ModuleConfig[] = [
  {
    key: "moderation",
    icon: Shield,
    label: "Moderation",
    description: "Comprehensive moderation toolkit: bans, kicks, timeouts, warnings, purge, lockdown, and full case logging.",
    commands: [
      { name: "ban", description: "Permanently ban a member from the server.", settings: [
        { key: "ban.dm_on_ban", label: "DM member before banning", description: "Send the member a DM with the reason before executing the ban.", type: "toggle", defaultValue: "false" },
        { key: "ban.delete_days", label: "Delete message history (days)", description: "Number of days of messages to delete (0–7).", type: "number", min: 0, max: 7, defaultValue: "0", placeholder: "0" },
      ]},
      { name: "kick", description: "Kick a member from the server.", settings: [
        { key: "kick.dm_on_kick", label: "DM member before kicking", description: "Send the member a DM with the reason before kicking.", type: "toggle", defaultValue: "false" },
      ]},
      { name: "timeout", description: "Temporarily mute a member.", settings: [
        { key: "timeout.default_duration", label: "Default duration", description: "Pre-filled duration when no value is provided.", type: "select", defaultValue: "10m", options: [
          { label: "60 seconds", value: "60s" },
          { label: "5 minutes", value: "5m" },
          { label: "10 minutes", value: "10m" },
          { label: "30 minutes", value: "30m" },
          { label: "1 hour", value: "1h" },
          { label: "6 hours", value: "6h" },
          { label: "24 hours", value: "24h" },
          { label: "1 week", value: "1w" },
        ]},
      ]},
      { name: "untimeout", description: "Remove a timeout from a member." },
      { name: "warn", description: "Issue a warning to a member.", settings: [
        { key: "warn.dm_on_warn", label: "DM member when warned", description: "Send the member a DM notifying them of the warning.", type: "toggle", defaultValue: "true" },
      ]},
      { name: "warnings", description: "View all warnings for a member." },
      { name: "clearwarnings", description: "Clear all warnings for a member." },
      { name: "delwarn", description: "Delete a specific warning by case ID." },
      { name: "purge", description: "Bulk delete messages from a channel.", settings: [
        { key: "purge.default_count", label: "Default message count", description: "How many messages to delete when no count is specified.", type: "number", min: 1, max: 100, defaultValue: "10", placeholder: "10" },
      ]},
      { name: "lock", description: "Lock a channel from sending messages." },
      { name: "unlock", description: "Unlock a previously locked channel." },
      { name: "slowmode", description: "Set slowmode delay on a channel.", settings: [
        { key: "slowmode.default_delay", label: "Default delay (seconds)", description: "Default slowmode delay in seconds (0 to disable).", type: "number", min: 0, max: 21600, defaultValue: "5", placeholder: "5" },
      ]},
      { name: "softban", description: "Ban then immediately unban to delete message history." },
      { name: "deafen", description: "Server-deafen a member in voice channels." },
      { name: "undeafen", description: "Remove server deafen from a member." },
      { name: "lockdown", description: "Lock or unlock all channels in the server at once." },
      { name: "temprole", description: "Assign a role to a member for a limited time.", settings: [
        { key: "temprole.default_duration", label: "Default duration", description: "Default duration when none is specified (e.g. 1h, 7d).", type: "text", defaultValue: "1h", placeholder: "e.g. 1h, 7d" },
      ]},
      { name: "rolepersist", description: "Toggle a role that automatically re-applies when the member rejoins." },
      { name: "modlogs", description: "View the full moderation history for a member." },
      { name: "modstats", description: "View moderator action statistics." },
      { name: "case", description: "Look up the details of a specific mod case." },
      { name: "reason", description: "Update the reason on a previous mod case." },
      { name: "note", description: "Add a private staff note about a member." },
      { name: "notes", description: "View all staff notes for a member." },
      { name: "delnote", description: "Delete a specific staff note." },
      { name: "clearnotes", description: "Clear all staff notes for a member." },
      { name: "members", description: "List all members who have a specific role." },
    ],
  },
  {
    key: "manager",
    icon: Settings,
    label: "Manager",
    description: "Server management utilities: announcements, role management, nickname changes, emote upload, and bot configuration.",
    commands: [
      { name: "announce", description: "Send a message as the bot to a target channel.", settings: [
        { key: "announce.require_mod", label: "Require moderator role", description: "Only allow members with a configured moderator role to use this command.", type: "toggle", defaultValue: "true" },
      ]},
      { name: "role", description: "Toggle a role on or off for a member." },
      { name: "addrole", description: "Create a new server role." },
      { name: "delrole", description: "Delete an existing server role." },
      { name: "rolecolor", description: "Change a role's display color." },
      { name: "rolename", description: "Rename a server role." },
      { name: "setnick", description: "Change a member's nickname." },
      { name: "addmod", description: "Designate a role as a moderator role for the bot." },
      { name: "delmod", description: "Remove a role from the moderator role list." },
      { name: "listmods", description: "List all roles designated as moderators." },
      { name: "addemote", description: "Add a custom emoji from an image URL." },
      { name: "ignorechannel", description: "Toggle bot command ignore for a specific channel." },
      { name: "module", description: "Enable or disable bot modules via slash command." },
    ],
  },
  {
    key: "roles",
    icon: UserCog,
    label: "Roles",
    description: "Self-assignable role system. Let members join and leave roles themselves with configurable joinable ranks.",
    commands: [
      { name: "rank", description: "Join or leave a self-assignable rank role." },
      { name: "ranks", description: "List all joinable rank roles in the server." },
      { name: "addrank", description: "Make a role self-assignable as a rank." },
      { name: "delrank", description: "Remove a role from the self-assignable ranks list." },
      { name: "roleinfo", description: "Get detailed information about a role." },
    ],
  },
  {
    key: "info",
    icon: Info,
    label: "Info",
    description: "Utility and information commands: server info, member lookup, AFK system, highlights, and reminders.",
    commands: [
      { name: "serverinfo", description: "Display detailed information about the server." },
      { name: "whois", description: "Show profile, roles, and join info for a member." },
      { name: "avatar", description: "Show the full-size avatar of a user." },
      { name: "membercount", description: "Display the current server member count." },
      { name: "ping", description: "Check the bot's response time." },
      { name: "emotes", description: "List all custom emojis in the server." },
      { name: "inviteinfo", description: "Show usage stats for a server invite link." },
      { name: "afk", description: "Set your AFK status and message." },
      { name: "highlights", description: "Get notified when a keyword is mentioned while you're away." },
      { name: "remindme", description: "Set a reminder for yourself at a future time." },
    ],
  },
  {
    key: "fun",
    icon: Dices,
    label: "Fun",
    description: "Entertainment commands: polls, dice rolls, animal pictures, trivia, color preview, and external lookups.",
    commands: [
      { name: "poll", description: "Start a reaction-based poll.", settings: [
        { key: "poll.default_duration", label: "Default duration (hours)", description: "How many hours a poll stays open if no duration is given.", type: "number", min: 1, max: 72, defaultValue: "24", placeholder: "24" },
      ]},
      { name: "flip", description: "Flip a coin — heads or tails." },
      { name: "roll", description: "Roll dice (e.g. 2d6)." },
      { name: "rps", description: "Play rock, paper, scissors against the bot." },
      { name: "dadjoke", description: "Get a random dad joke." },
      { name: "cat", description: "Get a random cat picture." },
      { name: "dog", description: "Get a random dog picture." },
      { name: "pug", description: "Get a random pug picture." },
      { name: "color", description: "Preview a hex color as an embed." },
      { name: "randomcolor", description: "Generate and display a random color." },
      { name: "pokemon", description: "Look up a Pokémon's stats and info." },
      { name: "github", description: "Look up a GitHub user or repository." },
      { name: "space", description: "Get the current position of the ISS." },
    ],
  },
  {
    key: "tags",
    icon: Tag,
    label: "Tags",
    description: "Store and retrieve reusable text snippets. Great for FAQs, rules, or any custom response shortcut.",
    commands: [
      { name: "tag", description: "Get, create, edit, or delete a named text snippet." },
      { name: "tags", description: "List all tags saved in this server." },
    ],
  },
  {
    key: "giveaway",
    icon: Gift,
    label: "Giveaway",
    description: "Full giveaway system with scheduled resolution, re-roll support, and winner announcements.",
    commands: [
      { name: "giveaway", description: "Start a giveaway, end it early, or re-roll winners." },
    ],
  },
];

export default function DiscordSettingsPage() {
  useRequireAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [viewerLogin, setViewerLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { sidebarOpen, mobileSidebarOpen, toggleSidebar, closeMobileSidebar } = useResponsiveSidebar();
  const [mainSectionOpen, setMainSectionOpen] = usePersistentSectionState("axyra.sidebar.mainSectionOpen", true);
  const [vanitySectionOpen, setVanitySectionOpen] = usePersistentSectionState("axyra.sidebar.vanitySectionOpen", true);
  const [otherSectionOpen, setOtherSectionOpen] = usePersistentSectionState("axyra.sidebar.otherSectionOpen", true);
  const [moderationOpen, setModerationOpen] = usePersistentSectionState("axyra.sidebar.moderationOpen", true);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const serverDropdownRef = useRef<HTMLDivElement | null>(null);
  // Tracks which channel already has the panel posted so we only re-send when it changes.
  const lastSentTicketChannelRef = useRef<string>("");
  const pathname = usePathname();

  // Discord state
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(true);
  const [discordLinked, setDiscordLinked] = useState(false);
  const [discordAuthError, setDiscordAuthError] = useState<string | null>(null);
  // True while a just-finished Discord sign-in is being confirmed; the guild
  // list waits for it so it doesn't flash the "Add to Discord" screen first.
  const [completingDiscord, setCompletingDiscord] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("discord_complete"),
  );
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [guildChannels, setGuildChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [liveChannelId, setLiveChannelId] = useState("");
  const [modChannelId, setModChannelId] = useState("");
  const [modLogChannelId, setModLogChannelId] = useState("");
  const [modLogEvents, setModLogEvents] = useState<string[]>([]);
  const [modLogEventsDraft, setModLogEventsDraft] = useState<string[]>([]);
  const [editingModLogOptions, setEditingModLogOptions] = useState(false);
  const [honeypotChannelId, setHoneypotChannelId] = useState("");
  const [bdayChannelId, setBdayChannelId] = useState("");
  const [bdaySourceLogin, setBdaySourceLogin] = useState("");
  const [bdaySourceListOptions, setBdaySourceListOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);

  // Ticket system state
  const [ticketPanelChannelId, setTicketPanelChannelId] = useState("");
  const [ticketLogChannelId, setTicketLogChannelId] = useState("");
  const [ticketCategoryId, setTicketCategoryId] = useState("");
  const [ticketSupportRoleIds, setTicketSupportRoleIds] = useState<string[]>([]);
  const [ticketPanelTitle, setTicketPanelTitle] = useState("Support Tickets");
  const [ticketPanelBody, setTicketPanelBody] = useState("Click the button below to open a support ticket.");
  const [ticketButtonLabel, setTicketButtonLabel] = useState("🎫 Open Ticket");
  const [ticketPanelMessageId, setTicketPanelMessageId] = useState("");
  const [loadingTicketConfig, setLoadingTicketConfig] = useState(false);
  const [savingTicketConfig, setSavingTicketConfig] = useState(false);
  const [ticketSaveSuccess, setTicketSaveSuccess] = useState(false);
  const [ticketSaveError, setTicketSaveError] = useState<string | null>(null);
  const [sendingPanel, setSendingPanel] = useState(false);
  const [sendPanelSuccess, setSendPanelSuccess] = useState(false);
  const [sendPanelError, setSendPanelError] = useState<string | null>(null);
  const [editingTicketRoles, setEditingTicketRoles] = useState(false);
  const [ticketRoleSaving, setTicketRoleSaving] = useState(false);
  const [ticketRoleSaveSuccess, setTicketRoleSaveSuccess] = useState(false);
  const [ticketRoleSaveError, setTicketRoleSaveError] = useState<string | null>(null);
  type GuildCategory = { id: string; name: string };
  const [guildCategories, setGuildCategories] = useState<GuildCategory[]>([]);

  // Role mapping state
  type GuildRole = { id: string; name: string; color: number };
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [roleMap, setRoleMap] = useState<Record<string, string>>({
    vip: "", moderator: "", owner: "",
  });
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null);

  // Reaction roles state
  type RREntry = { emoji: string; role_id: string; role_name: string };
  type RRPanel = { id: number; channel_id: string; message_id: string; title: string; description: string; entries: RREntry[] };
  const [rrPanels, setRrPanels] = useState<RRPanel[]>([]);
  const [rrEditing, setRrEditing] = useState<RRPanel | null>(null);
  const [rrChannelId, setRrChannelId] = useState("");
  const [rrTitle, setRrTitle] = useState("React for Roles");
  const [rrDescription, setRrDescription] = useState("React below to get a role!");
  const [rrEntries, setRrEntries] = useState<RREntry[]>([{ emoji: "", role_id: "", role_name: "" }]);
  const [rrSending, setRrSending] = useState(false);
  const [rrSendSuccess, setRrSendSuccess] = useState(false);
  const [rrSendError, setRrSendError] = useState<string | null>(null);
  const [rrFormOpen, setRrFormOpen] = useState(false);

  // Welcome settings state
  const [welcomeChannelId, setWelcomeChannelId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [autoRoleIds, setAutoRoleIds] = useState<string[]>([]);
  const [leaveChannelId, setLeaveChannelId] = useState("");
  const [welcomeBannerEnabled, setWelcomeBannerEnabled] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [welcomeSaveSuccess, setWelcomeSaveSuccess] = useState(false);
  const [welcomeSaveError, setWelcomeSaveError] = useState<string | null>(null);

  // Discord guild module state
  const [guildModules, setGuildModules] = useState<Record<string, boolean>>({});
  const [loadingModules, setLoadingModules] = useState(false);
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  // Module config modal
  const [openModuleKey, setOpenModuleKey] = useState<string | null>(null);
  const [cmdSettings, setCmdSettings] = useState<Record<string, string>>({});
  const [pendingCmdSettings, setPendingCmdSettings] = useState<Record<string, string>>({});
  const [savingCmdSettings, setSavingCmdSettings] = useState(false);
  // Guild managers state (only used when !isEditor)
  const [guildManagers, setGuildManagers] = useState<string[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [addManagerInput, setAddManagerInput] = useState("");
  const [addingManager, setAddingManager] = useState(false);
  const [removingManager, setRemovingManager] = useState<string | null>(null);
  type NotifType = "live" | "mod" | "birthday";
  type Templates = Record<NotifType, string>;
  const defaultTemplates: Templates = {
    live:     "🔴 **$(channel) is now live!**\n🎮 $(game)\n📺 $(title)\nhttps://twitch.tv/$(channel)",
    // Same as discordDefaultModTemplate in backend/discord.go. Lines whose variables are empty are left out.
    mod:      "$(emoji) **[$(channel)]** `$(target)` was $(verb) by `$(moderator)`\nMessage: $(message)\nReason: $(reason)",
    birthday: "🎂 Happy Birthday to **$(names)** in **$(channel)**'s community! 🎉",
  };
  const templateVars: Record<NotifType, { name: string; desc: string }[]> = {
    live:     [{ name: "$(channel)", desc: "Your Twitch username" }, { name: "$(title)", desc: "Stream title" }, { name: "$(game)", desc: "Game / category" }],
    mod:      [{ name: "$(channel)", desc: "Your Twitch username" }, { name: "$(target)", desc: "The moderated user" }, { name: "$(moderator)", desc: "Who took the action" }, { name: "$(action)", desc: "Raw action: ban / timeout / delete" }, { name: "$(verb)", desc: "Past-tense verb (banned, timed out…)" }, { name: "$(emoji)", desc: "Action emoji" }, { name: "$(message)", desc: "The deleted chat message" }, { name: "$(reason)", desc: "Reason text" }],
    birthday: [{ name: "$(names)", desc: "Comma-separated birthday names" }, { name: "$(channel)", desc: "Your Twitch username" }],
  };
  const [templates, setTemplates] = useState<Templates>({ live: "", mod: "", birthday: "" });
  const [editingNotif, setEditingNotif] = useState<NotifType | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);

  // Close server dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(e.target as Node)) {
        setServerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Read auth from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    const storedGuild = window.localStorage.getItem("axyra.discord.selectedGuild");
    if (storedLogin) {
      setIsLoggedIn(true);
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
      setViewerLogin(storedLogin.toLowerCase());
      setChannelLogin((activeChannel || storedLogin).toLowerCase());
    }
    if (storedAvatar) setAvatarUrl(storedAvatar);
    if (storedGuild) setSelectedGuildId(storedGuild);
  }, []);

  // After guilds load, if the stored guild isn't in the list fall back to first
  useEffect(() => {
    if (loadingGuilds || guilds.length === 0) return;
    setSelectedGuildId((prev) => {
      if (prev && guilds.some((g) => g.id === prev)) return prev;
      const first = guilds[0].id;
      window.localStorage.setItem("axyra.discord.selectedGuild", first);
      return first;
    });
  }, [loadingGuilds, guilds]);

  // Persist selected guild to localStorage whenever it changes
  useEffect(() => {
    if (selectedGuildId) window.localStorage.setItem("axyra.discord.selectedGuild", selectedGuildId);
  }, [selectedGuildId]);

  // Load saved settings for the selected (broadcaster, guild) pair
  useEffect(() => {
    if (!channelLogin || !selectedGuildId) return;
    setLoadingSettings(true);
    setLiveChannelId("");
    setModChannelId("");
    setModLogChannelId("");
    setModLogEvents([]);
    setHoneypotChannelId("");
    setBdayChannelId("");
    setBdaySourceLogin("");
    fetch(`${backendUrl}/discord/settings?login=${encodeURIComponent(channelLogin)}&guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setLiveChannelId(data.live_channel_id ?? "");
          setModChannelId(data.mod_channel_id ?? "");
          setModLogChannelId(data.mod_log_channel_id ?? "");
          setModLogEvents(data.mod_log_events ?? []);
          setHoneypotChannelId(data.honeypot_channel_id ?? "");
          setBdayChannelId(data.bday_channel_id ?? "");
          setBdaySourceLogin(data.bday_source_login ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [channelLogin, selectedGuildId]);

  // Fetch the servers the viewer can manage — filtered server-side by their session
  useEffect(() => {
    if (!viewerLogin || completingDiscord) return;
    setLoadingGuilds(true);
    const params = new URLSearchParams();
    if (viewerLogin) params.set("viewer_login", viewerLogin);
    if (channelLogin) params.set("channel_login", channelLogin);
    fetch(`${backendUrl}/discord/guilds?${params}`)
      .then((r) => (r.ok ? r.json() : { guilds: [] }))
      .then((data) => {
        setGuilds(data.guilds ?? []);
        setDiscordLinked(Boolean(data.discord_linked));
      })
      .catch(() => setGuilds([]))
      .finally(() => setLoadingGuilds(false));
  }, [viewerLogin, channelLogin, completingDiscord]);

  // Handle the redirect back from Discord OAuth: confirm the sign-in with this
  // browser's session, select the server the bot was just added to, surface
  // errors, then strip the params from the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const completeCode = params.get("discord_complete");
    const error = params.get("discord_error");
    if (!completeCode && error === null) return;
    if (completeCode) {
      fetch(`${backendUrl}/discord/auth/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: completeCode }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          const data: { guild_id?: string } = await r.json();
          if (data.guild_id) {
            setSelectedGuildId(data.guild_id);
            window.localStorage.setItem("axyra.discord.selectedGuild", data.guild_id);
          }
        })
        .catch(() => setDiscordAuthError("Couldn't connect your Discord account. Please try again."))
        .finally(() => setCompletingDiscord(false));
    }
    if (error !== null) {
      setDiscordAuthError(
        error === "access_denied" || error === ""
          ? "Discord sign-in was cancelled."
          : "Couldn't connect your Discord account. Please try again.",
      );
    }
    params.delete("discord_complete");
    params.delete("discord_error");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // Load the birthday lists this user can choose as an announcement source:
  // their own channel, any channel they're an Editor for, and any custom
  // lists they've created on the Birthdays page.
  useEffect(() => {
    if (!viewerLogin) return;
    let cancelled = false;
    (async () => {
      try {
        const [editorRes, customRes] = await Promise.all([
          fetch(`${backendUrl}/roles/editor-channels?login=${encodeURIComponent(viewerLogin)}`),
          fetch(`${backendUrl}/birthdays/lists?login=${encodeURIComponent(viewerLogin)}`),
        ]);
        const editorData: { channels?: string[] } = editorRes.ok ? await editorRes.json() : {};
        const customData: { lists?: { listKey: string; displayName: string }[] } = customRes.ok
          ? await customRes.json()
          : {};
        const editorChannels = (editorData.channels ?? []).map((c) => c.toLowerCase());
        const seen = new Set<string>();
        const opts: { value: string; label: string }[] = [];
        for (const value of [viewerLogin, ...editorChannels]) {
          if (seen.has(value)) continue;
          seen.add(value);
          opts.push({ value, label: value === viewerLogin ? `${value} (mine)` : value });
        }
        for (const l of customData.lists ?? []) {
          if (seen.has(l.listKey)) continue;
          seen.add(l.listKey);
          opts.push({ value: l.listKey, label: l.displayName });
        }
        if (!cancelled) setBdaySourceListOptions(opts);
      } catch {
        // ignore; dropdown falls back to just the default option
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerLogin]);

  // Fetch channels when selected guild changes
  useEffect(() => {
    if (!selectedGuildId) {
      setGuildChannels([]);
      return;
    }
    setLoadingChannels(true);
    fetch(`${backendUrl}/discord/channels?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : { channels: [] }))
      .then((data) => setGuildChannels(data.channels ?? []))
      .catch(() => setGuildChannels([]))
      .finally(() => setLoadingChannels(false));
  }, [selectedGuildId]);

  // Fetch roles when selected guild changes
  useEffect(() => {
    if (!selectedGuildId) {
      setGuildRoles([]);
      return;
    }
    setLoadingRoles(true);
    fetch(`${backendUrl}/discord/roles?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : { roles: [] }))
      .then((data) => setGuildRoles(data.roles ?? []))
      .catch(() => setGuildRoles([]))
      .finally(() => setLoadingRoles(false));
  }, [selectedGuildId]);

  // Load saved role mappings when (channelLogin + selectedGuildId) both set
  useEffect(() => {
    setRoleMap({ vip: "", moderator: "", owner: "" });
    if (!channelLogin || !selectedGuildId) return;
    fetch(`${backendUrl}/discord/role-mappings?login=${encodeURIComponent(channelLogin)}&guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRoleMap({
            vip: data.vip?.discord_role_id ?? "",
            moderator: data.moderator?.discord_role_id ?? "",
            owner: data.owner?.discord_role_id ?? "",
          });
        } else {
          setRoleMap({ vip: "", moderator: "", owner: "" });
        }
      })
      .catch(() => {});
  }, [channelLogin, selectedGuildId]);

  // Load welcome settings when guild changes
  useEffect(() => {
    // Clear immediately so stale data from the previous guild never leaks
    setWelcomeChannelId("");
    setWelcomeMessage("");
    setAutoRoleIds([]);
    setLeaveChannelId("");
    setWelcomeBannerEnabled(false);
    if (!selectedGuildId) return;
    fetch(`${backendUrl}/discord/welcome-settings?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setWelcomeChannelId(data.welcome_channel_id ?? "");
          setWelcomeMessage(data.welcome_message ?? "");
          setAutoRoleIds(data.auto_role_ids ?? []);
          setLeaveChannelId(data.leave_channel_id ?? "");
          setWelcomeBannerEnabled(data.welcome_banner_enabled ?? false);
        }
      })
      .catch(() => {});
  }, [selectedGuildId]);

  // Load saved notification templates when channelLogin + selectedGuildId are set
  useEffect(() => {
    setTemplates({ live: "", mod: "", birthday: "" });
    if (!channelLogin || !selectedGuildId) return;
    fetch(`${backendUrl}/discord/notification-templates?login=${encodeURIComponent(channelLogin)}&guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setTemplates({ live: data.live ?? "", mod: data.mod ?? "", birthday: data.birthday ?? "" });
      })
      .catch(() => {});
  }, [channelLogin, selectedGuildId]);

  // Load guild module settings when selected guild changes
  useEffect(() => {
    if (!selectedGuildId) {
      setGuildModules({});
      setCmdSettings({});
      setPendingCmdSettings({});
      return;
    }
    setLoadingModules(true);
    Promise.all([
      fetch(`${backendUrl}/discord/guild-modules?guild_id=${encodeURIComponent(selectedGuildId)}`)
        .then((r) => (r.ok ? r.json() : null)),
      fetch(`${backendUrl}/discord/command-settings?guild_id=${encodeURIComponent(selectedGuildId)}`)
        .then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([modData, settingsData]) => {
        if (modData?.modules) setGuildModules(modData.modules);
        if (settingsData?.settings) {
          setCmdSettings(settingsData.settings);
          setPendingCmdSettings(settingsData.settings);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingModules(false));
  }, [selectedGuildId]);

  // Load guild managers when selected guild changes (owners only)
  useEffect(() => {
    if (!selectedGuildId || isEditor) {
      setGuildManagers([]);
      return;
    }
    setLoadingManagers(true);
    fetch(`${backendUrl}/discord/guild-managers?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : { managers: [] }))
      .then((data) => setGuildManagers(data.managers ?? []))
      .catch(() => setGuildManagers([]))
      .finally(() => setLoadingManagers(false));
  }, [selectedGuildId, isEditor]);

  // Load ticket config when guild changes
  useEffect(() => {
    setTicketPanelChannelId("");
    setTicketLogChannelId("");
    setTicketCategoryId("");
    setTicketSupportRoleIds([]);
    setTicketPanelTitle("Support Tickets");
    setTicketPanelBody("Click the button below to open a support ticket.");
    setTicketButtonLabel("🎫 Open Ticket");
    setTicketPanelMessageId("");
    if (!selectedGuildId) return;
    setLoadingTicketConfig(true);
    fetch(`${backendUrl}/discord/tickets/config?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTicketPanelChannelId(data.panel_channel_id ?? "");
          setTicketLogChannelId(data.log_channel_id ?? "");
          setTicketCategoryId(data.category_id ?? "");
          setTicketSupportRoleIds(data.support_role_ids ?? []);
          setTicketPanelTitle(data.panel_title ?? "Support Tickets");
          setTicketPanelBody(data.panel_body ?? "Click the button below to open a support ticket.");
          setTicketButtonLabel(data.button_label ?? "🎫 Open Ticket");
          setTicketPanelMessageId(data.panel_message_id ?? "");
          // Remember what channel already has a live panel so we don't re-send on every save.
          lastSentTicketChannelRef.current = data.panel_channel_id ?? "";
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTicketConfig(false));
  }, [selectedGuildId]);

  // Load reaction role panels when guild changes
  useEffect(() => {
    if (!selectedGuildId) { setRrPanels([]); setRrFormOpen(false); return; }
    fetch(`${backendUrl}/discord/reaction-roles?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : { panels: [] }))
      .then((data) => setRrPanels(data.panels ?? []))
      .catch(() => setRrPanels([]));
  }, [selectedGuildId]);

  // Fetch guild categories (type=4) for ticket category selector
  useEffect(() => {
    if (!selectedGuildId) { setGuildCategories([]); return; }
    fetch(`${backendUrl}/discord/channels?guild_id=${encodeURIComponent(selectedGuildId)}&all=true`)
      .then((r) => (r.ok ? r.json() : { channels: [] }))
      .then((data) => setGuildCategories((data.channels ?? []).filter((c: { id: string; name: string; type?: number }) => c.type === 4)))
      .catch(() => setGuildCategories([]));
  }, [selectedGuildId]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      revokeSession();
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.location.href = "/";
  };

  const handleSave = async () => {
    if (!channelLogin) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: channelLogin,
          guild_id: selectedGuildId,
          live_channel_id: liveChannelId,
          mod_channel_id: modChannelId,
          mod_log_channel_id: modLogChannelId,
          mod_log_events: modLogEvents,
          honeypot_channel_id: honeypotChannelId,
          bday_channel_id: bdayChannelId,
          bday_source_login: bdaySourceLogin,
        }),
      });
      if (!res.ok) {
        setSaveError("Failed to save settings. Please try again.");
        return;
      }
      // If a ticket panel channel is configured, persist it and send the panel
      // whenever the channel changes (or is set for the first time).
      if (selectedGuildId && ticketPanelChannelId &&
          ticketPanelChannelId !== lastSentTicketChannelRef.current) {
        await fetch(`${backendUrl}/discord/tickets/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guild_id: selectedGuildId,
            panel_channel_id: ticketPanelChannelId,
            log_channel_id: ticketLogChannelId,
            category_id: ticketCategoryId,
            support_role_ids: ticketSupportRoleIds,
            panel_title: ticketPanelTitle,
            panel_body: ticketPanelBody,
            button_label: ticketButtonLabel,
          }),
        });
        const panelRes = await fetch(`${backendUrl}/discord/tickets/send-panel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guild_id: selectedGuildId }),
        });
        if (panelRes.ok) {
          const data = await panelRes.json();
          if (data.panel_message_id) setTicketPanelMessageId(data.panel_message_id);
          lastSentTicketChannelRef.current = ticketPanelChannelId;
        }
      }
      // Also persist leave channel alongside the other channel settings.
      if (selectedGuildId) {
        await fetch(`${backendUrl}/discord/welcome-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guild_id: selectedGuildId,
            welcome_channel_id: welcomeChannelId,
            welcome_message: welcomeMessage,
            auto_role_ids: autoRoleIds,
            leave_channel_id: leaveChannelId,
            welcome_banner_enabled: welcomeBannerEnabled,
          }),
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!channelLogin || !selectedGuildId) return;
    setSavingRoles(true);
    setRoleSaveError(null);
    setRoleSaveSuccess(false);
    // Build a roleId→name lookup from the current guildRoles list
    const roleNames: Record<string, string> = {};
    for (const r of guildRoles) roleNames[r.id] = r.name;
    try {
      const res = await fetch(`${backendUrl}/discord/role-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: channelLogin,
          guild_id: selectedGuildId,
          mappings: roleMap,
          roles: roleNames,
        }),
      });
      if (!res.ok) {
        setRoleSaveError("Failed to save role mappings.");
      } else {
        setRoleSaveSuccess(true);
        setTimeout(() => setRoleSaveSuccess(false), 3000);
      }
    } catch {
      setRoleSaveError("Network error. Please try again.");
    } finally {
      setSavingRoles(false);
    }
  };

  const handleSaveWelcome = async () => {
    if (!selectedGuildId) return;
    setSavingWelcome(true);
    setWelcomeSaveError(null);
    setWelcomeSaveSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/welcome-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: selectedGuildId,
          welcome_channel_id: welcomeChannelId,
          welcome_message: welcomeMessage,
          auto_role_ids: autoRoleIds,
          leave_channel_id: leaveChannelId,
          welcome_banner_enabled: welcomeBannerEnabled,
        }),
      });
      if (!res.ok) {
        setWelcomeSaveError("Failed to save welcome settings.");
      } else {
        setWelcomeSaveSuccess(true);
        setTimeout(() => setWelcomeSaveSuccess(false), 3000);
      }
    } catch {
      setWelcomeSaveError("Network error. Please try again.");
    } finally {
      setSavingWelcome(false);
    }
  };

  const handleSaveTicketConfig = async () => {
    if (!selectedGuildId) return;
    setSavingTicketConfig(true);
    setTicketSaveError(null);
    setTicketSaveSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/tickets/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: selectedGuildId,
          panel_channel_id: ticketPanelChannelId,
          log_channel_id: ticketLogChannelId,
          category_id: ticketCategoryId,
          support_role_ids: ticketSupportRoleIds,
          panel_title: ticketPanelTitle,
          panel_body: ticketPanelBody,
          button_label: ticketButtonLabel,
        }),
      });
      if (!res.ok) {
        setTicketSaveError("Failed to save ticket config.");
      } else {
        setTicketSaveSuccess(true);
        setTimeout(() => setTicketSaveSuccess(false), 3000);
      }
    } catch {
      setTicketSaveError("Network error. Please try again.");
    } finally {
      setSavingTicketConfig(false);
    }
  };

  const handleSendTicketPanel = async () => {
    if (!selectedGuildId) return;
    setSendingPanel(true);
    setSendPanelError(null);
    setSendPanelSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/tickets/send-panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: selectedGuildId }),
      });
      if (!res.ok) {
        const text = await res.text();
        setSendPanelError(text || "Failed to send panel.");
      } else {
        const data = await res.json();
        if (data.panel_message_id) setTicketPanelMessageId(data.panel_message_id);
        setSendPanelSuccess(true);
        setTimeout(() => setSendPanelSuccess(false), 4000);
      }
    } catch {
      setSendPanelError("Network error. Please try again.");
    } finally {
      setSendingPanel(false);
    }
  };

  const handleSendReactionPanel = async () => {
    if (!selectedGuildId || !rrChannelId) return;
    const validEntries = rrEntries.filter((e) => e.emoji.trim() && e.role_id);
    if (validEntries.length === 0) { setRrSendError("Add at least one emoji + role entry."); return; }
    setRrSending(true);
    setRrSendError(null);
    setRrSendSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/reaction-roles/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: selectedGuildId,
          panel_id: rrEditing?.id ?? 0,
          channel_id: rrChannelId,
          title: rrTitle,
          description: rrDescription,
          entries: validEntries,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setRrSendError(text || "Failed to send panel.");
        return;
      }
      // Refresh panels list
      const r2 = await fetch(`${backendUrl}/discord/reaction-roles?guild_id=${encodeURIComponent(selectedGuildId)}`);
      const d2 = await r2.json();
      setRrPanels(d2.panels ?? []);
      setRrFormOpen(false);
      setRrEditing(null);
      setRrSendSuccess(true);
      setTimeout(() => setRrSendSuccess(false), 3000);
    } catch {
      setRrSendError("Network error. Please try again.");
    } finally {
      setRrSending(false);
    }
  };

  const handleDeleteReactionPanel = async (panelId: number) => {
    if (!selectedGuildId) return;
    await fetch(`${backendUrl}/discord/reaction-roles?guild_id=${encodeURIComponent(selectedGuildId)}&id=${panelId}`, {
      method: "DELETE",
    });
    setRrPanels((prev) => prev.filter((p) => p.id !== panelId));
  };

  const openNewReactionPanel = () => {
    setRrEditing(null);
    setRrChannelId("");
    setRrTitle("React for Roles");
    setRrDescription("React below to get a role!");
    setRrEntries([{ emoji: "", role_id: "", role_name: "" }]);
    setRrSendError(null);
    setRrFormOpen(true);
  };

  const openEditReactionPanel = (panel: RRPanel) => {
    setRrEditing(panel);
    setRrChannelId(panel.channel_id);
    setRrTitle(panel.title);
    setRrDescription(panel.description);
    setRrEntries(panel.entries.length > 0 ? panel.entries : [{ emoji: "", role_id: "", role_name: "" }]);
    setRrSendError(null);
    setRrFormOpen(true);
  };

  const handleModuleToggle = async (moduleName: string, next: boolean) => {
    if (!selectedGuildId) return;
    setGuildModules((prev) => ({ ...prev, [moduleName]: next }));
    setSavingModule(moduleName);
    try {
      const res = await fetch(`${backendUrl}/discord/guild-modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: selectedGuildId, module: moduleName, enabled: next }),
      });
      if (!res.ok) {
        setGuildModules((prev) => ({ ...prev, [moduleName]: !next }));
      }
    } catch {
      setGuildModules((prev) => ({ ...prev, [moduleName]: !next }));
    } finally {
      setSavingModule(null);
    }
  };

  const handleCmdToggle = async (cmdName: string, next: boolean) => {
    if (!selectedGuildId) return;
    const key = `cmd:${cmdName}`;
    setGuildModules((prev) => ({ ...prev, [key]: next }));
    try {
      const res = await fetch(`${backendUrl}/discord/guild-modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: selectedGuildId, module: key, enabled: next }),
      });
      if (!res.ok) setGuildModules((prev) => ({ ...prev, [key]: !next }));
    } catch {
      setGuildModules((prev) => ({ ...prev, [key]: !next }));
    }
  };

  const handleSaveCmdSettings = async () => {
    if (!selectedGuildId) return;
    setSavingCmdSettings(true);
    try {
      const dirty = Object.entries(pendingCmdSettings).filter(
        ([k, v]) => v !== (cmdSettings[k] ?? "")
      );
      await Promise.all(
        dirty.map(([k, v]) =>
          fetch(`${backendUrl}/discord/command-settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guild_id: selectedGuildId, key: k, value: v }),
          })
        )
      );
      setCmdSettings((prev) => ({ ...prev, ...Object.fromEntries(dirty) }));
    } catch {
      // silent fail — user can retry
    } finally {
      setSavingCmdSettings(false);
    }
  };

  const handleAddManager = async () => {
    const login = addManagerInput.trim().toLowerCase();
    if (!login || !selectedGuildId) return;
    setAddingManager(true);
    try {
      const res = await fetch(`${backendUrl}/discord/guild-managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: selectedGuildId, login }),
      });
      if (res.ok) {
        setGuildManagers((prev) => prev.includes(login) ? prev : [...prev, login]);
        setAddManagerInput("");
      }
    } catch { /* silent */ }
    finally { setAddingManager(false); }
  };

  const handleRemoveManager = async (login: string) => {
    if (!selectedGuildId) return;
    setRemovingManager(login);
    try {
      const res = await fetch(`${backendUrl}/discord/guild-managers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: selectedGuildId, login }),
      });
      if (res.ok) setGuildManagers((prev) => prev.filter((m) => m !== login));
    } catch { /* silent */ }
    finally { setRemovingManager(null); }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setTemplateSaveError(null);
    setTemplateSaveSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/notification-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: channelLogin, guild_id: selectedGuildId, templates: { [editingNotif as string]: editDraft } }),
      });
      if (!res.ok) {
        setTemplateSaveError("Failed to save.");
      } else {
        setTemplates((prev) => ({ ...prev, [editingNotif as string]: editDraft }));
        setTemplateSaveSuccess(true);
        setTimeout(() => { setTemplateSaveSuccess(false); setEditingNotif(null); }, 1200);
      }
    } catch {
      setTemplateSaveError("Network error.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const _lastLogin = typeof window !== "undefined" ? (window.localStorage.getItem("axyra.lastLogin") ?? "") : "";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${_lastLogin ? `&hint=${encodeURIComponent(_lastLogin)}` : ""}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  // Both buttons go through the backend so it learns the user's Discord account
  // (and, for invites, which server the bot was added to) before sending them back.
  const startDiscordAuth = async (invite: boolean) => {
    setDiscordAuthError(null);
    const params = new URLSearchParams({ redirect: `${window.location.origin}/discord/settings` });
    if (invite) params.set("invite", "1");
    try {
      const res = await fetch(`${backendUrl}/discord/auth/start?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data: { url: string } = await res.json();
      window.location.href = data.url;
    } catch {
      setDiscordAuthError("Couldn't reach Discord sign-in. Please try again.");
    }
  };

  const botInSelectedGuild = guilds.some((g) => g.id === selectedGuildId);
  const channelSelectClass = "rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60 max-w-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
    <main className="min-h-screen flex flex-col bg-ax-bg md:h-screen md:overflow-hidden">
      <header className="w-full flex h-14 shrink-0 items-center justify-between border-b border-ax-subtle px-4 md:px-5">
        <div className="flex items-center gap-4 flex-1">
          <button
            aria-label="Toggle navigation"
            type="button"
            onClick={toggleSidebar}
            className="mr-2 rounded-md bg-ax-section px-3 py-2 text-sm font-medium text-ax-body hover:bg-ax-raised border border-ax-border"
          >
            <NavIcon name="menu" size={20} tone="inherit" />
          </button>
          <Link href="/" className="flex items-center gap-4">
            <Image src={AxyraBotPFP} alt="AxyraBot logo" width={32} height={32} className="rounded-full" />
            <div className="font-display text-xl font-semibold tracking-tight">
              <span className="text-ax-accent-text">Axyra</span>
              <span className="text-ax-heading">Bot</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a href={primaryHref} className="hidden">{primaryLabel}</a>
          {isLoggedIn && (
            <>
              <ManagingChannelBadge />
              <Link
                href="/import"
                className="inline-flex items-center gap-1 rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-xs font-medium text-ax-body hover:bg-ax-raised hover:border-ax-muted transition"
              >
                <NavIcon name="import" size={16} tone="inherit" />
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-md bg-ax-section px-1.5 py-1 hover:bg-ax-raised transition"
                >
                  {avatarUrl && (
                    <Image src={avatarUrl} alt="Twitch profile picture" width={32} height={32} className="rounded-full" />
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-md border border-ax-border bg-ax-section py-2 ">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-left text-ax-body hover:bg-ax-raised"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 w-full flex-col items-stretch gap-3 px-3 pb-4 pt-3 md:flex-row md:gap-6 md:px-4 md:pb-6 md:pt-6 md:min-h-0">
        {mobileSidebarOpen && <button type="button" aria-label="Close dashboard menu" onClick={closeMobileSidebar} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
        <div className={responsiveSidebarClassName(sidebarOpen, mobileSidebarOpen)}>
          <div className="mb-3 flex items-center justify-between border-b border-ax-subtle px-2 pb-3 md:hidden">
            <span className="text-sm font-semibold text-ax-body">Dashboard menu</span>
            <button type="button" onClick={closeMobileSidebar} className="rounded-md px-2 py-1 text-sm text-ax-secondary hover:bg-ax-raised hover:text-ax-heading">Close</button>
          </div>
          <nav className="mt-1 flex flex-col gap-4 text-sm text-ax-body">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={mainSectionOpen} onClick={() => setMainSectionOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Main</span>
                ) : (
                  <>
                    <span className="sr-only">Main</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={mainSectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {mainSectionOpen && (
                <>
                  <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/dashboard"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="dashboard" />{sidebarOpen ? <span>Dashboard</span> : <span className="sr-only">Dashboard</span>}
                  </Link>
                  <Link href="/commands" aria-current={pathname === "/commands" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/commands"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="commands" />{sidebarOpen ? <span>Commands</span> : <span className="sr-only">Commands</span>}
                  </Link>
                </>
              )}
            </div>
            {/* Moderation section */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={moderationOpen} onClick={() => setModerationOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Moderation</span>
                ) : (
                  <>
                    <span className="sr-only">Moderation</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={moderationOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {moderationOpen && (
                <>
                  <Link href="/moderation/blocked-terms" aria-current={pathname === "/moderation/blocked-terms" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/moderation/blocked-terms"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="blockedTerms" />{sidebarOpen ? <span>Blocked Terms</span> : <span className="sr-only">Blocked Terms</span>}
                  </Link>
                  <Link href="/moderation/spam-filters" aria-current={pathname === "/moderation/spam-filters" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/moderation/spam-filters"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="spamFilters" />{sidebarOpen ? <span>Spam Filters</span> : <span className="sr-only">Spam Filters</span>}
                  </Link>
                </>
              )}
            </div>
            {/* Vanity section */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={vanitySectionOpen} onClick={() => setVanitySectionOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Vanity</span>
                ) : (
                  <>
                    <span className="sr-only">Vanity</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={vanitySectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {vanitySectionOpen && (
                <>
                  <Link href="/modules" aria-current={pathname === "/modules" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/modules"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="modules" />{sidebarOpen ? <span>Modules</span> : <span className="sr-only">Modules</span>}
                  </Link>
                  <Link href="/birthdays" aria-current={pathname === "/birthdays" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/birthdays"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="birthdays" />{sidebarOpen ? <span>Birthdays</span> : <span className="sr-only">Birthdays</span>}
                  </Link>
                  <Link href="/giveaways" aria-current={pathname === "/giveaways" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/giveaways"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="giveaways" />{sidebarOpen ? <span>Giveaways</span> : <span className="sr-only">Giveaways</span>}
                  </Link>
                  {!isEditor && (
                    <Link href="/roles" aria-current={pathname === "/roles" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/roles"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                      <NavIcon name="roles" />{sidebarOpen ? <span>Roles</span> : <span className="sr-only">Roles</span>}
                    </Link>
                  )}
                </>
              )}
            </div>
            {/* Integrations section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                {sidebarOpen ? (
                  <span>Integrations</span>
                ) : (
                  <>
                    <span className="sr-only">Integrations</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
              </button>
              <Link href="/discord/settings" aria-current={pathname === "/discord/settings" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/discord/settings"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                <NavIcon name="discord" />{sidebarOpen ? <span>Discord</span> : <span className="sr-only">Discord</span>}
              </Link>
            </div>
            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={otherSectionOpen} onClick={() => setOtherSectionOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Other</span>
                ) : (
                  <>
                    <span className="sr-only">Other</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={otherSectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {otherSectionOpen && (
                <>
                  <Link href="/privacy" aria-current={pathname === "/privacy" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/privacy"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="privacy" />{sidebarOpen ? <span>Privacy</span> : <span className="sr-only">Privacy</span>}
                  </Link>
                  <Link href="/terms" aria-current={pathname === "/terms" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/terms"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="terms" />{sidebarOpen ? <span>Terms</span> : <span className="sr-only">Terms</span>}
                  </Link>
                  <Link href="/docs" aria-current={pathname === "/docs" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/docs"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="docs" />{sidebarOpen ? <span>Docs</span> : <span className="sr-only">Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 text-ax-heading min-h-0">

          {/* ── No servers yet ── */}
          {!loadingGuilds && guilds.length === 0 && (
            <div className="w-full flex flex-col rounded-md border border-ax-subtle bg-ax-section p-8 items-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40">
                <img src="/DiscordLogo.png" alt="Discord" className="h-12 w-12 brightness-0 invert" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-ax-body">Connect your Discord server</h2>
                <p className="text-sm text-ax-secondary max-w-sm">
                  Add AxyraBot to your Discord server to enable live notifications, mod alerts, birthday announcements, and slash commands.
                </p>
              </div>
              <button
                type="button"
                onClick={() => startDiscordAuth(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-ax-heading hover:bg-[#4752c4] transition "
              >
                <img src="/DiscordLogo.png" alt="Discord" className="h-5 w-5 brightness-0 invert" />
                Add to Discord
              </button>
              {viewerLogin && (
                <p className="text-sm text-ax-secondary">
                  {discordLinked
                    ? "Your Discord account is connected, but you aren't an admin in any server AxyraBot is in. "
                    : "AxyraBot already in your server? "}
                  <button type="button" onClick={() => startDiscordAuth(false)} className="font-medium text-[#8b95f7] hover:underline">
                    {discordLinked ? "Switch Discord account" : "Sign in with Discord"}
                  </button>
                </p>
              )}
              {discordAuthError && <p className="text-sm text-red-300">{discordAuthError}</p>}
            </div>
          )}

          {/* ── Loading state ── */}
          {loadingGuilds && (
            <div className="w-full flex flex-col rounded-md border border-ax-subtle bg-ax-section p-8 items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-ax-border border-t-accent" />
              <p className="text-sm text-ax-muted">Checking Discord servers…</p>
            </div>
          )}

          {/* ── Bot is in at least one server ── */}
          {!loadingGuilds && guilds.length > 0 && (
            <div className="w-full flex flex-col rounded-md border border-ax-subtle bg-ax-section overflow-hidden flex-1 min-h-0">

              {/* Content header — Add to Discord button + server switcher */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-ax-subtle">
                <h1 className="text-2xl font-semibold text-ax-body">Discord Integration</h1>

                <div className="flex items-center gap-3">
                  {/* Add to Discord — always shown here, single instance */}
                  <button
                    type="button"
                    onClick={() => startDiscordAuth(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] px-3 py-2 text-sm font-medium text-ax-heading hover:bg-[#4752c4] transition "
                  >
                    <img src="/DiscordLogo.png" alt="Discord" className="h-5 w-5 shrink-0 brightness-0 invert" />
                    Add to Discord
                  </button>

                  {/* Server switcher */}
                  <div className="relative" ref={serverDropdownRef}>
                  <button
                    type="button"
                    aria-expanded={serverDropdownOpen} onClick={() => setServerDropdownOpen((o) => !o)}
                    className="flex items-center gap-2.5 rounded-md border border-ax-border bg-ax-section px-3 py-2 hover:bg-ax-raised transition"
                  >
                    {(() => {
                      const guild = guilds.find((g) => g.id === selectedGuildId);
                      return guild ? (
                        <>
                          {guild.icon ? (
                            <Image src={guild.icon} alt={guild.name} width={28} height={28} className="rounded-full" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-ax-heading shrink-0">
                              {guild.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-ax-body max-w-[160px] truncate">{guild.name}</span>
                        </>
                      ) : (
                        <span className="text-sm text-ax-secondary">Select a server</span>
                      );
                    })()}
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-4 w-4 text-ax-secondary transition-transform shrink-0 ${serverDropdownOpen ? "rotate-180" : ""}`}
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {serverDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-md border border-ax-border bg-ax-section shadow-xl py-1">
                      {guilds.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGuildId(g.id);
                            setServerDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-ax-raised transition ${
                            g.id === selectedGuildId ? "text-ax-accent-text font-medium" : "text-ax-body"
                          }`}
                        >
                          {g.icon ? (
                            <Image src={g.icon} alt={g.name} width={24} height={24} className="rounded-full shrink-0" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-ax-heading shrink-0">
                              {g.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{g.name}</span>
                          {g.id === selectedGuildId && (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-4 w-4 shrink-0 text-ax-accent-text">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </div> {/* end flex items-center gap-3 */}
              </div> {/* end content header */}

              <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1 min-h-0">
                {/* ── Two-column layout when a guild is selected ── */}
                {selectedGuildId ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">

                    {/* LEFT — Channel Notifications */}
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Channel Notifications</p>
                        <p className="text-xs text-ax-muted">Choose which Discord channels receive each type of notification.</p>
                      </div>

                      {loadingChannels ? (
                        <div className="flex items-center gap-3 py-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ax-border border-t-accent" />
                          <span className="text-sm text-ax-muted">Loading channels…</span>
                        </div>
                      ) : (
                          <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                                <span className="h-2 w-2 rounded-full bg-red-400" /> Live Notification
                              </label>
                              <button type="button" onClick={() => { setEditingNotif("live"); setEditDraft(templates.live || defaultTemplates.live); setTemplateSaveSuccess(false); setTemplateSaveError(null); }} className="text-xs text-ax-accent-text hover:underline">Edit message</button>
                            </div>
                            <p className="text-xs text-ax-muted">Posted in this channel when you go live on Twitch.</p>
                            <select value={liveChannelId} onChange={(e) => setLiveChannelId(e.target.value)} className={channelSelectClass}>
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                                <Gavel aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Mod Alerts
                              </label>
                              <button type="button" onClick={() => { setEditingNotif("mod"); setEditDraft(templates.mod || defaultTemplates.mod); setTemplateSaveSuccess(false); setTemplateSaveError(null); }} className="text-xs text-ax-accent-text hover:underline">Edit message</button>
                            </div>
                            <p className="text-xs text-ax-muted">Ban and timeout events from your Twitch channel.</p>
                            <select value={modChannelId} onChange={(e) => setModChannelId(e.target.value)} className={channelSelectClass}>
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          <section className="flex flex-col gap-2 border-t border-ax-subtle pt-4">
                            <label className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                              <ShieldCheck aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Discord Mod Logs
                            </label>
                            <p className="text-xs text-ax-muted">
                              Log moderation and server changes separately from Twitch mod alerts. Give AxyraBot View Audit Log permission for moderator details.
                            </p>
                            <select
                              value={modLogChannelId}
                              onChange={(e) => setModLogChannelId(e.target.value)}
                              className={channelSelectClass}
                            >
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                            {modLogChannelId && (
                              <div className="flex items-center justify-between gap-3 pt-2">
                                <span className="text-xs text-ax-secondary">
                                  {modLogEvents.filter((event) => discordModLogOptions.some((option) => option.key === event)).length} event types selected
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModLogEventsDraft([...modLogEvents]);
                                    setEditingModLogOptions(true);
                                  }}
                                  className="text-xs text-ax-accent-text hover:underline"
                                >
                                  Edit options
                                </button>
                              </div>
                            )}
                          </section>

                          <section className="flex flex-col gap-2 border-t border-ax-subtle pt-4">
                            <label className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                              <BotOff aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Honeypot
                            </label>
                            <p className="text-xs text-amber-300/80">
                              Anyone other than AxyraBot or a webhook that posts here is immediately banned. Their messages are removed across channels the bot can access; the ban also deletes up to 7 days of recent server messages. Grant Ban Members, Manage Messages, View Channel, and Read Message History across channels. Private threads the bot cannot access cannot be cleared.
                            </p>
                            <select
                              value={honeypotChannelId}
                              onChange={(e) => setHoneypotChannelId(e.target.value)}
                              className={channelSelectClass}
                            >
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </section>

                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                                <Cake aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Birthday Announcements
                              </label>
                              <button type="button" onClick={() => { setEditingNotif("birthday"); setEditDraft(templates.birthday || defaultTemplates.birthday); setTemplateSaveSuccess(false); setTemplateSaveError(null); }} className="text-xs text-ax-accent-text hover:underline">Edit message</button>
                            </div>
                            <p className="text-xs text-ax-muted">Posted at midnight in your configured timezone when there are birthdays today.</p>
                            <select value={bdayChannelId} onChange={(e) => setBdayChannelId(e.target.value)} className={channelSelectClass}>
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                            <label className="mt-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Birthday list source</label>
                            <p className="text-xs text-ax-muted">Choose which saved birthday list to announce here — your own, or one shared with you.</p>
                            <select
                              value={bdaySourceLogin}
                              onChange={(e) => setBdaySourceLogin(e.target.value)}
                              className={channelSelectClass}
                            >
                              <option value="">Use my own list ({channelLogin || "your Twitch login"})</option>
                              {bdaySourceLogin && !bdaySourceListOptions.some((o) => o.value === bdaySourceLogin) && (
                                <option value={bdaySourceLogin}>{bdaySourceLogin}</option>
                              )}
                              {bdaySourceListOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                        </div>
                      )}

                      {/* Save row */}
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving || !channelLogin || loadingSettings}
                          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {saving ? "Saving…" : "Save Settings"}
                        </button>
                        {saveSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Saved!</span>}
                        {saveError && <span className="text-sm text-red-300">{saveError}</span>}
                      </div>

                      {/* ── Reaction Roles ── */}
                      <div className="border-t border-ax-subtle pt-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary"><SmilePlus aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Reaction Roles</p>
                            <p className="text-xs text-ax-muted mt-0.5">Post a panel — members react to gain or lose roles automatically.</p>
                          </div>
                          <button
                            type="button"
                            onClick={openNewReactionPanel}
                            className="rounded-md bg-accent/10 border border-accent/30 px-3 py-1.5 text-xs font-medium text-ax-accent-text hover:bg-accent/20 transition"
                          >
                            + New Panel
                          </button>
                        </div>

                        {rrPanels.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {rrPanels.map((panel) => (
                              <div key={panel.id} className="flex items-start justify-between rounded-md bg-ax-raised border border-ax-border px-4 py-3 gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ax-body truncate">{panel.title}</p>
                                  <p className="text-xs text-ax-muted mt-0.5">{panel.entries.length} role{panel.entries.length !== 1 ? "s" : ""} · ch <span className="font-mono text-ax-secondary">{panel.channel_id}</span></p>
                                  {panel.entries.map((e, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 mr-2 mt-1 text-xs text-ax-secondary">
                                      {e.emoji} <span className="text-ax-muted">{e.role_name || e.role_id}</span>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button type="button" onClick={() => openEditReactionPanel(panel)} className="text-xs text-ax-accent-text hover:text-ax-accent-text transition">Edit / Resend</button>
                                  <button type="button" onClick={() => handleDeleteReactionPanel(panel.id)} className="text-xs text-red-300 hover:text-red-300 transition">Delete</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {rrSendSuccess && <p className="flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Panel sent successfully!</p>}

                        {rrFormOpen && (
                          <div className="rounded-md border border-ax-border bg-ax-raised p-5 flex flex-col gap-4">
                            <p className="text-sm font-semibold text-ax-body">{rrEditing ? "Edit Panel" : "New Panel"}</p>

                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-ax-secondary">Panel Title</label>
                              <input type="text" value={rrTitle} onChange={(e) => setRrTitle(e.target.value)} placeholder="React for Roles" className="rounded-md bg-ax-section border border-ax-border px-3 py-2 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:border-accent/60" />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-ax-secondary">Description</label>
                              <textarea rows={2} value={rrDescription} onChange={(e) => setRrDescription(e.target.value)} placeholder="React below to get a role!" className="rounded-md bg-ax-section border border-ax-border px-3 py-2 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:border-accent/60 resize-none" />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-ax-secondary">Post to Channel</label>
                              <select value={rrChannelId} onChange={(e) => setRrChannelId(e.target.value)} className="rounded-md bg-ax-section border border-ax-border px-3 py-2 text-sm text-ax-body focus:outline-none focus:border-accent/60">
                                <option value="">— Select channel —</option>
                                {guildChannels.map((ch) => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                              </select>
                            </div>

                            <div className="flex flex-col gap-2">
                              <label className="text-xs text-ax-secondary">Emoji → Role Entries</label>
                              {rrEntries.map((entry, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <select
                                    value={entry.emoji}
                                    onChange={(e) => { const next = [...rrEntries]; next[i] = { ...next[i], emoji: e.target.value }; setRrEntries(next); }}
                                    className="w-32 rounded-md bg-ax-section border border-ax-border px-3 py-2 text-sm text-ax-body focus:outline-none focus:border-accent/60"
                                  >
                                    <option value="">— Emoji —</option>
                                    {[
                                      ["✅","✅ Check"],["❌","❌ X"],["⭐","⭐ Star"],["🔥","🔥 Fire"],
                                      ["🎮","🎮 Gaming"],["🎵","🎵 Music"],["🎨","🎨 Art"],["📸","📸 Photo"],
                                      ["📺","📺 TV / Stream"],["🏆","🏆 Trophy"],["💎","💎 Diamond"],["👑","👑 Crown"],
                                      ["🐺","🐺 Wolf"],["🦊","🦊 Fox"],["🐱","🐱 Cat"],["🐸","🐸 Frog"],
                                      ["🌙","🌙 Moon"],["☀️","☀️ Sun"],["❄️","❄️ Ice"],["⚡","⚡ Lightning"],
                                      ["🎲","🎲 Dice"],["🎭","🎭 Theatre"],["🎯","🎯 Target"],["🚀","🚀 Rocket"],
                                      ["💬","💬 Chat"],["📢","📢 Announce"],["🔔","🔔 Bell"],["🔇","🔇 Muted"],
                                      ["👋","👋 Wave"],["🤝","🤝 Handshake"],["💪","💪 Flex"],["🙌","🙌 Hands"],
                                      ["1️⃣","1️⃣ One"],["2️⃣","2️⃣ Two"],["3️⃣","3️⃣ Three"],["4️⃣","4️⃣ Four"],
                                      ["🅰️","🅰️ A"],["🅱️","🅱️ B"],["🆒","🆒 Cool"],["🆕","🆕 New"],
                                    ].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                                  </select>
                                  <select
                                    value={entry.role_id}
                                    onChange={(e) => { const selected = guildRoles.find((r) => r.id === e.target.value); const next = [...rrEntries]; next[i] = { ...next[i], role_id: e.target.value, role_name: selected?.name ?? "" }; setRrEntries(next); }}
                                    className="flex-1 rounded-md bg-ax-section border border-ax-border px-3 py-2 text-sm text-ax-body focus:outline-none focus:border-accent/60"
                                  >
                                    <option value="">— Select role —</option>
                                    {guildRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                                  </select>
                                  <button type="button" onClick={() => setRrEntries((prev) => prev.filter((_, idx) => idx !== i))} className="rounded p-0.5 text-ax-muted transition hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ax-focus" aria-label="Remove entry"><X aria-hidden="true" strokeWidth={1.75} size={16} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => setRrEntries((prev) => [...prev, { emoji: "", role_id: "", role_name: "" }])} className="self-start text-xs text-ax-accent-text hover:text-ax-accent-text transition mt-1">+ Add Entry</button>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap pt-1">
                              <button type="button" onClick={handleSendReactionPanel} disabled={rrSending || !rrChannelId} className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed">
                                {rrSending ? "Sending…" : rrEditing ? "Resend Panel" : "Send Panel"}
                              </button>
                              <button type="button" onClick={() => { setRrFormOpen(false); setRrEditing(null); setRrSendError(null); }} className="rounded-md border border-ax-border px-5 py-2 text-sm font-medium text-ax-secondary hover:bg-ax-raised transition">Cancel</button>
                              {rrSendError && <span className="text-sm text-red-300">{rrSendError}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT — Role Mappings */}
                    <div className="flex flex-col gap-4 justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Role Mappings</p>
                        <p className="text-xs text-ax-muted">
                          Match Discord roles to Twitch permission levels. Members with the assigned role will be treated as that level when using bot commands in this server.
                        </p>
                      </div>

                      {loadingRoles ? (
                        <div className="flex items-center gap-2 text-sm text-ax-muted">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ax-border border-t-accent" />
                          Loading roles…
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {(["owner", "moderator", "vip"] as const).map((level) => {
                            const labels: Record<string, { label: string; desc: string; color: string }> = {
                              owner:     { label: "Owner",     desc: "Full broadcaster access",  color: "bg-red-500" },
                              moderator: { label: "Mods",      desc: "Moderator-level commands", color: "bg-blue-500" },
                              vip:       { label: "VIP",       desc: "VIP-level commands",       color: "bg-purple-500" },
                            };
                            const meta = labels[level];
                            const selectedRole = guildRoles.find((r) => r.id === roleMap[level]);
                            const roleColor = selectedRole && selectedRole.color !== 0
                              ? `#${selectedRole.color.toString(16).padStart(6, "0")}`
                              : null;
                            return (
                              <div key={level} className="flex flex-col gap-1.5 rounded-md border border-ax-border bg-ax-section p-3">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${meta.color} shrink-0`} />
                                  <span className="text-xs font-semibold text-ax-body">{meta.label}</span>
                                  <span className="text-xs text-ax-muted">— {meta.desc}</span>
                                </div>
                                <select
                                  value={roleMap[level]}
                                  onChange={(e) => setRoleMap((prev) => ({ ...prev, [level]: e.target.value }))}
                                  className={channelSelectClass + " w-full max-w-full"}
                                  style={roleColor ? { borderColor: roleColor + "66", color: roleColor } : undefined}
                                >
                                  <option value="">— No mapping —</option>
                                  {guildRoles.map((r) => {
                                    const hex = r.color !== 0 ? `#${r.color.toString(16).padStart(6, "0")}` : undefined;
                                    return (
                                      <option key={r.id} value={r.id} style={hex ? { color: hex } : undefined}>
                                        {r.name}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-4 pt-1">
                        <button
                          type="button"
                          onClick={handleSaveRoles}
                          disabled={savingRoles || !channelLogin || !selectedGuildId}
                          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {savingRoles ? "Saving…" : "Save Roles"}
                        </button>
                        {roleSaveSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Saved!</span>}
                        {roleSaveError && <span className="text-sm text-red-300">{roleSaveError}</span>}
                      </div>

                      {/* ── Welcome & Auto-Roles ── */}
                      <div className="mt-4 flex flex-col gap-3 rounded-md border border-ax-border bg-ax-section p-4">
                        <div className="flex flex-col gap-0.5">
                          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Welcome & Auto-Roles</p>
                          <p className="text-xs text-ax-muted">Send a message and/or assign roles to new members when they join the server.</p>
                        </div>

                        {/* Welcome channel */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-ax-secondary">Welcome channel</label>
                          <select
                            value={welcomeChannelId}
                            onChange={(e) => setWelcomeChannelId(e.target.value)}
                            className={channelSelectClass + " w-full"}
                          >
                            <option value="">— No welcome message —</option>
                            {guildChannels.map((c) => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Welcome message */}
                        {welcomeChannelId && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-ax-secondary">Welcome message</label>
                            <textarea
                              value={welcomeMessage}
                              onChange={(e) => setWelcomeMessage(e.target.value)}
                              rows={2}
                              placeholder="Welcome $(user) to $(server)!"
                              className="w-full rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60 resize-y"
                            />
                            <p className="text-xs text-ax-muted">Variables: <code className="text-ax-muted">$(user)</code> mention, <code className="text-ax-muted">$(username)</code> plain name, <code className="text-ax-muted">$(server)</code> server name.</p>
                          </div>
                        )}

                        {/* Welcome banner toggle */}
                        {welcomeChannelId && (
                          <div className="flex items-center justify-between rounded-md border border-ax-border bg-ax-section px-3 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-xs font-medium text-ax-body"><ImageIcon aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Welcome banner</span>
                              <span className="text-xs text-ax-muted">Send a graphic card with the user's avatar when they join.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setWelcomeBannerEnabled((v) => !v)}
                              aria-label={welcomeBannerEnabled ? "Disable banner" : "Enable banner"}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${welcomeBannerEnabled ? "bg-accent" : "bg-ax-border"}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${welcomeBannerEnabled ? "translate-x-4" : "translate-x-1"}`} />
                            </button>
                          </div>
                        )}

                        {/* Auto-assign roles */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-ax-secondary">Auto-assign roles on join</label>
                          {loadingRoles ? (
                            <div className="text-xs text-ax-muted">Loading roles…</div>
                          ) : guildRoles.length === 0 ? (
                            <div className="text-xs text-ax-muted">No roles found in this server.</div>
                          ) : (
                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                              {guildRoles.map((role) => {
                                const checked = autoRoleIds.includes(role.id);
                                const hex = role.color !== 0 ? `#${role.color.toString(16).padStart(6, "0")}` : undefined;
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    onClick={() =>
                                      setAutoRoleIds((prev) =>
                                        checked ? prev.filter((id) => id !== role.id) : [...prev, role.id]
                                      )
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium transition ${
 checked
 ? "border-accent bg-accent/20 text-ax-heading"
 : "border-ax-border bg-ax-raised text-ax-body hover:border-ax-muted"
 }`}
                                  >
                                    {hex && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />}
                                    {role.name}
                                    {checked && <Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-ax-accent-text" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Leave logs channel */}
                        <div className="flex flex-col gap-1 border-t border-ax-subtle pt-3 mt-1">
                          <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Leave Logs</label>
                          <p className="text-xs text-ax-muted">When a member leaves, post a message in this channel.</p>
                          <select
                            value={leaveChannelId}
                            onChange={(e) => setLeaveChannelId(e.target.value)}
                            className={channelSelectClass + " w-full mt-1"}
                          >
                            <option value="">— Disabled —</option>
                            {guildChannels.map((c) => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                          {leaveChannelId && (
                            <p className="text-xs text-ax-muted">Message format: <code className="text-ax-muted">USERNAME has left the server</code></p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveWelcome}
                            disabled={savingWelcome || !selectedGuildId}
                            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {savingWelcome ? "Saving…" : "Save Welcome"}
                          </button>
                          {welcomeSaveSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Saved!</span>}
                          {welcomeSaveError && <span className="text-sm text-red-300">{welcomeSaveError}</span>}
                        </div>
                      </div>
                    </div>

                  </div>
                ) : null}

                {/* ── Bot Modules ── */}
                {selectedGuildId && (
                <div className="border-t border-ax-subtle pt-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Bot Modules</p>
                    <p className="text-xs text-ax-muted">Click a module to configure individual commands and settings. Toggle the switch to enable or disable the entire module.</p>
                  </div>

                  {loadingModules ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ax-border border-t-accent" />
                      <span className="text-sm text-ax-muted">Loading modules…</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {discordModuleConfig.map((mod) => {
                        const enabled = guildModules[mod.key] !== false;
                        const isSaving = savingModule === mod.key;
                        const enabledCmds = mod.commands.filter((c) => guildModules[`cmd:${c.name}`] !== false).length;
                        return (
                          <button
                            key={mod.key}
                            type="button"
                            onClick={() => { setOpenModuleKey(mod.key); setPendingCmdSettings({ ...cmdSettings }); }}
                            className={`group flex flex-col rounded-md border text-left transition hover:border-accent/40 hover:bg-ax-raised ${
 enabled
 ? "border-ax-border bg-ax-section"
 : "border-ax-subtle bg-ax-section opacity-60"
 }`}
                          >
                            <div className="flex items-start gap-3 p-4">
                              <mod.icon aria-hidden="true" strokeWidth={1.75} size={20} className="mt-0.5 shrink-0 text-ax-secondary" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-ax-body group-hover:text-ax-heading">{mod.label}</span>
                                  {/* Module-level toggle — stop propagation so clicking it doesn't open the modal */}
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={enabled ? "Disable module" : "Enable module"}
                                    onClick={(e) => { e.stopPropagation(); if (!isSaving) handleModuleToggle(mod.key, !enabled); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); if (!isSaving) handleModuleToggle(mod.key, !enabled); } }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
 enabled ? "bg-emerald-500" : "bg-ax-border"
 } ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}`} />
                                  </span>
                                </div>
                                <p className="text-xs text-ax-muted mt-0.5 leading-relaxed line-clamp-2">{mod.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-ax-subtle px-4 py-2 text-xs text-ax-muted group-hover:text-ax-secondary transition">
                              <span>{enabledCmds} / {mod.commands.length} commands active</span>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition">
                                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}

                {/* ── Guild Access (channel owners only) ── */}
                {selectedGuildId && !isEditor && (
                  <div className="border-t border-ax-subtle pt-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Guild Access</p>
                      <p className="text-xs text-ax-muted">
                        Control which Twitch editors can view and manage this server&apos;s bot settings. Editors not listed here will not see this server at all.
                      </p>
                    </div>

                    {loadingManagers ? (
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-ax-border border-t-accent" />
                        <span className="text-sm text-ax-muted">Loading…</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {guildManagers.length === 0 ? (
                          <p className="text-xs text-ax-muted italic">No editors have been granted access to this server yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {guildManagers.map((m) => (
                              <div key={m} className="flex items-center gap-1.5 rounded-md border border-ax-border bg-ax-section px-3 py-1 text-xs text-ax-body">
                                <span>{m}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManager(m)}
                                  disabled={removingManager === m}
                                  className="ml-0.5 text-ax-muted hover:text-red-300 transition disabled:opacity-40"
                                  aria-label={`Remove ${m}`}
                                >
                                  {removingManager === m ? (
                                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-ax-muted border-t-slate-200" />
                                  ) : (
                                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add manager input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={addManagerInput}
                            onChange={(e) => setAddManagerInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddManager(); }}
                            placeholder="Twitch username"
                            className="rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60 w-48"
                          />
                          <button
                            type="button"
                            onClick={handleAddManager}
                            disabled={addingManager || !addManagerInput.trim()}
                            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {addingManager ? "Adding…" : "Add"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Ticket System ── */}
                {selectedGuildId && (
                  <div className="border-t border-ax-subtle pt-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary"><Ticket aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Ticket System</p>
                      <p className="text-xs text-ax-muted">
                        Configure the support ticket panel. Users click a button to open a private channel with selected support roles.
                      </p>
                    </div>

                    {loadingTicketConfig ? (
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-ax-border border-t-accent" />
                        <span className="text-sm text-ax-muted">Loading ticket config…</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5">
                        {/* Panel channel */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Panel Channel</label>
                          <p className="text-xs text-ax-muted">The channel where the ticket open button will be posted.</p>
                          <select
                            value={ticketPanelChannelId}
                            onChange={(e) => setTicketPanelChannelId(e.target.value)}
                            className={channelSelectClass}
                          >
                            <option value="">— Select a channel —</option>
                            {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                          </select>
                        </div>

                        {/* Log channel */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Log Channel <span className="font-normal text-ax-muted">(optional)</span></label>
                          <p className="text-xs text-ax-muted">Ticket open/close events will be logged here.</p>
                          <select
                            value={ticketLogChannelId}
                            onChange={(e) => setTicketLogChannelId(e.target.value)}
                            className={channelSelectClass}
                          >
                            <option value="">Disabled</option>
                            {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                          </select>
                        </div>

                        {/* Category */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Category <span className="font-normal text-ax-muted">(optional)</span></label>
                          <p className="text-xs text-ax-muted">Ticket channels will be created inside this category.</p>
                          <select
                            value={ticketCategoryId}
                            onChange={(e) => setTicketCategoryId(e.target.value)}
                            className={channelSelectClass}
                          >
                            <option value="">No category</option>
                            {guildCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        {/* Support roles */}
                        <div className="flex flex-col gap-1.5">
                          <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Support Roles</label>
                          <p className="text-xs text-ax-muted">These roles can see and respond to every ticket channel.</p>
                          {loadingRoles ? (
                            <span className="text-xs text-ax-muted">Loading roles…</span>
                          ) : (
                            <div className="flex flex-wrap gap-2 max-w-xl">
                              {guildRoles.filter((r) => r.name !== "@everyone").map((r) => {
                                const hex = r.color !== 0 ? `#${r.color.toString(16).padStart(6, "0")}` : undefined;
                                const selected = ticketSupportRoleIds.includes(r.id);
                                return (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setTicketSupportRoleIds((prev) =>
                                      selected ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                                    )}
                                    style={selected && hex ? { borderColor: hex, color: hex } : undefined}
                                    className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
 selected
 ? "border-accent bg-accent/10 text-ax-accent-text"
 : "border-ax-border bg-ax-section text-ax-secondary hover:border-ax-muted hover:text-ax-secondary"
 }`}
                                  >
                                    {selected && <Check aria-hidden="true" strokeWidth={1.75} size={14} className="mr-1 inline-block shrink-0 align-[-2px]" />}{r.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Panel title / body / button label */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Panel Title</label>
                            <input
                              type="text"
                              value={ticketPanelTitle}
                              onChange={(e) => setTicketPanelTitle(e.target.value)}
                              placeholder="Support Tickets"
                              className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Button Label</label>
                            <input
                              type="text"
                              value={ticketButtonLabel}
                              onChange={(e) => setTicketButtonLabel(e.target.value)}
                              placeholder="🎫 Open Ticket"
                              className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
                            />
                          </div>
                          <div className="sm:col-span-2 flex flex-col gap-1.5">
                            <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Panel Message</label>
                            <textarea
                              value={ticketPanelBody}
                              onChange={(e) => setTicketPanelBody(e.target.value)}
                              rows={2}
                              placeholder="Click the button below to open a support ticket."
                              className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60 resize-none"
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveTicketConfig}
                            disabled={savingTicketConfig || !selectedGuildId}
                            className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {savingTicketConfig ? "Saving…" : "Save Config"}
                          </button>
                          <button
                            type="button"
                            onClick={handleSendTicketPanel}
                            disabled={sendingPanel || !ticketPanelChannelId || !selectedGuildId}
                            className="rounded-md border border-accent/40 bg-accent/10 px-5 py-2 text-sm font-medium text-ax-accent-text hover:bg-accent/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {sendingPanel ? "Sending…" : "Send Panel"}
                          </button>
                          {ticketSaveSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Config saved!</span>}
                          {ticketSaveError && <span className="text-sm text-red-300">{ticketSaveError}</span>}
                          {sendPanelSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Panel sent!</span>}
                          {sendPanelError && <span className="text-sm text-red-300">{sendPanelError}</span>}
                        </div>

                        {/* Panel message link */}
                        {ticketPanelMessageId && ticketPanelChannelId && (
                          <p className="text-xs text-ax-muted">
                            Active panel message ID: <span className="font-mono text-ax-secondary">{ticketPanelMessageId}</span>
                            {" "}&mdash; sending a new panel posts a fresh message to the channel.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>
    </main>

    {/* ── Module config modal ── */}
    {openModuleKey && (() => {
      const mod = discordModuleConfig.find((m) => m.key === openModuleKey)!;
      const modEnabled = guildModules[mod.key] !== false;
      const isSavingMod = savingModule === mod.key;
      const hasDirty = mod.commands.some((c) =>
        (c.settings ?? []).some((s) => (pendingCmdSettings[s.key] ?? "") !== (cmdSettings[s.key] ?? ""))
      );
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpenModuleKey(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] rounded-md border border-ax-border bg-ax-section shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-ax-subtle shrink-0">
              <div className="flex items-center gap-3">
                <mod.icon aria-hidden="true" strokeWidth={1.75} size={24} className="shrink-0 text-ax-secondary" />
                <div>
                  <p className="text-sm font-semibold text-ax-body">{mod.label} Module</p>
                  <p className="text-xs text-ax-muted">{mod.commands.length} commands · click a command to toggle it on or off</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Module-level toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ax-secondary">{modEnabled ? "Enabled" : "Disabled"}</span>
                  <button
                    type="button"
                    onClick={() => !isSavingMod && handleModuleToggle(mod.key, !modEnabled)}
                    disabled={isSavingMod}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${modEnabled ? "bg-emerald-500" : "bg-ax-border"} ${isSavingMod ? "opacity-50" : ""}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${modEnabled ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </div>
                <button type="button" onClick={() => setOpenModuleKey(null)} className="rounded-md p-1.5 text-ax-secondary hover:text-ax-body hover:bg-ax-raised transition">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                </button>
              </div>
            </div>

            {/* Command list — scrollable */}
            <div className="flex-1 overflow-y-auto divide-y divide-ax-subtle">
              {mod.commands.map((cmd) => {
                const cmdKey = `cmd:${cmd.name}`;
                const cmdEnabled = guildModules[cmdKey] !== false;
                const hasSettings = (cmd.settings?.length ?? 0) > 0;
                return (
                  <div key={cmd.name} className={`px-6 py-4 flex flex-col gap-3 transition ${cmdEnabled ? "" : "opacity-50"}`}>
                    {/* Command row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <code className="shrink-0 mt-0.5 rounded bg-ax-raised px-2 py-0.5 text-xs font-mono text-ax-accent-text">/{cmd.name}</code>
                        <span className="text-sm text-ax-secondary leading-relaxed">{cmd.description}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCmdToggle(cmd.name, !cmdEnabled)}
                        className={`relative shrink-0 mt-0.5 inline-flex h-5 w-9 items-center rounded-full transition-colors ${cmdEnabled ? "bg-emerald-500" : "bg-ax-border"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${cmdEnabled ? "translate-x-4" : "translate-x-1"}`} />
                      </button>
                    </div>

                    {/* Per-command settings (only shown when command is enabled) */}
                    {hasSettings && cmdEnabled && (
                      <div className="ml-0 flex flex-col gap-3 pl-4 border-l border-ax-border">
                        {(cmd.settings ?? []).map((field) => {
                          const currentVal = pendingCmdSettings[field.key] ?? field.defaultValue ?? "";
                          const isToggle = field.type === "toggle";
                          const isTrueVal = currentVal === "true";
                          return (
                            <div key={field.key} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-ax-secondary">{field.label}</span>
                                  {field.description && <span className="text-xs text-ax-muted">{field.description}</span>}
                                </div>
                                {isToggle && (
                                  <button
                                    type="button"
                                    onClick={() => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: isTrueVal ? "false" : "true" }))}
                                    className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${isTrueVal ? "bg-emerald-500" : "bg-ax-border"}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${isTrueVal ? "translate-x-4" : "translate-x-1"}`} />
                                  </button>
                                )}
                              </div>
                              {field.type === "number" && (
                                <input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  value={currentVal}
                                  placeholder={field.placeholder}
                                  onChange={(e) => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-40 rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                />
                              )}
                              {field.type === "text" && (
                                <input
                                  type="text"
                                  value={currentVal}
                                  placeholder={field.placeholder}
                                  onChange={(e) => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full max-w-xs rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                />
                              )}
                              {field.type === "select" && (
                                <select
                                  value={currentVal}
                                  onChange={(e) => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-48 rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                >
                                  {(field.options ?? []).map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-ax-subtle bg-ax-section shrink-0">
              <p className="text-xs text-ax-muted">Command toggles save instantly. Click Save for settings changes.</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpenModuleKey(null)} className="rounded-md border border-ax-border px-4 py-1.5 text-sm text-ax-secondary hover:bg-ax-raised transition">
                  Close
                </button>
                {hasDirty && (
                  <button
                    type="button"
                    onClick={handleSaveCmdSettings}
                    disabled={savingCmdSettings}
                    className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingCmdSettings ? "Saving…" : "Save Settings"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Ticket roles / category modal ── */}
    {editingTicketRoles && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditingTicketRoles(false)}>
        <div className="w-full max-w-md rounded-md border border-ax-border bg-ax-section shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ax-subtle">
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-ax-body"><Ticket aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" /> Ticket Channel Settings</p>
              <p className="text-xs text-ax-muted">Choose the category and roles attached to every created ticket channel.</p>
            </div>
            <button type="button" onClick={() => setEditingTicketRoles(false)} className="rounded-md p-1.5 text-ax-secondary hover:text-ax-body hover:bg-ax-raised transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </div>

          {/* Category picker */}
          <div className="flex flex-col gap-4 px-5 pt-5">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Category</label>
              <p className="text-xs text-ax-muted">Ticket channels will be created inside this category. Leave blank for no category.</p>
              <select
                value={ticketCategoryId}
                onChange={(e) => setTicketCategoryId(e.target.value)}
                className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60 w-full"
              >
                <option value="">No category</option>
                {guildCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Support roles */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">Support Roles</label>
              <p className="text-xs text-ax-muted">These roles can see and respond to every ticket channel. Toggle to select.</p>
              {loadingRoles ? (
                <span className="text-xs text-ax-muted">Loading roles…</span>
              ) : guildRoles.filter((r) => r.name !== "@everyone").length === 0 ? (
                <span className="text-xs text-ax-muted">No roles found.</span>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pb-1">
                  {guildRoles.filter((r) => r.name !== "@everyone").map((r) => {
                    const hex = r.color !== 0 ? `#${r.color.toString(16).padStart(6, "0")}` : undefined;
                    const selected = ticketSupportRoleIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setTicketSupportRoleIds((prev) =>
                          selected ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                        )}
                        style={selected && hex ? { borderColor: hex, color: hex } : undefined}
                        className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
 selected
 ? "border-accent bg-accent/10 text-ax-accent-text"
 : "border-ax-border bg-ax-section text-ax-secondary hover:border-ax-muted hover:text-ax-secondary"
 }`}
                      >
                        {selected && <Check aria-hidden="true" strokeWidth={1.75} size={14} className="mr-1 inline-block shrink-0 align-[-2px]" />}{r.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 mt-4 border-t border-ax-subtle bg-ax-section">
            <div className="flex items-center gap-3">
              {ticketRoleSaveSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Saved!</span>}
              {ticketRoleSaveError && <span className="text-sm text-red-300">{ticketRoleSaveError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingTicketRoles(false)} className="rounded-md border border-ax-border px-4 py-1.5 text-sm text-ax-secondary hover:bg-ax-raised transition">
                Cancel
              </button>
              <button
                type="button"
                disabled={ticketRoleSaving || !selectedGuildId}
                onClick={async () => {
                  if (!selectedGuildId) return;
                  setTicketRoleSaving(true);
                  setTicketRoleSaveError(null);
                  setTicketRoleSaveSuccess(false);
                  try {
                    const res = await fetch(`${backendUrl}/discord/tickets/config`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        guild_id: selectedGuildId,
                        panel_channel_id: ticketPanelChannelId,
                        log_channel_id: ticketLogChannelId,
                        category_id: ticketCategoryId,
                        support_role_ids: ticketSupportRoleIds,
                        panel_title: ticketPanelTitle,
                        panel_body: ticketPanelBody,
                        button_label: ticketButtonLabel,
                      }),
                    });
                    if (!res.ok) {
                      setTicketRoleSaveError("Failed to save.");
                    } else {
                      setTicketRoleSaveSuccess(true);
                      setTimeout(() => { setTicketRoleSaveSuccess(false); setEditingTicketRoles(false); }, 1200);
                    }
                  } catch {
                    setTicketRoleSaveError("Network error.");
                  } finally {
                    setTicketRoleSaving(false);
                  }
                }}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ticketRoleSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Notification template edit modal ── */}
    {editingNotif && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-md border border-ax-border bg-ax-section shadow-2xl flex flex-col gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ax-subtle">
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-ax-body">
                <Pencil aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0 text-ax-secondary" />
                {editingNotif === "live" && "Edit Live Notification"}
                {editingNotif === "mod" && "Edit Mod Alert"}
                {editingNotif === "birthday" && "Edit Birthday Announcement"}
              </p>
              <p className="text-xs text-ax-muted">Customize the Discord message. Leave blank to use the default.</p>
            </div>
            <button type="button" onClick={() => setEditingNotif(null)} className="rounded-md p-1.5 text-ax-secondary hover:text-ax-body hover:bg-ax-raised transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </div>

          {/* Template textarea */}
          <div className="flex flex-col gap-2 px-5 pt-4">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={4}
              placeholder={defaultTemplates[editingNotif]}
              className="w-full rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body font-mono placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60 resize-y"
            />
            <button
              type="button"
              onClick={() => setEditDraft(defaultTemplates[editingNotif])}
              className="self-start text-xs text-ax-muted hover:text-ax-secondary transition"
            >
              Reset to default
            </button>
          </div>

          {/* Variables reference */}
          <div className="px-5 pt-3 pb-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-muted mb-2">Available variables</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {templateVars[editingNotif].map(({ name, desc }) => (
                <div key={name} className="flex items-baseline gap-2">
                  <code
                    className="shrink-0 rounded bg-ax-raised px-1.5 py-0.5 text-xs font-mono text-ax-accent-text cursor-pointer hover:bg-ax-raised transition"
                    title="Click to insert"
                    onClick={() => setEditDraft((d) => d + name)}
                  >
                    {name}
                  </code>
                  <span className="text-xs text-ax-muted truncate">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Role mentions */}
          <div className="px-5 pt-2 pb-1">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-muted mb-2">Mention a role</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {/* @everyone is always available */}
              <button
                type="button"
                title="Insert @everyone"
                onClick={() => setEditDraft((d) => d + "@everyone")}
                className="inline-flex items-center gap-1 rounded-md border border-ax-border bg-ax-raised px-2.5 py-0.5 text-xs font-medium text-ax-body hover:bg-ax-raised transition"
              >
                @everyone
              </button>
              {guildRoles.map((role) => {
                  const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : undefined;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      title={`Insert <@&${role.id}>`}
                      onClick={() => setEditDraft((d) => d + `<@&${role.id}>`)}
                      className="inline-flex items-center gap-1 rounded-md border border-ax-border bg-ax-raised px-2.5 py-0.5 text-xs font-medium text-ax-body hover:bg-ax-raised transition"
                    >
                      {hex && (
                        <span
                          className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                      )}
                      @{role.name}
                    </button>
                  );
                })}
              </div>
            </div>

          {/* Discord markdown tip */}
          <div className="px-5 py-3">
            <p className="text-xs text-ax-muted">
              Supports Discord markdown: <code className="text-ax-muted">**bold**</code>, <code className="text-ax-muted">*italic*</code>, <code className="text-ax-muted">`code`</code>, newlines with{" "}
              <code className="text-ax-muted">\n</code> in the template text.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-ax-subtle bg-ax-section">
            <div className="flex items-center gap-3">
              {templateSaveSuccess && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><Check aria-hidden="true" strokeWidth={1.75} size={16} className="shrink-0" />Saved!</span>}
              {templateSaveError && <span className="text-sm text-red-300">{templateSaveError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingNotif(null)} className="rounded-md border border-ax-border px-4 py-1.5 text-sm text-ax-secondary hover:bg-ax-raised transition">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !channelLogin}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingTemplate ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {editingModLogOptions && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="discord-mod-log-options-title"
          className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-ax-border bg-ax-section shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-ax-subtle px-5 py-4">
            <div>
              <h2 id="discord-mod-log-options-title" className="text-sm font-semibold text-ax-body">
                Edit Discord mod-log options
              </h2>
              <p className="mt-1 text-xs text-ax-muted">Choose which events appear in the selected log channel.</p>
            </div>
            <button
              type="button"
              aria-label="Close mod-log options"
              onClick={() => setEditingModLogOptions(false)}
              className="rounded-md p-1.5 text-ax-secondary transition hover:bg-ax-raised hover:text-ax-body"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </header>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 overflow-y-auto px-5 py-5 sm:grid-cols-2">
            {discordModLogOptions.map((option) => {
              const checked = modLogEventsDraft.includes(option.key);
              return (
                <label key={option.key} className="flex cursor-pointer items-start gap-2 text-sm text-ax-secondary">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setModLogEventsDraft((current) =>
                      checked
                        ? current.filter((event) => event !== option.key)
                        : [...current, option.key]
                    )}
                    className="mt-0.5 accent-ax-accent"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          <footer className="flex flex-col-reverse gap-3 border-t border-ax-subtle bg-ax-section px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ax-muted">Press Save Settings on the page to store these selections.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingModLogOptions(false)}
                className="rounded-md border border-ax-border px-4 py-2 text-sm text-ax-secondary transition hover:bg-ax-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setModLogEvents([...modLogEventsDraft]);
                  setEditingModLogOptions(false);
                }}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ax-btn-text transition hover:bg-ax-btn-hover"
              >
                Apply
              </button>
            </div>
          </footer>
        </section>
      </div>
    )}
    </>
  );
}
