"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

const defaultCommands = [
  { name: "!hello", description: "Greets chat with the bot's name.", enabled: true },
  { name: "!vanish", description: "Times out the user briefly with a playful message.", enabled: true },
  { name: "!title <new title>", description: "Changes the stream title (broadcaster or mods only).", enabled: true },
  { name: "!game <category>", description: "Changes the Twitch category/game (broadcaster or mods only).", enabled: true },
  { name: "!accountage [username]", description: "Shows when a user's Twitch account was created.", enabled: true },
  { name: "!followage [username]", description: "Shows how long a user has followed the channel.", enabled: true },
  { name: "!uptime", description: "Shows how long the channel has been live this session.", enabled: true },
  { name: "!commands", description: "Links viewers to your channel's custom commands page.", enabled: true },
];

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
  const [commandsOpen, setCommandsOpen] = useState(true);
  const [view, setView] = useState<"default" | "custom">("default");
  const [defaultSettings, setDefaultSettings] = useState<Record<string, boolean>>({});
  const [customCommands, setCustomCommands] = useState<{ name: string; description: string; enabled: boolean }[]>([]);
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
        const data: { commands?: { name: string; response: string; enabled?: boolean }[] } = await res.json();
        const rows = (data.commands || []).map((c) => ({
          name: c.name,
          description: c.response,
          enabled: c.enabled ?? true,
        }));
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

  const rows = useMemo(
    () => (view === "default" ? defaultCommands : customCommands),
    [view, customCommands],
  );

  return (
    <main className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <header className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="mr-2 rounded-lg bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 border border-slate-700"
          >
            ☰
          </button>
          <Image
            src={AxyraBotPFP}
            alt="AxyraBot logo"
            width={32}
            height={32}
            className="rounded-full border border-slate-700 shadow-sm shadow-sky-500/40"
          />
          <div className="text-2xl font-semibold tracking-tight">
            <span className="text-accent">Axyra</span>
            <span className="text-white">Bot</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={primaryHref}
            className="hidden"
          >
            {primaryLabel}
          </a>
          {isLoggedIn && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-1.5 py-1 hover:bg-slate-800 transition"
              >
                {avatarUrl && (
                  <Image
                    src={avatarUrl}
                    alt="Twitch profile picture"
                    width={32}
                    height={32}
                    className="rounded-full border border-slate-700"
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
          )}
        </div>
      </header>

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch">
        <div
          className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}
        >
          <nav className="mt-1 flex flex-col gap-2 text-sm text-slate-200">
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">🏠</span>
              {sidebarOpen && <span>Home</span>}
            </Link>
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/dashboard" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">📊</span>
              {sidebarOpen && <span>Dashboard</span>}
            </Link>
            <Link
              href="/privacy"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/privacy" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">🔒</span>
              {sidebarOpen && <span>Privacy</span>}
            </Link>
            <Link
              href="/terms"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/terms" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">📜</span>
              {sidebarOpen && <span>Terms</span>}
            </Link>
            <Link
              href="/api-docs"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/api-docs" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">📘</span>
              {sidebarOpen && <span>API Docs</span>}
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
          </nav>
        </div>

        <div className="flex-1 flex flex-col gap-6 text-slate-50">
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
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

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-900/80 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Command</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold w-32 text-center">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-4 py-2 font-mono text-slate-100">{row.name}</td>
                      <td className="px-4 py-2 text-slate-300">{row.description}</td>
                      <td className="px-4 py-2 text-center">
                        {view === "default" && channelLogin && loggedInLogin === channelLogin ? (
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
                          ) : view === "custom" && isLoggedIn && channelLogin && loggedInLogin === channelLogin ? (
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
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-slate-400">
                        No commands to display yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
