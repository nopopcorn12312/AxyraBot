"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

const defaultCommands: { name: string; label?: string; description: string; enabled: boolean }[] = [
  {
    name: "!hello",
    description: "Greets chat with the bot's name.",
    enabled: true,
  },
  {
    name: "!vanish",
    description: "Times out the user briefly with a playful message.",
    enabled: true,
  },
  {
    name: "!title",
    label: "!title <new title>",
    description: "Changes the stream title (broadcaster or mods only).",
    enabled: true,
  },
  {
    name: "!game",
    label: "!game <category>",
    description: "Changes the Twitch category/game (broadcaster or mods only).",
    enabled: true,
  },
  {
    name: "!accountage",
    label: "!accountage [username]",
    description: "Shows when a user's Twitch account was created.",
    enabled: true,
  },
  {
    name: "!followage",
    label: "!followage [username]",
    description: "Shows how long a user has followed the channel.",
    enabled: true,
  },
  {
    name: "!uptime",
    description: "Shows how long the channel has been live this session.",
    enabled: true,
  },
  {
    name: "!commands",
    description: "Links viewers to your channel's custom commands page.",
    enabled: true,
  },
  {
    name: "!ai",
    label: "!ai <prompt>",
    description: "Ask the AI a question or send a short prompt.",
    enabled: true,
  },
  {
    name: "!birthday",
    description: "Shows birthdays that fall on today from your saved list.",
    enabled: true,
  },
  {
    name: "!nextbday",
    description: "Shows the next upcoming birthday from your saved list.",
    enabled: true,
  },
  {
    name: "!addbday",
    label: "!addbday NAME MM DD",
    description: "Add or update a named birthday (mods only).",
    enabled: true,
  },
  {
    name: "!addmybday",
    label: "!addmybday MM DD",
    description: "Viewers can add their own birthday.",
    enabled: true,
  },
  {
    name: "!delbday",
    label: "!delbday NAME",
    description: "Delete a saved birthday by name (mods only).",
    enabled: true,
  },
  {
    name: "!editbday",
    label: "!editbday USER MM DD",
    description: "Change a user's saved birthday (mods only).",
    enabled: true,
  },
];

type CustomCommandRole = "all" | "broadcaster" | "moderator" | "vip";

type CommandToggleProps = {
  name: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
};

function CommandToggle({ enabled, onChange }: CommandToggleProps) {
  return (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
      enabled ? "bg-emerald-500" : "bg-slate-600"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow transition-transform ${
        enabled ? "translate-x-4" : "translate-x-1"
      }`}
    />
  </button>
  );
}

export default function CommandsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [loggedInLogin, setLoggedInLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = usePersistentSectionState(
    "axyra.sidebar.mainSectionOpen",
    true,
  );
  const [vanitySectionOpen, setVanitySectionOpen] = usePersistentSectionState(
    "axyra.sidebar.vanitySectionOpen",
    true,
  );
  const [otherSectionOpen, setOtherSectionOpen] = usePersistentSectionState(
    "axyra.sidebar.otherSectionOpen",
    true,
  );
  const [commandsOpen, setCommandsOpen] = usePersistentSectionState(
    "axyra.sidebar.commandsOpen",
    true,
  );
  const [moderationOpen, setModerationOpen] = usePersistentSectionState(
    "axyra.sidebar.moderationOpen",
    true,
  );
  const [view, setView] = useState<"default" | "custom">("default");
  const [defaultSettings, setDefaultSettings] = useState<Record<string, boolean>>({});
  const [customCommands, setCustomCommands] = useState<
    { name: string; description: string; enabled: boolean; role: CustomCommandRole }[]
  >([]);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editResponse, setEditResponse] = useState("");
  const [editRole, setEditRole] = useState<CustomCommandRole>("all");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [customPage, setCustomPage] = useState(1);
  const CUSTOM_PAGE_SIZE = 10;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("view");
    if (fromQuery === "custom") {
      setView("custom");
    } else if (fromQuery === "default") {
      setView("default");
    }

    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    const channelFromQuery = params.get("channel");

    if (storedLogin) {
      setIsLoggedIn(true);
      setLoggedInLogin(storedLogin.toLowerCase());
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }

    // Determine which channel's commands to display. If a channel is supplied
    // in the URL, always show that broadcaster's commands (so shared links
    // work for viewers). Otherwise, fall back to the logged-in broadcaster.
    if (channelFromQuery) {
      setChannelLogin(channelFromQuery.toLowerCase());
    } else if (storedLogin) {
      setChannelLogin(storedLogin.toLowerCase());
    }
  }, []);

  // Fetch per-command default settings for this broadcaster when viewing
  // default commands.
  useEffect(() => {
    if (!channelLogin || view !== "default") return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/commands/default-settings?login=${encodeURIComponent(channelLogin)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data: { commands?: { name: string; enabled: boolean }[] } = await res.json();
        const map: Record<string, boolean> = {};
        for (const cmd of data.commands || []) {
          map[cmd.name] = cmd.enabled;
        }
        setDefaultSettings(map);
      } catch {
        // ignore fetch errors; defaults will be treated as enabled
      }
    })();
    return () => controller.abort();
  }, [channelLogin, view]);

  // Reset to page 1 whenever the commands list changes
  useEffect(() => { setCustomPage(1); }, [customCommands.length]);

  useEffect(() => {
    if (!channelLogin || view !== "custom") return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/commands/custom?login=${encodeURIComponent(channelLogin)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data: {
          commands?: { name: string; response: string; enabled?: boolean; role?: string }[];
        } = await res.json();
        const rows = (data.commands || []).map((c) => {
          const rawRole = (c.role || "all").toLowerCase();
          let role: CustomCommandRole = "all";
          switch (rawRole) {
            case "broadcaster":
              role = "broadcaster";
              break;
            case "moderator":
              role = "moderator";
              break;
            case "vip":
              role = "vip";
              break;
            default:
              role = "all";
          }
          return {
            name: c.name,
            description: c.response,
            enabled: c.enabled ?? true,
            role,
          };
        });
        setCustomCommands(rows);
      } catch {
        // ignore fetch errors for now
      }
    })();
    return () => controller.abort();
  }, [channelLogin, view]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
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

  const redirectTarget = frontendUrl || "http://localhost:3000";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

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
            <Image
              src={AxyraBotPFP}
              alt="AxyraBot logo"
              width={32}
              height={32}
              className="rounded-full"
            />
            <div className="text-2xl font-semibold tracking-tight">
              <span className="text-accent">Axyra</span>
              <span className="text-white">Bot</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={primaryHref}
            className="hidden"
          >
            {primaryLabel}
          </a>
          {isLoggedIn && (
            <>
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
                    <Image
                      src={avatarUrl}
                      alt="Twitch profile picture"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
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
        <div
          className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}
        >
          <nav className="mt-1 flex flex-col gap-4 text-sm text-slate-200">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMainSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Main</span>
                {sidebarOpen && <span className="text-[10px]">{mainSectionOpen ? "▾" : "▸"}</span>}
              </button>
              {mainSectionOpen && (
                <>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/dashboard"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">📊</span>
                    {sidebarOpen && <span>Dashboard</span>}
                  </Link>

                  <button
                    type="button"
                    onClick={() => setCommandsOpen((open) => !open)}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-800/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">❓</span>
                      {sidebarOpen && <span>Commands</span>}
                    </div>
                    {sidebarOpen && (
                      <span className="text-xs text-slate-400">{commandsOpen ? "▾" : "▸"}</span>
                    )}
                  </button>
                  {commandsOpen && (
                    <div className="mt-1 ml-6 flex flex-col gap-1 text-xs text-slate-200">
                      <Link
                        href="/commands?view=default"
                        className={`rounded-lg px-3 py-1.5 transition ${
                          pathname === "/commands" && view === "default"
                            ? "bg-slate-800/80 text-slate-50"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        Default commands
                      </Link>
                      <Link
                        href="/commands?view=custom"
                        className={`rounded-lg px-3 py-1.5 transition ${
                          pathname === "/commands" && view === "custom"
                            ? "bg-slate-800/80 text-slate-50"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        Custom commands
                      </Link>
                    </div>
                  )}

                </>
              )}
            </div>

            {/* Moderation section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setModerationOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Moderation</span>
                {sidebarOpen && (
                  <span className="text-[10px]">{moderationOpen ? "▾" : "▸"}</span>
                )}
              </button>
              {moderationOpen && (
                <>
                  <Link
                    href="/moderation/blocked-terms"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/moderation/blocked-terms"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🚫</span>
                    {sidebarOpen && <span>Blocked Terms</span>}
                  </Link>
                  <Link
                    href="/moderation/spam-filters"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/moderation/spam-filters"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🧹</span>
                    {sidebarOpen && <span>Spam Filters</span>}
                  </Link>
                </>
              )}
            </div>

            {/* Vanity section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setVanitySectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Vanity</span>
                {sidebarOpen && <span className="text-[10px]">{vanitySectionOpen ? "▾" : "▸"}</span>}
              </button>
              {vanitySectionOpen && (
                <>
                  <Link
                    href="/modules"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/modules"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🧩</span>
                    {sidebarOpen && <span>Modules</span>}
                  </Link>
                  <Link
                    href="/birthdays"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/birthdays"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🎂</span>
                    {sidebarOpen && <span>Birthdays</span>}
                  </Link>
                </>
              )}
            </div>

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOtherSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Other</span>
                {sidebarOpen && <span className="text-[10px]">{otherSectionOpen ? "▾" : "▸"}</span>}
              </button>
              {otherSectionOpen && (
                <>
                  <Link
                    href="/privacy"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/privacy"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🔒</span>
                    {sidebarOpen && <span>Privacy</span>}
                  </Link>
                  <Link
                    href="/terms"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/terms"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">📜</span>
                    {sidebarOpen && <span>Terms</span>}
                  </Link>
                  <Link
                    href="/api-docs"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/api-docs"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">📘</span>
                    {sidebarOpen && <span>API Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        <div className="flex-1 flex flex-col gap-6 text-slate-50 min-h-0">
          <div className="w-full flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-semibold">Commands</h1>
              <div className="inline-flex rounded-full bg-slate-900/80 border border-slate-700 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setView("default")}
                  className={`px-3 py-1 rounded-full font-medium transition ${
                    view === "default"
                      ? "bg-accent text-white shadow-[0_0_14px_rgba(129,140,248,0.6)]"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  Default commands
                </button>
                <button
                  type="button"
                  onClick={() => setView("custom")}
                  className={`ml-1 px-3 py-1 rounded-full font-medium transition ${
                    view === "custom"
                      ? "bg-accent text-white shadow-[0_0_14px_rgba(129,140,248,0.6)]"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  Custom commands
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 min-h-0">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Command</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold w-32 text-center">Enabled</th>
                    <th className="px-4 py-3 font-semibold w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {view === "default" && (
                    <>
                      {defaultCommands.map((row) => (
                        <tr key={row.name} className="border-t border-slate-800 hover:bg-slate-900/60">
                          <td className="px-4 py-2 font-mono text-slate-100">{row.label ?? row.name}</td>
                          <td className="px-4 py-2 text-slate-300">{row.description}</td>
                          <td className="px-4 py-2 text-center">
                            {channelLogin && loggedInLogin === channelLogin ? (
                              <CommandToggle
                                name={row.name}
                                enabled={defaultSettings[row.name] ?? true}
                                onChange={async (next) => {
                                  setDefaultSettings((prev) => ({ ...prev, [row.name]: next }));
                                  try {
                                    await fetch(`${backendUrl}/commands/default-settings`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        login: channelLogin,
                                        command: row.name,
                                        enabled: next,
                                      }),
                                    });
                                  } catch {
                                    // ignore network errors; UI state already updated
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="text-slate-500 text-xs">—</span>
                          </td>
                        </tr>
                      ))}
                      {defaultCommands.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                            No commands to display yet.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                  {view === "custom" && (() => {
                    const totalPages = Math.max(1, Math.ceil(customCommands.length / CUSTOM_PAGE_SIZE));
                    const safePage = Math.min(customPage, totalPages);
                    const pageRows = customCommands.slice((safePage - 1) * CUSTOM_PAGE_SIZE, safePage * CUSTOM_PAGE_SIZE);
                    return (
                      <>{pageRows.map((row) => (
                        <Fragment key={row.name}>
                          <tr className="border-t border-slate-800 hover:bg-slate-900/60">
                            <td className="px-4 py-2 font-mono text-slate-100">{row.name}</td>
                            <td className="px-4 py-2 text-slate-300">{row.description}</td>
                            <td className="px-4 py-2 text-center">
                              {isLoggedIn && channelLogin && loggedInLogin === channelLogin ? (
                                <CommandToggle
                                  name={row.name}
                                  enabled={row.enabled}
                                  onChange={async (next) => {
                                    setCustomCommands((prev) =>
                                      prev.map((cmd) =>
                                        cmd.name === row.name ? { ...cmd, enabled: next } : cmd,
                                      ),
                                    );
                                    try {
                                      await fetch(`${backendUrl}/commands/custom`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login: channelLogin,
                                          command: row.name,
                                          enabled: next,
                                        }),
                                      });
                                    } catch {
                                      // ignore network errors; UI state already updated
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {isLoggedIn && channelLogin && loggedInLogin === channelLogin ? (
                                <div className="inline-flex items-center gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingCommand === row.name) {
                                        setEditingCommand(null);
                                        setEditError(null);
                                        return;
                                      }
                                      setEditingCommand(row.name);
                                      setEditName(row.name);
                                      setEditResponse(row.description);
                                      setEditRole(row.role);
                                      setEditError(null);
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800/80"
                                  >
                                    <span className="sr-only">Edit command</span>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-3.5 w-3.5"
                                    >
                                      <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.518l-3 .8a.5.5 0 0 1-.606-.606l.8-3a2 2 0 0 1 .518-.878l8.5-8.5Z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteTarget(row.name);
                                      setDeleteError(null);
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-700 bg-red-700/80 text-white hover:bg-red-600/90"
                                  >
                                    <span className="sr-only">Delete command</span>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-3.5 w-3.5"
                                    >
                                      <path d="M6 2a1 1 0 0 0-1 1v1H3.5a.5.5 0 0 0 0 1h.54l.76 10.137A2 2 0 0 0 6.79 17h6.42a2 2 0 0 0 1.99-1.863L15.96 5H16.5a.5.5 0 0 0 0-1H15V3a1 1 0 0 0-1-1H6Zm1 2V3h6v1H7Z" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                          {editingCommand === row.name && (
                            <tr className="border-t border-slate-800 bg-slate-950/80">
                              <td colSpan={4} className="px-4 py-3">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <label className="text-xs font-medium text-slate-300 sm:w-32">Command name</label>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      className="flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <label className="text-xs font-medium text-slate-300 sm:w-32">Response</label>
                                    <input
                                      type="text"
                                      value={editResponse}
                                      onChange={(e) => setEditResponse(e.target.value)}
                                      className="flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <label className="text-xs font-medium text-slate-300 sm:w-32">Who can use</label>
                                    <select
                                      value={editRole}
                                      onChange={(e) => setEditRole(e.target.value as CustomCommandRole)}
                                      className="flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                    >
                                      <option value="all">All users</option>
                                      <option value="broadcaster">Broadcaster only</option>
                                      <option value="moderator">Broadcaster & moderators</option>
                                      <option value="vip">Broadcaster, mods & VIPs</option>
                                    </select>
                                  </div>
                                  {editError && (
                                    <div className="text-xs text-red-400">{editError}</div>
                                  )}
                                  <div className="mt-1 flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommand(null);
                                        setEditError(null);
                                      }}
                                      className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800/80"
                                      disabled={savingEdit}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!channelLogin || !editingCommand) return;
                                        const trimmedName = editName.trim();
                                        if (!trimmedName) {
                                          setEditError("Command name cannot be empty.");
                                          return;
                                        }
                                        setSavingEdit(true);
                                        setEditError(null);
                                        try {
                                          const res = await fetch(`${backendUrl}/commands/custom/update`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              login: channelLogin,
                                              originalCommand: editingCommand,
                                              command: trimmedName,
                                              response: editResponse,
                                              role: editRole,
                                            }),
                                          });
                                          if (!res.ok) {
                                            setEditError("Failed to save changes. Please try again.");
                                          } else {
                                            setCustomCommands((prev) =>
                                              prev.map((cmd) =>
                                                cmd.name === editingCommand
                                                  ? {
                                                      ...cmd,
                                                      name: trimmedName,
                                                      description: editResponse,
                                                      role: editRole,
                                                    }
                                                  : cmd,
                                              ),
                                            );
                                            setEditingCommand(null);
                                          }
                                        } catch {
                                          setEditError("Network error while saving changes.");
                                        } finally {
                                          setSavingEdit(false);
                                        }
                                      }}
                                      className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                                      disabled={savingEdit}
                                    >
                                      {savingEdit ? "Saving..." : "Save changes"}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      {customCommands.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                            No commands to display yet.
                          </td>
                        </tr>
                      )}
                    </>);
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination — custom commands only */}
            {view === "custom" && customCommands.length > CUSTOM_PAGE_SIZE && (() => {
              const totalPages = Math.max(1, Math.ceil(customCommands.length / CUSTOM_PAGE_SIZE));
              const safePage = Math.min(customPage, totalPages);
              return (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setCustomPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    ‹
                  </button>
                  <span className="text-sm text-slate-300">
                    Page <span className="font-semibold text-slate-100">{safePage}</span> of{" "}
                    <span className="font-semibold text-slate-100">{totalPages}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    ›
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      {deleteTarget && (
        <DeleteCommandModal
          commandName={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (deleting) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={async () => {
            if (!channelLogin || !deleteTarget) return;
            setDeleting(true);
            setDeleteError(null);
            try {
              const res = await fetch(`${backendUrl}/commands/custom/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  login: channelLogin,
                  command: deleteTarget,
                }),
              });
              if (!res.ok) {
                setDeleteError("Failed to delete command. Please try again.");
              } else {
                setCustomCommands((prev) => prev.filter((cmd) => cmd.name !== deleteTarget));
                setDeleteTarget(null);
              }
            } catch {
              setDeleteError("Network error while deleting command.");
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </main>
  );
}

// Delete confirmation modal overlay
function DeleteCommandModal({
  commandName,
  onCancel,
  onConfirm,
  deleting,
  error,
}: {
  commandName: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/95 p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Delete command</h2>
        <p className="text-sm text-slate-300 mb-3">
          Are you sure you want to delete
          <span className="font-mono text-red-300"> {commandName} </span>
          for this channel? This action cannot be undone.
        </p>
        {error && <div className="mb-2 text-xs text-red-400">{error}</div>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800/80 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
