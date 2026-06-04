"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
const discordClientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "";

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
type ModuleConfig = { key: string; icon: string; label: string; description: string; commands: ModuleCommand[] };

const discordModuleConfig: ModuleConfig[] = [
  {
    key: "moderation",
    icon: "🛡️",
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
    icon: "⚙️",
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
    icon: "🎭",
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
    icon: "ℹ️",
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
    icon: "🎉",
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
    icon: "🏷️",
    label: "Tags",
    description: "Store and retrieve reusable text snippets. Great for FAQs, rules, or any custom response shortcut.",
    commands: [
      { name: "tag", description: "Get, create, edit, or delete a named text snippet." },
      { name: "tags", description: "List all tags saved in this server." },
    ],
  },
  {
    key: "giveaway",
    icon: "🎁",
    label: "Giveaway",
    description: "Full giveaway system with scheduled resolution, re-roll support, and winner announcements.",
    commands: [
      { name: "giveaway", description: "Start a giveaway, end it early, or re-roll winners." },
    ],
  },
];

export default function DiscordSettingsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [viewerLogin, setViewerLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [guildChannels, setGuildChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [liveChannelId, setLiveChannelId] = useState("");
  const [modChannelId, setModChannelId] = useState("");
  const [bdayChannelId, setBdayChannelId] = useState("");
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
    everyone: "", vip: "", moderator: "", owner: "",
  });
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleSaveSuccess, setRoleSaveSuccess] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null);

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
    mod:      "$(emoji) **[$(channel)]** `$(target)` was $(verb) by `$(moderator)`\nReason: $(reason)",
    birthday: "🎂 Happy Birthday to **$(names)** in **$(channel)**'s community! 🎉",
  };
  const templateVars: Record<NotifType, { name: string; desc: string }[]> = {
    live:     [{ name: "$(channel)", desc: "Your Twitch username" }, { name: "$(title)", desc: "Stream title" }, { name: "$(game)", desc: "Game / category" }],
    mod:      [{ name: "$(channel)", desc: "Your Twitch username" }, { name: "$(target)", desc: "The moderated user" }, { name: "$(moderator)", desc: "Who took the action" }, { name: "$(action)", desc: "Raw action: ban / timeout / delete" }, { name: "$(verb)", desc: "Past-tense verb (banned, timed out…)" }, { name: "$(emoji)", desc: "Action emoji" }, { name: "$(reason)", desc: "Reason text" }],
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
    setBdayChannelId("");
    fetch(`${backendUrl}/discord/settings?login=${encodeURIComponent(channelLogin)}&guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setLiveChannelId(data.live_channel_id ?? "");
          setModChannelId(data.mod_channel_id ?? "");
          setBdayChannelId(data.bday_channel_id ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [channelLogin, selectedGuildId]);

  // Fetch guilds the bot is in — filter server-side when viewing as an editor
  useEffect(() => {
    setLoadingGuilds(true);
    const params = new URLSearchParams();
    if (viewerLogin) params.set("viewer_login", viewerLogin);
    if (channelLogin) params.set("channel_login", channelLogin);
    fetch(`${backendUrl}/discord/guilds?${params}`)
      .then((r) => (r.ok ? r.json() : { guilds: [] }))
      .then((data) => setGuilds(data.guilds ?? []))
      .catch(() => setGuilds([]))
      .finally(() => setLoadingGuilds(false));
  }, [viewerLogin, channelLogin]);

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
    if (!channelLogin || !selectedGuildId) return;
    fetch(`${backendUrl}/discord/role-mappings?login=${encodeURIComponent(channelLogin)}&guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRoleMap({
            everyone: data.everyone?.discord_role_id ?? "",
            vip: data.vip?.discord_role_id ?? "",
            moderator: data.moderator?.discord_role_id ?? "",
            owner: data.owner?.discord_role_id ?? "",
          });
        } else {
          setRoleMap({ everyone: "", vip: "", moderator: "", owner: "" });
        }
      })
      .catch(() => {});
  }, [channelLogin, selectedGuildId]);

  // Load saved notification templates when channelLogin is set
  useEffect(() => {
    if (!channelLogin) return;
    fetch(`${backendUrl}/discord/notification-templates?login=${encodeURIComponent(channelLogin)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setTemplates({ live: data.live ?? "", mod: data.mod ?? "", birthday: data.birthday ?? "" });
      })
      .catch(() => {});
  }, [channelLogin]);

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
    if (!selectedGuildId) return;
    setLoadingTicketConfig(true);
    setTicketPanelMessageId("");
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
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
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
          bday_channel_id: bdayChannelId,
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
        body: JSON.stringify({ login: channelLogin, templates: { [editingNotif as string]: editDraft } }),
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
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const inviteUrl = discordClientId
    ? `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=3097326905453782&scope=bot%20applications.commands`
    : null;

  const botInSelectedGuild = guilds.some((g) => g.id === selectedGuildId);
  const channelSelectClass = "rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60 max-w-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
    <main className="h-screen overflow-hidden flex flex-col bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <header className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="mr-2 rounded-lg bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 border border-slate-700"
          >
            ☰
          </button>
          <Link href="/" className="flex items-center gap-4">
            <Image src={AxyraBotPFP} alt="AxyraBot logo" width={32} height={32} className="rounded-full" />
            <div className="text-2xl font-semibold tracking-tight">
              <span className="text-accent">Axyra</span>
              <span className="text-white">Bot</span>
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
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 hover:border-slate-500 transition"
              >
                <span className="text-xs">⬆</span>
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full bg-slate-900/80 px-1.5 py-1 hover:bg-slate-800 transition"
                >
                  {avatarUrl && (
                    <Image src={avatarUrl} alt="Twitch profile picture" width={32} height={32} className="rounded-full" />
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-slate-700 bg-slate-900/95 py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-left text-slate-200 hover:bg-slate-800"
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

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch min-h-0">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}>
          <nav className="mt-1 flex flex-col gap-4 text-sm text-slate-200">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setMainSectionOpen((o) => !o)} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
                <span>Main</span>
                {sidebarOpen && <span className="text-base font-bold">{mainSectionOpen ? "▾" : "▸"}</span>}
              </button>
              {mainSectionOpen && (
                <>
                  <Link href="/dashboard" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/dashboard" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">📊</span>{sidebarOpen && <span>Dashboard</span>}
                  </Link>
                  <Link href="/commands" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/commands" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">❓</span>{sidebarOpen && <span>Commands</span>}
                  </Link>
                </>
              )}
            </div>
            {/* Moderation section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setModerationOpen((o) => !o)} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
                <span>Moderation</span>
                {sidebarOpen && <span className="text-base font-bold">{moderationOpen ? "▾" : "▸"}</span>}
              </button>
              {moderationOpen && (
                <>
                  <Link href="/moderation/blocked-terms" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/moderation/blocked-terms" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">🚫</span>{sidebarOpen && <span>Blocked Terms</span>}
                  </Link>
                  <Link href="/moderation/spam-filters" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/moderation/spam-filters" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">🧹</span>{sidebarOpen && <span>Spam Filters</span>}
                  </Link>
                </>
              )}
            </div>
            {/* Vanity section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setVanitySectionOpen((o) => !o)} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
                <span>Vanity</span>
                {sidebarOpen && <span className="text-base font-bold">{vanitySectionOpen ? "▾" : "▸"}</span>}
              </button>
              {vanitySectionOpen && (
                <>
                  <Link href="/modules" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/modules" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">🧩</span>{sidebarOpen && <span>Modules</span>}
                  </Link>
                  <Link href="/birthdays" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/birthdays" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">🎂</span>{sidebarOpen && <span>Birthdays</span>}
                  </Link>
                  <Link href="/giveaways" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/giveaways" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">🎁</span>{sidebarOpen && <span>Giveaways</span>}
                  </Link>
                  {!isEditor && (
                    <Link href="/roles" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/roles" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                      <span className="text-lg">🎭</span>{sidebarOpen && <span>Roles</span>}
                    </Link>
                  )}
                </>
              )}
            </div>
            {/* Integrations section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Integrations</span>
              </button>
              <Link href="/discord" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/discord" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                <span className="text-lg">🎮</span>{sidebarOpen && <span>Discord</span>}
              </Link>
            </div>
            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setOtherSectionOpen((o) => !o)} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200">
                <span>Other</span>
                {sidebarOpen && <span className="text-base font-bold">{otherSectionOpen ? "▾" : "▸"}</span>}
              </button>
              {otherSectionOpen && (
                <>
                  <Link href="/privacy" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/privacy" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">🔒</span>{sidebarOpen && <span>Privacy</span>}
                  </Link>
                  <Link href="/terms" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/terms" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">📜</span>{sidebarOpen && <span>Terms</span>}
                  </Link>
                  <Link href="/api-docs" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/api-docs" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                    <span className="text-lg">📘</span>{sidebarOpen && <span>API Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4 text-slate-50 min-h-0 overflow-auto">

          {/* ── No servers yet ── */}
          {!loadingGuilds && guilds.length === 0 && (
            <div className="w-full flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-8 items-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40">
                <img src="/DiscordLogo.png" alt="Discord" className="h-12 w-12 brightness-0 invert" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-slate-100">Connect your Discord server</h2>
                <p className="text-sm text-slate-400 max-w-sm">
                  Add AxyraBot to your Discord server to enable live notifications, mod alerts, birthday announcements, and slash commands.
                </p>
              </div>
              <a
                href={inviteUrl ?? `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=3097326905453782&scope=bot%20applications.commands`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4752c4] transition shadow-lg"
              >
                <img src="/DiscordLogo.png" alt="Discord" className="h-5 w-5 brightness-0 invert" />
                Add to Discord
              </a>
            </div>
          )}

          {/* ── Loading state ── */}
          {loadingGuilds && (
            <div className="w-full flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-8 items-center justify-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
              <p className="text-sm text-slate-500">Checking Discord servers…</p>
            </div>
          )}

          {/* ── Bot is in at least one server ── */}
          {!loadingGuilds && guilds.length > 0 && (
            <div className="w-full flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">

              {/* Content header — Add to Discord button + server switcher */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
                <h1 className="text-2xl font-semibold text-slate-100">Discord Integration</h1>

                <div className="flex items-center gap-3">
                  {/* Add to Discord — always shown here, single instance */}
                  <a
                    href={inviteUrl ?? `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=3097326905453782&scope=bot%20applications.commands`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-medium text-white hover:bg-[#4752c4] transition shadow-lg"
                  >
                    <img src="/DiscordLogo.png" alt="Discord" className="h-5 w-5 shrink-0 brightness-0 invert" />
                    Add to Discord
                  </a>

                  {/* Server switcher */}
                  <div className="relative" ref={serverDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setServerDropdownOpen((o) => !o)}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 hover:bg-slate-800/70 transition"
                  >
                    {(() => {
                      const guild = guilds.find((g) => g.id === selectedGuildId);
                      return guild ? (
                        <>
                          {guild.icon ? (
                            <Image src={guild.icon} alt={guild.name} width={28} height={28} className="rounded-full" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-white shrink-0">
                              {guild.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-slate-200 max-w-[160px] truncate">{guild.name}</span>
                        </>
                      ) : (
                        <span className="text-sm text-slate-400">Select a server</span>
                      );
                    })()}
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${serverDropdownOpen ? "rotate-180" : ""}`}
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {serverDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1">
                      {guilds.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGuildId(g.id);
                            setServerDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-800 transition ${
                            g.id === selectedGuildId ? "text-accent font-medium" : "text-slate-200"
                          }`}
                        >
                          {g.icon ? (
                            <Image src={g.icon} alt={g.name} width={24} height={24} className="rounded-full shrink-0" />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5865F2] text-xs font-bold text-white shrink-0">
                              {g.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate">{g.name}</span>
                          {g.id === selectedGuildId && (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-4 w-4 shrink-0 text-accent">
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

              <div className="flex flex-col gap-5 p-6">
                {/* ── Two-column layout when a guild is selected ── */}
                {selectedGuildId ? (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">

                    {/* LEFT — Channel Notifications */}
                    <div className="flex flex-col gap-5 justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Channel Notifications</p>
                        <p className="text-xs text-slate-500">Choose which Discord channels receive each type of notification.</p>
                      </div>

                      {loadingChannels ? (
                        <div className="flex items-center gap-3 py-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
                          <span className="text-sm text-slate-500">Loading channels…</span>
                        </div>
                      ) : (
                          <div className="flex flex-col gap-5">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                                <span className="h-2 w-2 rounded-full bg-red-400" /> Live Notification
                              </label>
                              <button type="button" onClick={() => { setEditingNotif("live"); setEditDraft(templates.live || defaultTemplates.live); setTemplateSaveSuccess(false); setTemplateSaveError(null); }} className="text-xs text-accent hover:underline">Edit message</button>
                            </div>
                            <p className="text-xs text-slate-500">Posted in this channel when you go live on Twitch.</p>
                            <select value={liveChannelId} onChange={(e) => setLiveChannelId(e.target.value)} className={channelSelectClass}>
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                                <span>🔨</span> Mod Alerts
                              </label>
                              <button type="button" onClick={() => { setEditingNotif("mod"); setEditDraft(templates.mod || defaultTemplates.mod); setTemplateSaveSuccess(false); setTemplateSaveError(null); }} className="text-xs text-accent hover:underline">Edit message</button>
                            </div>
                            <p className="text-xs text-slate-500">Ban and timeout events from your Twitch channel.</p>
                            <select value={modChannelId} onChange={(e) => setModChannelId(e.target.value)} className={channelSelectClass}>
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                                <span>🎂</span> Birthday Announcements
                              </label>
                              <button type="button" onClick={() => { setEditingNotif("birthday"); setEditDraft(templates.birthday || defaultTemplates.birthday); setTemplateSaveSuccess(false); setTemplateSaveError(null); }} className="text-xs text-accent hover:underline">Edit message</button>
                            </div>
                            <p className="text-xs text-slate-500">Posted at midnight in your configured timezone when there are birthdays today.</p>
                            <select value={bdayChannelId} onChange={(e) => setBdayChannelId(e.target.value)} className={channelSelectClass}>
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
                                <span>🎫</span> Ticket Panel
                              </label>
                              <button
                                type="button"
                                onClick={() => { setEditingTicketRoles(true); setTicketRoleSaveSuccess(false); setTicketRoleSaveError(null); }}
                                className="text-xs text-accent hover:underline"
                              >
                                Edit Roles
                              </button>
                              {ticketPanelMessageId && ticketPanelChannelId && (
                                <span className="text-xs text-emerald-400">● Active</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              The bot will post an &ldquo;Open a Ticket&rdquo; button here. Changing this channel and saving will post a new panel.
                            </p>
                            <select
                              value={ticketPanelChannelId}
                              onChange={(e) => setTicketPanelChannelId(e.target.value)}
                              className={channelSelectClass}
                            >
                              <option value="">Disabled</option>
                              {guildChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                            {ticketPanelChannelId && ticketPanelChannelId !== lastSentTicketChannelRef.current && (
                              <p className="text-xs text-amber-400">⚠ A new panel will be posted to this channel when you save.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Save row */}
                      <div className="flex items-center gap-4 pt-1">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving || !channelLogin || loadingSettings}
                          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {saving ? "Saving…" : "Save Settings"}
                        </button>
                        {saveSuccess && <span className="text-sm text-emerald-400">✓ Saved!</span>}
                        {saveError && <span className="text-sm text-red-400">{saveError}</span>}
                      </div>
                    </div>

                    {/* RIGHT — Role Mappings */}
                    <div className="flex flex-col gap-4 justify-between">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role Mappings</p>
                        <p className="text-xs text-slate-500">
                          Match Discord roles to Twitch permission levels. Members with the assigned role will be treated as that level when using bot commands in this server.
                        </p>
                      </div>

                      {loadingRoles ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
                          Loading roles…
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {(["owner", "moderator", "vip", "everyone"] as const).map((level) => {
                            const labels: Record<string, { label: string; desc: string; color: string }> = {
                              owner:     { label: "Owner",     desc: "Full broadcaster access",      color: "bg-red-500" },
                              moderator: { label: "Mods",      desc: "Moderator-level commands",     color: "bg-blue-500" },
                              vip:       { label: "VIP",       desc: "VIP-level commands",           color: "bg-purple-500" },
                              everyone:  { label: "Everyone",  desc: "All users (default baseline)", color: "bg-slate-500" },
                            };
                            const meta = labels[level];
                            const selectedRole = guildRoles.find((r) => r.id === roleMap[level]);
                            const roleColor = selectedRole && selectedRole.color !== 0
                              ? `#${selectedRole.color.toString(16).padStart(6, "0")}`
                              : null;
                            return (
                              <div key={level} className="flex flex-col gap-1.5 rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${meta.color} shrink-0`} />
                                  <span className="text-xs font-semibold text-slate-200">{meta.label}</span>
                                  <span className="text-xs text-slate-500">— {meta.desc}</span>
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
                          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {savingRoles ? "Saving…" : "Save Roles"}
                        </button>
                        {roleSaveSuccess && <span className="text-sm text-emerald-400">✓ Saved!</span>}
                        {roleSaveError && <span className="text-sm text-red-400">{roleSaveError}</span>}
                      </div>
                    </div>

                  </div>
                ) : null}

                {/* ── Bot Modules ── */}
                {selectedGuildId && (
                <div className="border-t border-slate-800 pt-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bot Modules</p>
                    <p className="text-xs text-slate-500">Click a module to configure individual commands and settings. Toggle the switch to enable or disable the entire module.</p>
                  </div>

                  {loadingModules ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
                      <span className="text-sm text-slate-500">Loading modules…</span>
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
                            className={`group flex flex-col rounded-xl border text-left transition hover:border-accent/40 hover:bg-slate-800/40 ${
                              enabled
                                ? "border-slate-700/60 bg-slate-950/40"
                                : "border-slate-800/60 bg-slate-900/30 opacity-60"
                            }`}
                          >
                            <div className="flex items-start gap-3 p-4">
                              <span className="text-xl mt-0.5 shrink-0">{mod.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-slate-100 group-hover:text-white">{mod.label}</span>
                                  {/* Module-level toggle — stop propagation so clicking it doesn't open the modal */}
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={enabled ? "Disable module" : "Enable module"}
                                    onClick={(e) => { e.stopPropagation(); if (!isSaving) handleModuleToggle(mod.key, !enabled); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); if (!isSaving) handleModuleToggle(mod.key, !enabled); } }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                      enabled ? "bg-emerald-500" : "bg-slate-600"
                                    } ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}`} />
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{mod.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-800/60 px-4 py-2 text-xs text-slate-500 group-hover:text-slate-400 transition">
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
                  <div className="border-t border-slate-800 pt-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Guild Access</p>
                      <p className="text-xs text-slate-500">
                        Control which Twitch editors can view and manage this server&apos;s bot settings. Editors not listed here will not see this server at all.
                      </p>
                    </div>

                    {loadingManagers ? (
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
                        <span className="text-sm text-slate-500">Loading…</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {guildManagers.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No editors have been granted access to this server yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {guildManagers.map((m) => (
                              <div key={m} className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
                                <span>{m}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManager(m)}
                                  disabled={removingManager === m}
                                  className="ml-0.5 text-slate-500 hover:text-red-400 transition disabled:opacity-40"
                                  aria-label={`Remove ${m}`}
                                >
                                  {removingManager === m ? (
                                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-slate-200" />
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
                            className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/60 w-48"
                          />
                          <button
                            type="button"
                            onClick={handleAddManager}
                            disabled={addingManager || !addManagerInput.trim()}
                            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <div className="border-t border-slate-800 pt-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">🎫 Ticket System</p>
                      <p className="text-xs text-slate-500">
                        Configure the support ticket panel. Users click a button to open a private channel with selected support roles.
                      </p>
                    </div>

                    {loadingTicketConfig ? (
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
                        <span className="text-sm text-slate-500">Loading ticket config…</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-5">
                        {/* Panel channel */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Panel Channel</label>
                          <p className="text-xs text-slate-500">The channel where the ticket open button will be posted.</p>
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
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Log Channel <span className="font-normal text-slate-500">(optional)</span></label>
                          <p className="text-xs text-slate-500">Ticket open/close events will be logged here.</p>
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
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Category <span className="font-normal text-slate-500">(optional)</span></label>
                          <p className="text-xs text-slate-500">Ticket channels will be created inside this category.</p>
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
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Support Roles</label>
                          <p className="text-xs text-slate-500">These roles can see and respond to every ticket channel.</p>
                          {loadingRoles ? (
                            <span className="text-xs text-slate-500">Loading roles…</span>
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
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                      selected
                                        ? "border-accent bg-accent/10 text-accent"
                                        : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                                    }`}
                                  >
                                    {selected ? "✓ " : ""}{r.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Panel title / body / button label */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Panel Title</label>
                            <input
                              type="text"
                              value={ticketPanelTitle}
                              onChange={(e) => setTicketPanelTitle(e.target.value)}
                              placeholder="Support Tickets"
                              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/60"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Button Label</label>
                            <input
                              type="text"
                              value={ticketButtonLabel}
                              onChange={(e) => setTicketButtonLabel(e.target.value)}
                              placeholder="🎫 Open Ticket"
                              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/60"
                            />
                          </div>
                          <div className="sm:col-span-2 flex flex-col gap-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Panel Message</label>
                            <textarea
                              value={ticketPanelBody}
                              onChange={(e) => setTicketPanelBody(e.target.value)}
                              rows={2}
                              placeholder="Click the button below to open a support ticket."
                              className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/60 resize-none"
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={handleSaveTicketConfig}
                            disabled={savingTicketConfig || !selectedGuildId}
                            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {savingTicketConfig ? "Saving…" : "Save Config"}
                          </button>
                          <button
                            type="button"
                            onClick={handleSendTicketPanel}
                            disabled={sendingPanel || !ticketPanelChannelId || !selectedGuildId}
                            className="rounded-lg border border-accent/40 bg-accent/10 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {sendingPanel ? "Sending…" : "Send Panel"}
                          </button>
                          {ticketSaveSuccess && <span className="text-sm text-emerald-400">✓ Config saved!</span>}
                          {ticketSaveError && <span className="text-sm text-red-400">{ticketSaveError}</span>}
                          {sendPanelSuccess && <span className="text-sm text-emerald-400">✓ Panel sent!</span>}
                          {sendPanelError && <span className="text-sm text-red-400">{sendPanelError}</span>}
                        </div>

                        {/* Panel message link */}
                        {ticketPanelMessageId && ticketPanelChannelId && (
                          <p className="text-xs text-slate-500">
                            Active panel message ID: <span className="font-mono text-slate-400">{ticketPanelMessageId}</span>
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
          <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{mod.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{mod.label} Module</p>
                  <p className="text-xs text-slate-500">{mod.commands.length} commands · click a command to toggle it on or off</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Module-level toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{modEnabled ? "Enabled" : "Disabled"}</span>
                  <button
                    type="button"
                    onClick={() => !isSavingMod && handleModuleToggle(mod.key, !modEnabled)}
                    disabled={isSavingMod}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${modEnabled ? "bg-emerald-500" : "bg-slate-600"} ${isSavingMod ? "opacity-50" : ""}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${modEnabled ? "translate-x-4" : "translate-x-1"}`} />
                  </button>
                </div>
                <button type="button" onClick={() => setOpenModuleKey(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                </button>
              </div>
            </div>

            {/* Command list — scrollable */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {mod.commands.map((cmd) => {
                const cmdKey = `cmd:${cmd.name}`;
                const cmdEnabled = guildModules[cmdKey] !== false;
                const hasSettings = (cmd.settings?.length ?? 0) > 0;
                return (
                  <div key={cmd.name} className={`px-6 py-4 flex flex-col gap-3 transition ${cmdEnabled ? "" : "opacity-50"}`}>
                    {/* Command row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <code className="shrink-0 mt-0.5 rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-accent">/{cmd.name}</code>
                        <span className="text-sm text-slate-300 leading-relaxed">{cmd.description}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCmdToggle(cmd.name, !cmdEnabled)}
                        className={`relative shrink-0 mt-0.5 inline-flex h-5 w-9 items-center rounded-full transition-colors ${cmdEnabled ? "bg-emerald-500" : "bg-slate-600"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${cmdEnabled ? "translate-x-4" : "translate-x-1"}`} />
                      </button>
                    </div>

                    {/* Per-command settings (only shown when command is enabled) */}
                    {hasSettings && cmdEnabled && (
                      <div className="ml-0 flex flex-col gap-3 pl-4 border-l border-slate-700/50">
                        {(cmd.settings ?? []).map((field) => {
                          const currentVal = pendingCmdSettings[field.key] ?? field.defaultValue ?? "";
                          const isToggle = field.type === "toggle";
                          const isTrueVal = currentVal === "true";
                          return (
                            <div key={field.key} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-medium text-slate-300">{field.label}</span>
                                  {field.description && <span className="text-xs text-slate-500">{field.description}</span>}
                                </div>
                                {isToggle && (
                                  <button
                                    type="button"
                                    onClick={() => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: isTrueVal ? "false" : "true" }))}
                                    className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${isTrueVal ? "bg-emerald-500" : "bg-slate-600"}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${isTrueVal ? "translate-x-4" : "translate-x-1"}`} />
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
                                  className="w-40 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                />
                              )}
                              {field.type === "text" && (
                                <input
                                  type="text"
                                  value={currentVal}
                                  placeholder={field.placeholder}
                                  onChange={(e) => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                />
                              )}
                              {field.type === "select" && (
                                <select
                                  value={currentVal}
                                  onChange={(e) => setPendingCmdSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-48 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
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
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-slate-800 bg-slate-950/40 shrink-0">
              <p className="text-xs text-slate-500">Command toggles save instantly. Click Save for settings changes.</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpenModuleKey(null)} className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                  Close
                </button>
                {hasDirty && (
                  <button
                    type="button"
                    onClick={handleSaveCmdSettings}
                    disabled={savingCmdSettings}
                    className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-slate-100">🎫 Ticket Channel Settings</p>
              <p className="text-xs text-slate-500">Choose the category and roles attached to every created ticket channel.</p>
            </div>
            <button type="button" onClick={() => setEditingTicketRoles(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
            </button>
          </div>

          {/* Category picker */}
          <div className="flex flex-col gap-4 px-5 pt-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Category</label>
              <p className="text-xs text-slate-500">Ticket channels will be created inside this category. Leave blank for no category.</p>
              <select
                value={ticketCategoryId}
                onChange={(e) => setTicketCategoryId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60 w-full"
              >
                <option value="">No category</option>
                {guildCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Support roles */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Support Roles</label>
              <p className="text-xs text-slate-500">These roles can see and respond to every ticket channel. Toggle to select.</p>
              {loadingRoles ? (
                <span className="text-xs text-slate-500">Loading roles…</span>
              ) : guildRoles.filter((r) => r.name !== "@everyone").length === 0 ? (
                <span className="text-xs text-slate-500">No roles found.</span>
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
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {selected ? "✓ " : ""}{r.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 mt-4 border-t border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              {ticketRoleSaveSuccess && <span className="text-sm text-emerald-400">✓ Saved!</span>}
              {ticketRoleSaveError && <span className="text-sm text-red-400">{ticketRoleSaveError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingTicketRoles(false)} className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition">
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
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-slate-100">
                {editingNotif === "live" && "✏️ Edit Live Notification"}
                {editingNotif === "mod" && "✏️ Edit Mod Alert"}
                {editingNotif === "birthday" && "✏️ Edit Birthday Announcement"}
              </p>
              <p className="text-xs text-slate-500">Customize the Discord message. Leave blank to use the default.</p>
            </div>
            <button type="button" onClick={() => setEditingNotif(null)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition">
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent/60 resize-y"
            />
            <button
              type="button"
              onClick={() => setEditDraft(defaultTemplates[editingNotif])}
              className="self-start text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Reset to default
            </button>
          </div>

          {/* Variables reference */}
          <div className="px-5 pt-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Available variables</p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {templateVars[editingNotif].map(({ name, desc }) => (
                <div key={name} className="flex items-baseline gap-2">
                  <code
                    className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-accent cursor-pointer hover:bg-slate-700 transition"
                    title="Click to insert"
                    onClick={() => setEditDraft((d) => d + name)}
                  >
                    {name}
                  </code>
                  <span className="text-xs text-slate-500 truncate">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discord markdown tip */}
          <div className="px-5 py-3">
            <p className="text-xs text-slate-600">
              Supports Discord markdown: <code className="text-slate-500">**bold**</code>, <code className="text-slate-500">*italic*</code>, <code className="text-slate-500">`code`</code>, newlines with{" "}
              <code className="text-slate-500">\n</code> in the template text.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              {templateSaveSuccess && <span className="text-sm text-emerald-400">✓ Saved!</span>}
              {templateSaveError && <span className="text-sm text-red-400">{templateSaveError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingNotif(null)} className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !channelLogin}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingTemplate ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
