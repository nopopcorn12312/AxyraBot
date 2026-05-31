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

type ModuleCommand = { name: string; description: string };
type ModuleConfig = { key: string; icon: string; label: string; description: string; commands: ModuleCommand[] };

const discordModuleConfig: ModuleConfig[] = [
  {
    key: "moderation",
    icon: "🛡️",
    label: "Moderation",
    description: "Comprehensive moderation toolkit: bans, kicks, timeouts, warnings, purge, lockdown, and full case logging.",
    commands: [
      { name: "ban", description: "Permanently ban a member from the server." },
      { name: "kick", description: "Kick a member from the server." },
      { name: "timeout", description: "Temporarily mute a member." },
      { name: "untimeout", description: "Remove a timeout from a member." },
      { name: "warn", description: "Issue a warning to a member." },
      { name: "warnings", description: "View all warnings for a member." },
      { name: "clearwarnings", description: "Clear all warnings for a member." },
      { name: "delwarn", description: "Delete a specific warning by case ID." },
      { name: "purge", description: "Bulk delete messages from a channel." },
      { name: "lock", description: "Lock a channel from sending messages." },
      { name: "unlock", description: "Unlock a previously locked channel." },
      { name: "slowmode", description: "Set slowmode delay on a channel." },
      { name: "softban", description: "Ban then immediately unban to delete message history." },
      { name: "deafen", description: "Server-deafen a member in voice channels." },
      { name: "undeafen", description: "Remove server deafen from a member." },
      { name: "lockdown", description: "Lock or unlock all channels in the server at once." },
      { name: "temprole", description: "Assign a role to a member for a limited time." },
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
      { name: "announce", description: "Send a message as the bot to a target channel." },
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
      { name: "poll", description: "Start a reaction-based poll." },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = usePersistentSectionState("axyra.sidebar.mainSectionOpen", true);
  const [vanitySectionOpen, setVanitySectionOpen] = usePersistentSectionState("axyra.sidebar.vanitySectionOpen", true);
  const [otherSectionOpen, setOtherSectionOpen] = usePersistentSectionState("axyra.sidebar.otherSectionOpen", true);
  const [moderationOpen, setModerationOpen] = usePersistentSectionState("axyra.sidebar.moderationOpen", true);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const serverDropdownRef = useRef<HTMLDivElement | null>(null);
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

  // Fetch guilds the bot is in
  useEffect(() => {
    setLoadingGuilds(true);
    fetch(`${backendUrl}/discord/guilds`)
      .then((r) => (r.ok ? r.json() : { guilds: [] }))
      .then((data) => setGuilds(data.guilds ?? []))
      .catch(() => setGuilds([]))
      .finally(() => setLoadingGuilds(false));
  }, []);

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
      return;
    }
    setLoadingModules(true);
    fetch(`${backendUrl}/discord/guild-modules?guild_id=${encodeURIComponent(selectedGuildId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.modules) setGuildModules(data.modules);
      })
      .catch(() => {})
      .finally(() => setLoadingModules(false));
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
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
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

  const handleSaveTemplate = async () => {    if (!channelLogin || !editingNotif) return;
    setSavingTemplate(true);
    setTemplateSaveError(null);
    setTemplateSaveSuccess(false);
    try {
      const res = await fetch(`${backendUrl}/discord/notification-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: channelLogin, templates: { [editingNotif]: editDraft } }),
      });
      if (!res.ok) {
        setTemplateSaveError("Failed to save.");
      } else {
        setTemplates((prev) => ({ ...prev, [editingNotif]: editDraft }));
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
          <a
            href={inviteUrl ?? `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=3097326905453782&scope=bot%20applications.commands`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752c4] transition shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            Add to Discord
          </a>
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

          {/* ── No servers yet: only show invite step ── */}
          {!loadingGuilds && guilds.length === 0 && (
            <div className="w-full flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-8 items-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-[#5865F2]" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
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
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
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

              {/* Content header — server switcher dropdown top-right */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-800">
                <h1 className="text-2xl font-semibold text-slate-100">Discord Integration</h1>

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
              </div>

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
                    <p className="text-xs text-slate-500">Enable or disable groups of slash commands for this server. Disabled modules hide all commands in that group from use.</p>
                  </div>

                  {loadingModules ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
                      <span className="text-sm text-slate-500">Loading modules…</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {discordModuleConfig.map((mod) => {
                        const enabled = guildModules[mod.key] !== false;
                        const isExpanded = expandedModule === mod.key;
                        const isSaving = savingModule === mod.key;
                        return (
                          <div
                            key={mod.key}
                            className={`flex flex-col rounded-xl border transition ${
                              enabled
                                ? "border-slate-700/60 bg-slate-950/40"
                                : "border-slate-800/60 bg-slate-900/30 opacity-60"
                            }`}
                          >
                            {/* Module header */}
                            <div className="flex items-start gap-3 p-4">
                              <span className="text-xl mt-0.5 shrink-0">{mod.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-slate-100">{mod.label}</span>
                                  <button
                                    type="button"
                                    onClick={() => !isSaving && handleModuleToggle(mod.key, !enabled)}
                                    disabled={isSaving}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                      enabled ? "bg-emerald-500" : "bg-slate-600"
                                    } ${isSaving ? "opacity-50" : ""}`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${
                                        enabled ? "translate-x-4" : "translate-x-1"
                                      }`}
                                    />
                                  </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{mod.description}</p>
                              </div>
                            </div>

                            {/* Commands list toggle */}
                            <button
                              type="button"
                              onClick={() => setExpandedModule(isExpanded ? null : mod.key)}
                              className="flex items-center justify-between border-t border-slate-800/60 px-4 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 transition rounded-b-xl"
                            >
                              <span>{mod.commands.length} command{mod.commands.length !== 1 ? "s" : ""}</span>
                              <svg
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              >
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </button>

                            {/* Expanded commands list */}
                            {isExpanded && (
                              <div className="border-t border-slate-800/60 px-4 py-3 flex flex-col gap-1.5">
                                {mod.commands.map((cmd) => (
                                  <div key={cmd.name} className="flex items-start gap-2.5">
                                    <code className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-accent">
                                      /{cmd.name}
                                    </code>
                                    <span className="text-xs text-slate-500 leading-relaxed">{cmd.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
