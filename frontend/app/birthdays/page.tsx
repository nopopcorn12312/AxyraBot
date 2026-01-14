"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type BirthdayRow = {
  userLogin: string;
  displayName: string;
  month: number;
  day: number;
};

export default function BirthdaysPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = useState(true);
  const [vanitySectionOpen, setVanitySectionOpen] = useState(true);
  const [otherSectionOpen, setOtherSectionOpen] = useState(true);
  const [commandsOpen, setCommandsOpen] = useState(true);
  const [timezone, setTimezone] = useState("");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [timezoneStatus, setTimezoneStatus] = useState<string | null>(null);
  const [birthdays, setBirthdays] = useState<BirthdayRow[]>([]);
  const [loadingBirthdays, setLoadingBirthdays] = useState(false);
  const [birthdaysError, setBirthdaysError] = useState<string | null>(null);
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

  // Load timezone settings for the broadcaster and default to the browser
  // timezone when none is set yet.
  useEffect(() => {
    if (!login) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/birthdays/settings?login=${encodeURIComponent(login)}`,
        );
        if (!res.ok) return;
        const data: { timezone?: string } = await res.json();
        let tz = (data.timezone || "").trim();
        if (!tz && typeof Intl !== "undefined") {
          try {
            const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (guess) tz = guess;
          } catch {
            // ignore
          }
        }
        if (!cancelled) {
          setTimezone(tz);
        }
      } catch {
        // ignore initial load errors for settings
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login]);

  // Load all stored birthdays for this broadcaster.
  useEffect(() => {
    if (!login) return;
    const controller = new AbortController();
    setLoadingBirthdays(true);
    setBirthdaysError(null);
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/birthdays/list?login=${encodeURIComponent(login)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error("Failed to load birthdays");
        }
        const data: { birthdays?: BirthdayRow[] } = await res.json();
        setBirthdays(data.birthdays || []);
      } catch (err) {
        console.error(err);
        if (!controller.signal.aborted) {
          setBirthdaysError("Could not load birthdays.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingBirthdays(false);
        }
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

  const handleSaveTimezone = async () => {
    if (!login) return;
    const trimmed = timezone.trim();
    if (!trimmed) {
      setTimezoneError("Timezone cannot be empty.");
      setTimezoneStatus(null);
      return;
    }
    setTimezoneSaving(true);
    setTimezoneError(null);
    setTimezoneStatus(null);
    try {
      const res = await fetch(`${backendUrl}/birthdays/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, timezone: trimmed }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          setTimezoneError("That doesn&apos;t look like a valid timezone.");
        } else {
          setTimezoneError("Failed to save timezone. Please try again.");
        }
        return;
      }
      setTimezoneStatus("Timezone saved.");
      setTimeout(() => setTimezoneStatus(null), 3000);
    } catch {
      setTimezoneError("Network error while saving timezone.");
    } finally {
      setTimezoneSaving(false);
    }
  };

  const formatMonthDay = (m: number, d: number) => {
    const mm = m.toString().padStart(2, "0");
    const dd = d.toString().padStart(2, "0");
    return `${mm}/${dd}`;
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
          )}
        </div>
      </header>

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch">
        <div
          className={`$${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}
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
            <h1 className="text-2xl font-semibold mb-2">Birthdays</h1>
            <p className="text-sm text-slate-400 mb-4">
              View birthdays saved for your channel and choose the timezone the bot
              should use when announcing birthdays.
            </p>
            {!login && (
              <p className="text-sm text-slate-400">
                Log in on the homepage to manage birthdays for your channel.
              </p>
            )}
            {login && (
              <div className="space-y-6 mt-2">
                <section className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-100 mb-2">
                    Timezone
                  </h2>
                  <p className="text-xs text-slate-400 mb-2">
                    Enter your timezone in IANA format (for example
                    {" "}
                    <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-[11px]">
                      America/New_York
                    </code>
                    or
                    {" "}
                    <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-[11px]">
                      Europe/London
                    </code>
                    ). The bot will use this timezone when deciding which
                    birthdays are &quot;today&quot;.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="flex-1 rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                      placeholder="e.g. America/Los_Angeles"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTimezone}
                      disabled={timezoneSaving}
                      className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                    >
                      {timezoneSaving ? "Saving..." : "Save timezone"}
                    </button>
                  </div>
                  {timezoneError && (
                    <p className="mt-2 text-xs text-red-400">{timezoneError}</p>
                  )}
                  {timezoneStatus && (
                    <p className="mt-2 text-xs text-emerald-400">{timezoneStatus}</p>
                  )}
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-100 mb-2">
                    Saved birthdays
                  </h2>
                  {loadingBirthdays && (
                    <p className="text-xs text-slate-400">Loading birthdays…</p>
                  )}
                  {birthdaysError && (
                    <p className="text-xs text-red-400">{birthdaysError}</p>
                  )}
                  {!loadingBirthdays && !birthdaysError && birthdays.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No birthdays have been saved yet. Mods can add birthdays
                      from chat using
                      {" "}
                      <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-[11px]">
                        !addbday
                      </code>
                      {" "}
                      and viewers can add their own with
                      {" "}
                      <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-[11px]">
                        !addmybday
                      </code>
                      .
                    </p>
                  )}
                  {!loadingBirthdays && !birthdaysError && birthdays.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-400">
                            <th className="py-1 pr-3">Name</th>
                            <th className="py-1 pr-3">Username</th>
                            <th className="py-1 pr-3">Birthday</th>
                          </tr>
                        </thead>
                        <tbody>
                          {birthdays.map((b) => (
                            <tr key={`${b.userLogin}-${b.month}-${b.day}`} className="border-b border-slate-900/60">
                              <td className="py-1 pr-3 text-slate-100">
                                {b.displayName || b.userLogin}
                              </td>
                              <td className="py-1 pr-3 text-slate-400">{b.userLogin}</td>
                              <td className="py-1 pr-3 text-slate-200">
                                {formatMonthDay(b.month, b.day)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
