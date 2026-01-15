"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

const defaultLiveAnnouncementMessage = "$(channel) is now live! Streaming $(game) | $(title)";

type ModuleRow = {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  message: string;
};

type BirthdayCommandConfig = {
  name: string;
  enabled: boolean;
  message: string;
};

type ToggleProps = {
  enabled: boolean;
  onChange: (next: boolean) => void;
};

function ModuleToggle({ enabled, onChange }: ToggleProps) {
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

export default function ModulesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = useState(true);
  const [vanitySectionOpen, setVanitySectionOpen] = useState(true);
  const [otherSectionOpen, setOtherSectionOpen] = useState(true);
  const [commandsOpen, setCommandsOpen] = useState(true);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [birthdayCommands, setBirthdayCommands] = useState<BirthdayCommandConfig[]>([]);
  const [loadingBirthdayCommands, setLoadingBirthdayCommands] = useState(false);
  const [birthdayCommandsError, setBirthdayCommandsError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      setLogin(storedLogin.toLowerCase());
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
  }, []);

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

  useEffect(() => {
    if (!login) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/modules/settings?login=${encodeURIComponent(login)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error("Failed to load modules");
        }
        const data: { modules?: ModuleRow[] } = await res.json();
        setModules(data.modules || []);
      } catch (err) {
        console.error(err);
        setError("Could not load modules.");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [login]);

  // When the birthdays module dropdown is opened, load per-command defaults
  // and any custom messages.
  useEffect(() => {
    if (!login || openModule !== "birthdays") return;
    let cancelled = false;
    setLoadingBirthdayCommands(true);
    setBirthdayCommandsError(null);
    (async () => {
      try {
        const [defaultsRes, messagesRes] = await Promise.all([
          fetch(
            `${backendUrl}/commands/default-settings?login=${encodeURIComponent(login)}`,
          ),
          fetch(
            `${backendUrl}/birthdays/command-messages?login=${encodeURIComponent(login)}`,
          ),
        ]);
        if (!defaultsRes.ok || !messagesRes.ok) {
          throw new Error("Failed to load birthday command settings");
        }
        const defaultsJson: { commands?: { name: string; enabled: boolean }[] } =
          await defaultsRes.json();
        const messagesJson: { commands?: { name: string; message: string }[] } =
          await messagesRes.json();
        const defaultsMap: Record<string, boolean> = {};
        for (const row of defaultsJson.commands || []) {
          defaultsMap[row.name.toLowerCase()] = row.enabled;
        }
        const messagesMap: Record<string, string> = {};
        for (const row of messagesJson.commands || []) {
          messagesMap[row.name.toLowerCase()] = row.message ?? "";
        }
        const birthdayNames = [
          "!birthday",
          "!nextbday",
          "!addbday",
          "!addmybday",
          "!delbday",
          "!editbday",
        ];
        const configs: BirthdayCommandConfig[] = birthdayNames.map((name) => {
          const key = name.toLowerCase();
          return {
            name,
            enabled: defaultsMap[key] ?? true,
            message: messagesMap[key] ?? "",
          };
        });
        if (!cancelled) {
          setBirthdayCommands(configs);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setBirthdayCommandsError("Could not load birthday command settings.");
        }
      } finally {
        if (!cancelled) {
          setLoadingBirthdayCommands(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login, openModule]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setLogin(null);
    setMenuOpen(false);
  };

  const redirectTarget = frontendUrl || "http://localhost:3000";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const handleToggle = async (moduleName: string, next: boolean) => {
    if (!login) return;
    setModules((prev) =>
      prev.map((m) => (m.name === moduleName ? { ...m, enabled: next } : m)),
    );
    try {
      const res = await fetch(`${backendUrl}/modules/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, module: moduleName, enabled: next }),
      });
      if (!res.ok) {
        throw new Error("Failed to save module setting");
      }
    } catch (err) {
      console.error(err);
      // revert on failure
      setModules((prev) =>
        prev.map((m) =>
          m.name === moduleName ? { ...m, enabled: !next } : m,
        ),
      );
    }
  };

  const handleBirthdayCommandToggle = async (commandName: string, next: boolean) => {
    if (!login) return;
    setBirthdayCommands((prev) =>
      prev.map((c) => (c.name === commandName ? { ...c, enabled: next } : c)),
    );
    try {
      const res = await fetch(`${backendUrl}/commands/default-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, command: commandName, enabled: next }),
      });
      if (!res.ok) {
        throw new Error("Failed to save command setting");
      }
      if (commandName.toLowerCase() === "!birthday") {
        setModules((prev) =>
          prev.map((m) =>
            m.name === "birthdays" ? { ...m, enabled: next } : m,
          ),
        );
      }
    } catch (err) {
      console.error(err);
      setBirthdayCommands((prev) =>
        prev.map((c) =>
          c.name === commandName ? { ...c, enabled: !next } : c,
        ),
      );
    }
  };

  const handleBirthdayCommandMessageSave = async (
    commandName: string,
    message: string,
  ) => {
    if (!login) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`${backendUrl}/birthdays/command-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, command: commandName, message: trimmed }),
      });
      if (!res.ok) {
        throw new Error("Failed to save message");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBirthdayCommandMessageReset = async (commandName: string) => {
    if (!login) return;
    try {
      const res = await fetch(`${backendUrl}/birthdays/command-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          command: commandName,
          resetToDefault: true,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to reset message");
      }
      setBirthdayCommands((prev) =>
        prev.map((c) => (c.name === commandName ? { ...c, message: "" } : c)),
      );
    } catch (err) {
      console.error(err);
    }
  };

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
          <a href={primaryHref} className="hidden">
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

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch">
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
                          pathname === "/commands"
                            ? "bg-slate-800/80 text-slate-50"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        Default commands
                      </Link>
                      <Link
                        href="/commands?view=custom"
                        className={`rounded-lg px-3 py-1.5 transition ${
                          pathname === "/commands"
                            ? "bg-slate-800/80 text-slate-50"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        Custom commands
                      </Link>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setModerationOpen((open) => !open)}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-800/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🛡️</span>
                      {sidebarOpen && <span>Moderation</span>}
                    </div>
                    {sidebarOpen && (
                      <span className="text-xs text-slate-400">{moderationOpen ? "▾" : "▸"}</span>
                    )}
                  </button>
                  {moderationOpen && (
                    <div className="mt-1 ml-6 flex flex-col gap-1 text-xs text-slate-200">
                      <Link
                        href="/moderation/blocked-terms"
                        className={`rounded-lg px-3 py-1.5 transition ${
                          pathname === "/moderation/blocked-terms"
                            ? "bg-slate-800/80 text-slate-50"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        Blocked Terms
                      </Link>
                      <Link
                        href="/moderation/spam-filters"
                        className={`rounded-lg px-3 py-1.5 transition ${
                          pathname === "/moderation/spam-filters"
                            ? "bg-slate-800/80 text-slate-50"
                            : "hover:bg-slate-800/60"
                        }`}
                      >
                        Spam Filters
                      </Link>
                    </div>
                  )}
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

        <div className="flex-1 flex flex-col gap-6 text-slate-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h1 className="text-2xl font-semibold mb-2">Modules</h1>
            <p className="text-sm text-slate-400 mb-4">
              Enable or disable optional automation modules for your channel.
            </p>
            {!login && (
              <p className="text-sm text-slate-400">
                Log in on the homepage to manage modules for your channel.
              </p>
            )}
            {login && (
              <>
                {loading && (
                  <p className="text-sm text-slate-400">Loading modules…</p>
                )}
                {error && (
                  <p className="text-sm text-red-400 mb-2">{error}</p>
                )}
                <div className="space-y-4 mt-2">
                  {modules.map((m) => (
                    <div
                      key={m.name}
                      className="rounded-xl border border-slate-800 bg-slate-950/50"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenModule((current) =>
                            current === m.name ? null : m.name,
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-medium text-slate-100">
                            {m.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {m.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">
                            {openModule === m.name ? "▾" : "▸"}
                          </span>
                          <ModuleToggle
                            enabled={m.enabled}
                            onChange={(next) => handleToggle(m.name, next)}
                          />
                        </div>
                      </button>

                      {/* Live announcement dropdown */}
                      {openModule === m.name && m.name === "live_announcement" && (
                        <div className="border-t border-slate-800 px-4 py-3">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-200">
                              Announcement message
                            </span>
                          </div>
                          <p className="mb-1 text-xs text-slate-400">
                            Current message: {m.message || defaultLiveAnnouncementMessage}
                          </p>
                          <div className="mt-3 border-t border-slate-800 pt-3">
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-medium text-slate-300">
                                Announcement message
                              </label>
                              <input
                                type="text"
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                placeholder={defaultLiveAnnouncementMessage}
                              />
                              <p className="text-[11px] text-slate-400">
                                You can use $(channel), $(game), and $(title) as
                                variables.
                              </p>
                              {editError && (
                                <div className="text-xs text-red-400">{editError}</div>
                              )}
                              <div className="mt-1 flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMessage(m.message ?? "");
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
                                    if (!login) return;
                                    setSavingEdit(true);
                                    setEditError(null);
                                    try {
                                      const res = await fetch(`${backendUrl}/modules/settings`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login,
                                          module: "live_announcement",
                                          enabled: m.enabled,
                                          resetToDefault: true,
                                        }),
                                      });
                                      if (!res.ok) {
                                        setEditError("Failed to restore default. Please try again.");
                                      } else {
                                        const nextMessage = defaultLiveAnnouncementMessage;
                                        setModules((prev) =>
                                          prev.map((mod) =>
                                            mod.name === "live_announcement"
                                              ? { ...mod, message: nextMessage }
                                              : mod,
                                          ),
                                        );
                                        setEditMessage(nextMessage);
                                      }
                                    } catch {
                                      setEditError("Network error while restoring default.");
                                    } finally {
                                      setSavingEdit(false);
                                    }
                                  }}
                                  className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800/80 disabled:opacity-60"
                                  disabled={savingEdit}
                                >
                                  Restore Default
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!login) return;
                                    const trimmed = editMessage.trim();
                                    if (!trimmed) {
                                      setEditError("Message cannot be empty.");
                                      return;
                                    }
                                    setSavingEdit(true);
                                    setEditError(null);
                                    try {
                                      const res = await fetch(`${backendUrl}/modules/settings`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login,
                                          module: "live_announcement",
                                          enabled: m.enabled,
                                          message: trimmed,
                                        }),
                                      });
                                      if (!res.ok) {
                                        setEditError("Failed to save changes. Please try again.");
                                      } else {
                                        setModules((prev) =>
                                          prev.map((mod) =>
                                            mod.name === "live_announcement"
                                              ? { ...mod, message: trimmed }
                                              : mod,
                                          ),
                                        );
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
                          </div>
                        </div>
                      )}

                      {/* Birthdays module dropdown */}
                      {openModule === m.name && m.name === "birthdays" && (
                        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-200">
                          <p className="mb-2 text-slate-400">
                            Control individual birthday commands and customize how the bot responds.
                          </p>
                          {birthdayCommandsError && (
                            <p className="mb-2 text-red-400">{birthdayCommandsError}</p>
                          )}
                          {loadingBirthdayCommands && (
                            <p className="mb-2 text-slate-400">Loading birthday commands…</p>
                          )}
                          {!loadingBirthdayCommands && (
                            <div className="space-y-3">
                              {birthdayCommands.map((cmd) => {
                                const canEditMessage =
                                  cmd.name === "!birthday" || cmd.name === "!nextbday";
                                return (
                                <div
                                  key={cmd.name}
                                  className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-100">
                                          {cmd.name}
                                        </span>
                                      </div>
                                    </div>
                                    <ModuleToggle
                                      enabled={cmd.enabled}
                                      onChange={(next) =>
                                        handleBirthdayCommandToggle(cmd.name, next)
                                      }
                                    />
                                  </div>
                                  {canEditMessage && (
                                    <div className="mt-2 flex flex-col gap-1">
                                      <input
                                        type="text"
                                        value={cmd.message}
                                        onChange={(e) =>
                                          setBirthdayCommands((prev) =>
                                            prev.map((c) =>
                                              c.name === cmd.name
                                                ? { ...c, message: e.target.value }
                                                : c,
                                            ),
                                          )
                                        }
                                        className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                                        placeholder="Leave empty to use the default response"
                                      />
                                      <p className="text-[10px] text-slate-400">
                                        You can use simple placeholders like
                                        {" "}
                                        <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px]">
                                          $(names)
                                        </code>
                                        ,
                                        {" "}
                                        <code className="rounded bg-slate-800 px-1 py-0.5 text-[10px]">
                                          $(date)
                                        </code>
                                        .
                                      </p>
                                      <div className="mt-1 flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleBirthdayCommandMessageReset(cmd.name)
                                          }
                                          className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800/80"
                                        >
                                          Reset
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleBirthdayCommandMessageSave(
                                              cmd.name,
                                              cmd.message,
                                            )
                                          }
                                          className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent/90"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );})}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {modules.length === 0 && !loading && !error && (
                    <p className="text-sm text-slate-400">
                      No modules available yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
