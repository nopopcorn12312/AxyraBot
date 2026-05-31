"use client";

import Image from "next/image";
import type React from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function DashboardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [login, setLogin] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamCategory, setStreamCategory] = useState("");
  const [categorySuggestions, setCategorySuggestions] = useState<{id: string; name: string; box_art_url: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const categoryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryWrapperRef = useRef<HTMLDivElement | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [savingStream, setSavingStream] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [changesConfirmed, setChangesConfirmed] = useState(false);
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
  const [activity, setActivity] = useState<
    { source: string; category: string; description: string; timestamp: string }[]
  >([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedActivityRef = useRef(false);
  const pathname = usePathname();

  // Close category dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryWrapperRef.current && !categoryWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      setLogin(storedLogin);
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
    setLoadingStream(true);
    setStatusMessage(null);
    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/stream/info?login=${encodeURIComponent(
        login
      )}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load stream info");
        }
        return res.json();
      })
      .then((data) => {
        setStreamTitle(data.title || "");
        setStreamCategory(data.category || "");
      })
      .catch((err) => {
        console.error(err);
        setStatusMessage("Could not load stream info.");
      })
      .finally(() => setLoadingStream(false));
  }, [login]);

  // Load recent activity for the logged-in channel and auto-refresh on an interval.
  useEffect(() => {
    if (!login) return;

    let cancelled = false;

    const fetchActivity = () => {
      const isInitial = !hasLoadedActivityRef.current;
      if (isInitial) {
        setLoadingActivity(true);
        setActivityError(null);
      }
      fetch(
        `${backendUrl}/audit/logs?login=${encodeURIComponent(login)}&limit=20`,
      )
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("Failed to load activity");
          }
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          const logs = (data.logs || []) as {
            source: string;
            category: string;
            description: string;
            timestamp: string;
          }[];
          setActivity(logs);
          hasLoadedActivityRef.current = true;
        })
        .catch((err) => {
          if (cancelled) return;
          console.error(err);
          setActivityError("Could not load recent activity.");
        })
        .finally(() => {
          if (cancelled) return;
          if (isInitial) {
            // Only change the loading flag for the very first load.
            setLoadingActivity(false);
          }
        });
    };

    // Initial load
    fetchActivity();

    // Poll periodically to keep the feed fresh.
    const intervalId = window.setInterval(fetchActivity, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [login]);

  // Determine whether the current channel is already joined
  useEffect(() => {
    if (!login) return;
    fetch(`${backendUrl}/channels`)
      .then((res) => res.json())
      .then((data) => {
        const chans: string[] = data.channels || [];
        const lower = login.toLowerCase();
        setJoined(chans.some((c) => c.toLowerCase() === lower));
      })
      .catch((err) => {
        console.error(err);
      });
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
  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const handleJoinChannel = async () => {
    if (!login) return;
    setJoining(true);
    setStatusMessage(null);
    try {
      const endpoint = joined ? "/part" : "/join";
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      if (!res.ok) {
        throw new Error("Failed to update bot connection");
      }
      setJoined(!joined);
      setStatusMessage(!joined ? "Bot joined your channel." : "Bot left your channel.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Could not update bot connection.");
    } finally {
      setJoining(false);
    }
  };

  const handleConfirmChanges = async () => {
    if (!login) return;
    setSavingStream(true);
    setStatusMessage(null);
    setChangesConfirmed(false);
    try {
      const res = await fetch(`${backendUrl}/stream/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          title: streamTitle,
          category: streamCategory,
        }),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to update stream details");
      }
      setChangesConfirmed(true);
      setStatusMessage("Stream details updated.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Could not update stream details.");
    } finally {
      setSavingStream(false);
      setTimeout(() => setChangesConfirmed(false), 3000);
    }
  };

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <header className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            type="button"
            onClick={() => setSidebarOpen((open: boolean) => !open)}
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
                  onClick={() => setMenuOpen((open: boolean) => !open)}
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
                onClick={() => setMainSectionOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Main</span>
                {sidebarOpen && <span className="text-base font-bold">{mainSectionOpen ? "▾" : "▸"}</span>}
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
                    onClick={() => setCommandsOpen((open: boolean) => !open)}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-800/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">❓</span>
                      {sidebarOpen && <span>Commands</span>}
                    </div>
                    {sidebarOpen && (
                      <span className="text-base font-bold text-slate-400">{commandsOpen ? "▾" : "▸"}</span>
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

            {/* Moderation section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setModerationOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Moderation</span>
                {sidebarOpen && (
                  <span className="text-base font-bold">{moderationOpen ? "▾" : "▸"}</span>
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
                onClick={() => setVanitySectionOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Vanity</span>
                {sidebarOpen && <span className="text-base font-bold">{vanitySectionOpen ? "▾" : "▸"}</span>}
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
                  <Link
                    href="/roles"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/roles"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🎭</span>
                    {sidebarOpen && <span>Roles</span>}
                  </Link>
                </>
              )}
            </div>

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOtherSectionOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Other</span>
                {sidebarOpen && <span className="text-base font-bold">{otherSectionOpen ? "▾" : "▸"}</span>}
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

        <div className="flex-1 flex flex-col lg:flex-row gap-6 text-slate-50 min-h-0">
          <div className="flex-1 lg:basis-2/3 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl font-semibold">Recent Activity</h1>
              <span className="text-xs text-slate-400">Latest changes from Twitch &amp; AxyraBot</span>
            </div>
            {!login && (
              <p className="text-sm text-slate-400">
                Connect with Twitch to see recent activity for your channel.
              </p>
            )}
            {login && (
              <div className="flex-1 flex flex-col overflow-y-auto pr-1">
                {loadingActivity && (
                  <p className="text-sm text-slate-400">Loading activity…</p>
                )}
                {activityError && !loadingActivity && (
                  <p className="text-sm text-rose-400">{activityError}</p>
                )}
                {!loadingActivity && !activityError && activity.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No recent activity yet. Changes you make with AxyraBot and
                    certain Twitch events (like follows and going live) will
                    appear here.
                  </p>
                )}
                {!loadingActivity && !activityError && activity.length > 0 && (
                  <ul className="mt-1 text-sm divide-y divide-slate-800/60">
                    {activity.map((item, idx) => {
                      const source = item.source?.toLowerCase();
                      const isTwitch = source === "twitch";
                      const badgeClasses = isTwitch
                        ? "bg-violet-600/80 text-violet-50 border-violet-400/60"
                        : "bg-sky-600/80 text-sky-50 border-sky-400/60";
                      const badgeLabel = isTwitch ? "Twitch" : "AxyraBot";
                      const isEven = idx % 2 === 0;
                      return (
                        <li
                          key={`${item.timestamp}-${idx}`}
                          className={`flex items-start gap-3 px-2 py-2.5 rounded-lg ${
                            isEven
                              ? "bg-slate-900/40"
                              : "bg-slate-950/60"
                          }`}
                        >
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              isTwitch ? "bg-violet-400" : "bg-sky-400"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClasses}`}
                              >
                                {badgeLabel}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>
                            <p className="text-slate-200 leading-snug">
                              {item.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="w-full lg:basis-1/3 h-72 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Stream Details</h2>
                <div className="flex items-center gap-2 text-sm md:text-base font-medium text-slate-200">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      joined ? "bg-emerald-400" : "bg-red-500"
                    }`}
                  />
                  <span>{joined ? "Bot is connected" : "Bot is not connected"}</span>
                </div>
              </div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Stream Title
              </label>
              <input
                type="text"
                className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                placeholder="Current stream title"
                value={streamTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStreamTitle(e.target.value)
                }
                disabled={!login || loadingStream}
              />
              <label className="block text-sm font-semibold text-slate-300 mb-2 mt-1">
                Stream Category
              </label>
              <div className="relative" ref={categoryWrapperRef}>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                  placeholder="Search Twitch categories…"
                  value={streamCategory}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value;
                    setStreamCategory(val);
                    setShowSuggestions(true);
                    if (categoryDebounceRef.current) clearTimeout(categoryDebounceRef.current);
                    if (val.trim().length < 2) { setCategorySuggestions([]); return; }
                    categoryDebounceRef.current = setTimeout(() => {
                      if (!login) return;
                      fetch(`${backendUrl}/categories/search?q=${encodeURIComponent(val)}&login=${encodeURIComponent(login)}`)
                        .then(r => r.json())
                        .then(d => setCategorySuggestions(d.data ?? []))
                        .catch(() => setCategorySuggestions([]));
                    }, 300);
                  }}
                  onFocus={() => { if (categorySuggestions.length > 0) setShowSuggestions(true); }}
                  disabled={!login || loadingStream}
                  autoComplete="off"
                />
                {showSuggestions && categorySuggestions.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
                    {categorySuggestions.map((cat) => (
                      <li key={cat.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setStreamCategory(cat.name);
                            setCategorySuggestions([]);
                            setShowSuggestions(false);
                          }}
                        >
                          {cat.box_art_url && (
                            <img
                              src={cat.box_art_url.replace("{width}", "30").replace("{height}", "40")}
                              alt=""
                              className="h-8 w-6 rounded object-cover shrink-0"
                            />
                          )}
                          <span>{cat.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handleJoinChannel}
                  disabled={!login || joining}
                  className={`flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition ${
                    joined
                      ? "bg-red-500 hover:bg-red-400 shadow-red-500/40"
                      : "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/40"
                  }`}
                >
                  {joining
                    ? joined
                      ? "Parting..."
                      : "Joining..."
                    : joined
                    ? "Part channel"
                    : "Join channel"}
                </button>
                <button
                  onClick={handleConfirmChanges}
                  disabled={!login || savingStream}
                  className={`flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition ${
                    changesConfirmed
                      ? "bg-emerald-500 text-white shadow-emerald-500/40 hover:bg-emerald-400"
                      : "bg-accent text-slate-900 shadow-sky-500/40 hover:bg-sky-400"
                  }`}
                >
                  {savingStream
                    ? "Saving..."
                    : changesConfirmed
                    ? "Changed Confirmed"
                    : "Confirm Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
