"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";

type GiveawayEntry = {
  login: string;
  displayName: string;
  isSubscriber: boolean;
  enteredAt: string;
};

type GiveawayStateData = {
  active: boolean;
  type: "active" | "keyword";
  keyword: string;
  inactivitySec: number;
  subMultiplier: number;
  chatAnnounce: boolean;
  entries: GiveawayEntry[];
  winner: GiveawayEntry | null;
};

export default function GiveawaysPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
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
  const [moderationOpen, setModerationOpen] = usePersistentSectionState(
    "axyra.sidebar.moderationOpen",
    true,
  );

  // Giveaway settings (local form state)
  const [keyword, setKeyword] = useState("");
  const [subMultiplier, setSubMultiplier] = useState(1);

  // Live state from backend
  const [giveaway, setGiveaway] = useState<GiveawayStateData | null>(null);
  const [loadingToggle, setLoadingToggle] = useState(false);
  const [pickingWinner, setPickingWinner] = useState(false);

  // Users panel
  const [userSearch, setUserSearch] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSyncDone = useRef(false);
  const pathname = usePathname();

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      const ac = window.localStorage.getItem("axyra.activeChannel");
      if (ac && ac.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
      setLogin((ac || storedLogin).toLowerCase());
      setActiveChannel((ac || storedLogin).toLowerCase());
    }
    if (storedAvatar) setAvatarUrl(storedAvatar);
  }, []);

  // ── Close menu on outside click ─────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Poll giveaway state ─────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    if (!login) return;
    try {
      const res = await fetch(`${backendUrl}/giveaway/state?login=${encodeURIComponent(login)}`);
      if (!res.ok) return;
      const data: GiveawayStateData = await res.json();
      setGiveaway(data);
      // Only sync form fields on first load — never overwrite while user is typing
      if (!initialSyncDone.current) {
        initialSyncDone.current = true;
        setKeyword(data.keyword ?? "");
        setSubMultiplier(data.subMultiplier ?? 1);
      }
    } catch {
      // ignore
    }
  }, [login]);

  useEffect(() => {
    if (!login) return;
    fetchState();
    pollRef.current = setInterval(fetchState, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [login, fetchState]);

  // ── Toggle giveaway ─────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!login) return;
    setLoadingToggle(true);
    try {
      const isActive = giveaway?.active ?? false;
      if (isActive) {
        await fetch(`${backendUrl}/giveaway/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login }),
        });
      } else {
        await fetch(`${backendUrl}/giveaway/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login,
            type: "keyword",
            keyword: keyword.trim(),
            inactivitySec: 0,
            subMultiplier,
            chatAnnounce: true,
          }),
        });
      }
      await fetchState();
    } catch {
      // ignore
    } finally {
      setLoadingToggle(false);
    }
  };

  // ── Pick winner ─────────────────────────────────────────────────────────
  const handlePickWinner = async () => {
    if (!login) return;
    setPickingWinner(true);
    try {
      await fetch(`${backendUrl}/giveaway/pick-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      await fetchState();
    } catch {
      // ignore
    } finally {
      setPickingWinner(false);
    }
  };

  // ── Clear entries ───────────────────────────────────────────────────────
  const handleClear = async () => {
    if (!login) return;
    await fetch(`${backendUrl}/giveaway/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login }),
    });
    await fetchState();
  };

  // ── Remove entry ────────────────────────────────────────────────────────
  const handleRemoveEntry = async (userLogin: string) => {
    if (!login) return;
    await fetch(`${backendUrl}/giveaway/remove-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, userLogin }),
    });
    setGiveaway((prev) =>
      prev ? { ...prev, entries: prev.entries.filter((e) => e.login !== userLogin) } : prev,
    );
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
      window.localStorage.removeItem("axyra.activeChannel");
      window.location.href = "/";
    }
  };

  const isActive = giveaway?.active ?? false;
  const entries = giveaway?.entries ?? [];
  const winner = giveaway?.winner ?? null;

  const filteredEntries = userSearch.trim()
    ? entries.filter(
        (e) =>
          e.login.toLowerCase().includes(userSearch.toLowerCase()) ||
          e.displayName.toLowerCase().includes(userSearch.toLowerCase()),
      )
    : entries;

  // Twitch chat embed — always show broadcaster's chat
  const chatChannel = activeChannel ?? login ?? "";
  const [chatParent, setChatParent] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setChatParent(window.location.hostname);
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      {/* ── Header ── */}
      <header className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
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
                  onClick={() => setMenuOpen((o) => !o)}
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

      {/* ── Body ── */}
      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch min-h-0">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}>
          <nav className="mt-1 flex flex-col gap-4 text-sm text-slate-200">
            {/* Main */}
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
            {/* Moderation */}
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
            {/* Vanity */}
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
            {/* Integrations */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Integrations</span>
              </button>
              <Link href="/discord" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${pathname === "/discord" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"}`}>
                <span className="text-lg">🎮</span>{sidebarOpen && <span>Discord</span>}
              </Link>
            </div>
            {/* Other */}
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

        {/* ── Three-panel giveaway layout ── */}
        <div className="flex flex-1 gap-4 text-slate-50 min-h-0 overflow-hidden">

          {/* Users Panel */}
          <div className="flex w-64 shrink-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-100">Users</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{entries.length} Users</span>
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    title="Clear all entries"
                    className="text-slate-400 hover:text-slate-200 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {/* Search */}
            <div className="relative mb-3">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search Users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {/* Entry list */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
              {filteredEntries.length === 0 && (
                <p className="text-center text-xs text-slate-500 mt-8">
                  {entries.length === 0 ? "No entries yet." : "No results."}
                </p>
              )}
              {filteredEntries.map((e) => (
                <div
                  key={e.login}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-800/60 group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {e.isSubscriber && <span title="Subscriber" className="text-purple-400">★</span>}
                    <span className="truncate text-slate-200">{e.displayName || e.login}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(e.login)}
                    className="ml-1 shrink-0 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Settings Panel */}
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold">Giveaways</h1>
                <p className="text-sm text-slate-400 mt-0.5">Reward your viewers with giveaways.</p>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                disabled={loadingToggle || !login}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
                  isActive
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {isActive ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                    STOP
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" /></svg>
                    START
                  </>
                )}
              </button>
            </div>

            {/* Keyword phrase */}
            <div className="mb-5">
              <input
                type="text"
                placeholder="Keyword Phrase"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                The message must exactly match the keyword — case-sensitive. No extra text allowed.
              </p>
            </div>

            {/* Subscriber luck multiplier */}
            <div className="mb-8">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Subscriber luck multiplier
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={subMultiplier}
                  onChange={(e) => setSubMultiplier(Number(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <div className="flex h-8 w-16 items-center justify-center rounded border border-slate-700 bg-slate-800 text-sm text-slate-100">
                  {subMultiplier}x
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {subMultiplier === 1
                  ? "Subscribers have the same luck as everyone else in the giveaway."
                  : `Subscribers have ${subMultiplier}x more chances to win.`}
              </p>
            </div>

            {/* Winner display / Pick button */}
            {winner ? (
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-yellow-400 mb-1">🎉 Winner</p>
                <p className="text-2xl font-bold text-yellow-200">{winner.displayName || winner.login}</p>
                <p className="text-xs text-slate-400 mt-1">@{winner.login}{winner.isSubscriber ? " · Subscriber" : ""}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickWinner}
                    disabled={pickingWinner || entries.length === 0}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition"
                  >
                    Reroll
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePickWinner}
                disabled={pickingWinner || entries.length === 0}
                className="w-full rounded-lg bg-slate-700/60 py-3 text-sm font-semibold uppercase tracking-widest text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                {entries.length === 0 ? "NO ENTRIES YET" : pickingWinner ? "PICKING…" : "PICK WINNER"}
              </button>
            )}
          </div>

          {/* Chat Panel */}
          <div className="flex w-96 shrink-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h2 className="font-semibold text-slate-100">Stream Chat</h2>
              {chatChannel && (
                <span className="text-xs text-slate-500">#{chatChannel}</span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {chatChannel && chatParent ? (
                <iframe
                  src={`https://www.twitch.tv/embed/${chatChannel}/chat?parent=${chatParent}&darkpopout`}
                  className="h-full w-full border-0"
                  title="Stream Chat"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-500">Log in to view chat.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
