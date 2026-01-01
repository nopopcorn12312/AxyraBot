"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type ModuleRow = {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
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
  const [commandsOpen, setCommandsOpen] = useState(true);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          <a href={primaryHref} className="hidden">
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
                pathname === "/"
                  ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">🏠</span>
              {sidebarOpen && <span>Home</span>}
            </Link>

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

            <button
              type="button"
              onClick={() => setCommandsOpen((open) => !open)}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-800/80 transition`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">❓</span>
                {sidebarOpen && <span>Commands</span>}
              </div>
              {sidebarOpen && (
                <span className="text-xs text-slate-400">
                  {commandsOpen ? "▾" : "▸"}
                </span>
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
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-100">
                          {m.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {m.description}
                        </span>
                      </div>
                      <ModuleToggle
                        enabled={m.enabled}
                        onChange={(next) => handleToggle(m.name, next)}
                      />
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
