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

type Guild = { id: string; name: string };
type Channel = { id: string; name: string };

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

  // Read auth from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
      setChannelLogin((activeChannel || storedLogin).toLowerCase());
    }
    if (storedAvatar) setAvatarUrl(storedAvatar);
  }, []);

  // Fetch guilds the bot is in
  useEffect(() => {
    setLoadingGuilds(true);
    fetch(`${backendUrl}/discord/guilds`)
      .then((r) => (r.ok ? r.json() : { guilds: [] }))
      .then((data) => setGuilds(data.guilds ?? []))
      .catch(() => setGuilds([]))
      .finally(() => setLoadingGuilds(false));
  }, []);

  // Load saved settings when channelLogin is known
  useEffect(() => {
    if (!channelLogin) return;
    setLoadingSettings(true);
    fetch(`${backendUrl}/discord/settings?login=${encodeURIComponent(channelLogin)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          if (data.guild_id) setSelectedGuildId(data.guild_id);
          setLiveChannelId(data.live_channel_id ?? "");
          setModChannelId(data.mod_channel_id ?? "");
          setBdayChannelId(data.bday_channel_id ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [channelLogin]);

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
        <div className="flex-1 flex flex-col gap-6 text-slate-50 min-h-0 overflow-auto">
          <div className="w-full flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-6 gap-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <h1 className="text-3xl font-semibold">Discord Integration</h1>
            </div>

            {/* Step 1 — Invite */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">1</span>
                <h2 className="text-base font-semibold text-slate-100">Invite the bot to your server</h2>
              </div>
              <p className="text-sm text-slate-400">
                Click <span className="text-accent font-medium">Add to Discord</span> above and select your server.
                The bot needs <strong className="text-slate-300">Send Messages</strong> permission in whatever channels you configure below.
              </p>
              {loadingGuilds ? (
                <div className="text-xs text-slate-500">Checking servers…</div>
              ) : guilds.length === 0 ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                  <span>⚠️</span> The bot isn&apos;t in any Discord server yet. Use the button above to invite it first.
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                  <span>✓</span> Bot is active in <strong className="mx-1">{guilds.length}</strong> server{guilds.length !== 1 ? "s" : ""}.
                </div>
              )}
            </div>

            {/* Step 2 — Select server */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">2</span>
                <h2 className="text-base font-semibold text-slate-100">Select your server</h2>
              </div>
              <p className="text-sm text-slate-400">Choose which Discord server should receive notifications for your Twitch channel.</p>
              {loadingGuilds ? (
                <div className="text-sm text-slate-500">Loading servers…</div>
              ) : guilds.length === 0 ? (
                <div className="text-sm text-slate-500">No servers available — invite the bot first.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-300">Server</label>
                  <select
                    value={selectedGuildId}
                    onChange={(e) => {
                      setSelectedGuildId(e.target.value);
                      setLiveChannelId("");
                      setModChannelId("");
                      setBdayChannelId("");
                    }}
                    className={channelSelectClass}
                  >
                    <option value="">— Select a server —</option>
                    {guilds.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  {selectedGuildId && !botInSelectedGuild && (
                    <p className="text-xs text-amber-400 mt-1">⚠️ The bot may have been removed from this server.</p>
                  )}
                </div>
              )}
            </div>

            {/* Step 3 — Choose channels */}
            <div className={`rounded-xl border border-slate-700 bg-slate-950/40 p-5 flex flex-col gap-4 transition-opacity ${!selectedGuildId ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">3</span>
                <h2 className="text-base font-semibold text-slate-100">Choose notification channels</h2>
              </div>
              <p className="text-sm text-slate-400">
                Pick which channel each notification goes to. Set to <span className="text-slate-300 font-medium">Disabled</span> to turn it off.
              </p>
              {loadingChannels ? (
                <div className="text-sm text-slate-500">Loading channels…</div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="text-red-400">●</span> Live Notification
                    </label>
                    <p className="text-xs text-slate-500">Posted when you go live on Twitch.</p>
                    <select
                      value={liveChannelId}
                      onChange={(e) => setLiveChannelId(e.target.value)}
                      disabled={!selectedGuildId || loadingChannels}
                      className={channelSelectClass}
                    >
                      <option value="">Disabled</option>
                      {guildChannels.map((c) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🔨</span> Mod Alerts
                    </label>
                    <p className="text-xs text-slate-500">Posted when a viewer is banned or timed out in your channel.</p>
                    <select
                      value={modChannelId}
                      onChange={(e) => setModChannelId(e.target.value)}
                      disabled={!selectedGuildId || loadingChannels}
                      className={channelSelectClass}
                    >
                      <option value="">Disabled</option>
                      {guildChannels.map((c) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🎂</span> Birthday Announcements
                    </label>
                    <p className="text-xs text-slate-500">Posted when <code className="bg-slate-800 px-1 rounded">!birthday</code> is used and there are birthdays today.</p>
                    <select
                      value={bdayChannelId}
                      onChange={(e) => setBdayChannelId(e.target.value)}
                      disabled={!selectedGuildId || loadingChannels}
                      className={channelSelectClass}
                    >
                      <option value="">Disabled</option>
                      {guildChannels.map((c) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !channelLogin || loadingSettings || !selectedGuildId}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {saveSuccess && <span className="text-sm text-emerald-400">✓ Settings saved!</span>}
              {saveError && <span className="text-sm text-red-400">{saveError}</span>}
            </div>

            {/* Slash commands info */}
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-5 flex flex-col gap-3">
              <h2 className="text-base font-semibold text-slate-100">Available slash commands</h2>
              <div className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
                <code className="text-accent font-mono text-sm shrink-0">/commands</code>
                <span className="text-sm text-slate-400">Lists all custom Twitch bot commands for your channel. Works in any server the bot is in.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
