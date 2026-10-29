"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { responsiveSidebarClassName, useResponsiveSidebar } from "../hooks/useResponsiveSidebar";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";
import { Star, Trophy } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";

type GiveawayEntry = {
  login: string;
  displayName: string;
  isSubscriber: boolean;
  isVip: boolean;
  isMod: boolean;
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
  useRequireAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { sidebarOpen, mobileSidebarOpen, toggleSidebar, closeMobileSidebar } = useResponsiveSidebar();
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
  const [chatAnnounce, setChatAnnounce] = useState(true);

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
        setChatAnnounce(data.chatAnnounce ?? true);
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
            chatAnnounce,
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
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      revokeSession();
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
    <main className="min-h-screen flex flex-col bg-ax-bg">
      {/* ── Header ── */}
      <header className="w-full flex h-14 shrink-0 items-center justify-between border-b border-ax-subtle px-4 md:px-5">
        <div className="flex items-center gap-4 flex-1">
          <button
            aria-label="Toggle navigation"
            type="button"
            onClick={toggleSidebar}
            className="mr-2 rounded-md bg-ax-section px-3 py-2 text-sm font-medium text-ax-body hover:bg-ax-raised border border-ax-border"
          >
            <NavIcon name="menu" size={20} tone="inherit" />
          </button>
          <Link href="/" className="flex items-center gap-4">
            <Image src={AxyraBotPFP} alt="AxyraBot logo" width={32} height={32} className="rounded-full" />
            <div className="font-display text-xl font-semibold tracking-tight">
              <span className="text-ax-accent-text">Axyra</span>
              <span className="text-ax-heading">Bot</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {isLoggedIn && (
            <>
              <ManagingChannelBadge />
              <Link
                href="/import"
                className="inline-flex items-center gap-1 rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-xs font-medium text-ax-body hover:bg-ax-raised hover:border-ax-muted transition"
              >
                <NavIcon name="import" size={16} tone="inherit" />
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-md bg-ax-section px-1.5 py-1 hover:bg-ax-raised transition"
                >
                  {avatarUrl && (
                    <Image src={avatarUrl} alt="Twitch profile picture" width={32} height={32} className="rounded-full" />
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-md border border-ax-border bg-ax-section py-2 ">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-left text-ax-body hover:bg-ax-raised"
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
      <div className="flex flex-1 w-full flex-col items-stretch gap-3 px-3 pb-4 pt-3 md:flex-row md:gap-6 md:px-4 md:pb-6 md:pt-6 md:min-h-0">
        {mobileSidebarOpen && <button type="button" aria-label="Close dashboard menu" onClick={closeMobileSidebar} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
        {/* Sidebar */}
        <div className={responsiveSidebarClassName(sidebarOpen, mobileSidebarOpen)}>
          <div className="mb-3 flex items-center justify-between border-b border-ax-subtle px-2 pb-3 md:hidden">
            <span className="text-sm font-semibold text-ax-body">Dashboard menu</span>
            <button type="button" onClick={closeMobileSidebar} className="rounded-md px-2 py-1 text-sm text-ax-secondary hover:bg-ax-raised hover:text-ax-heading">Close</button>
          </div>
          <nav className="mt-1 flex flex-col gap-4 text-sm text-ax-body">
            {/* Main */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={mainSectionOpen} onClick={() => setMainSectionOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Main</span>
                ) : (
                  <>
                    <span className="sr-only">Main</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={mainSectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {mainSectionOpen && (
                <>
                  <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/dashboard"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="dashboard" />{sidebarOpen ? <span>Dashboard</span> : <span className="sr-only">Dashboard</span>}
                  </Link>
                  <Link href="/commands" aria-current={pathname === "/commands" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/commands"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="commands" />{sidebarOpen ? <span>Commands</span> : <span className="sr-only">Commands</span>}
                  </Link>
                </>
              )}
            </div>
            {/* Moderation */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={moderationOpen} onClick={() => setModerationOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Moderation</span>
                ) : (
                  <>
                    <span className="sr-only">Moderation</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={moderationOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {moderationOpen && (
                <>
                  <Link href="/moderation/blocked-terms" aria-current={pathname === "/moderation/blocked-terms" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/moderation/blocked-terms"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="blockedTerms" />{sidebarOpen ? <span>Blocked Terms</span> : <span className="sr-only">Blocked Terms</span>}
                  </Link>
                  <Link href="/moderation/spam-filters" aria-current={pathname === "/moderation/spam-filters" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/moderation/spam-filters"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="spamFilters" />{sidebarOpen ? <span>Spam Filters</span> : <span className="sr-only">Spam Filters</span>}
                  </Link>
                </>
              )}
            </div>
            {/* Vanity */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={vanitySectionOpen} onClick={() => setVanitySectionOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Vanity</span>
                ) : (
                  <>
                    <span className="sr-only">Vanity</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={vanitySectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {vanitySectionOpen && (
                <>
                  <Link href="/modules" aria-current={pathname === "/modules" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/modules"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="modules" />{sidebarOpen ? <span>Modules</span> : <span className="sr-only">Modules</span>}
                  </Link>
                  <Link href="/birthdays" aria-current={pathname === "/birthdays" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/birthdays"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="birthdays" />{sidebarOpen ? <span>Birthdays</span> : <span className="sr-only">Birthdays</span>}
                  </Link>
                  <Link href="/giveaways" aria-current={pathname === "/giveaways" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/giveaways"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="giveaways" />{sidebarOpen ? <span>Giveaways</span> : <span className="sr-only">Giveaways</span>}
                  </Link>
                  {!isEditor && (
                    <Link href="/roles" aria-current={pathname === "/roles" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/roles"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                      <NavIcon name="roles" />{sidebarOpen ? <span>Roles</span> : <span className="sr-only">Roles</span>}
                    </Link>
                  )}
                </>
              )}
            </div>
            {/* Integrations */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary">
                {sidebarOpen ? (
                  <span>Integrations</span>
                ) : (
                  <>
                    <span className="sr-only">Integrations</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
              </button>
              <Link href="/discord/settings" aria-current={pathname === "/discord/settings" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/discord/settings"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                <NavIcon name="discord" />{sidebarOpen ? <span>Discord</span> : <span className="sr-only">Discord</span>}
              </Link>
            </div>
            {/* Other */}
            <div className="flex flex-col gap-2">
              <button type="button" aria-expanded={otherSectionOpen} onClick={() => setOtherSectionOpen((o) => !o)} className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body">
                {sidebarOpen ? (
                  <span>Other</span>
                ) : (
                  <>
                    <span className="sr-only">Other</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && <NavIcon name={otherSectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {otherSectionOpen && (
                <>
                  <Link href="/privacy" aria-current={pathname === "/privacy" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/privacy"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="privacy" />{sidebarOpen ? <span>Privacy</span> : <span className="sr-only">Privacy</span>}
                  </Link>
                  <Link href="/terms" aria-current={pathname === "/terms" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/terms"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="terms" />{sidebarOpen ? <span>Terms</span> : <span className="sr-only">Terms</span>}
                  </Link>
                  <Link href="/api-docs" aria-current={pathname === "/api-docs" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/api-docs"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                    <NavIcon name="apiDocs" />{sidebarOpen ? <span>API Docs</span> : <span className="sr-only">API Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        {/* ── Three-panel giveaway layout ── */}
        <div className="flex flex-1 gap-4 text-ax-heading min-h-0 overflow-hidden">

          {/* Users Panel */}
          <div className="flex w-64 shrink-0 flex-col rounded-md border border-ax-subtle bg-ax-section p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ax-body">Users</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ax-secondary">{entries.length} Users</span>
                {entries.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    title="Clear all entries"
                    className="text-ax-secondary hover:text-ax-body transition"
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
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ax-muted">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search Users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-md border border-ax-border bg-ax-raised py-1.5 pl-8 pr-3 text-xs text-ax-body placeholder-ax-muted focus:outline-none focus:ring-1 focus:ring-ax-focus"
              />
            </div>
            {/* Entry list */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
              {filteredEntries.length === 0 && (
                <p className="text-center text-xs text-ax-muted mt-8">
                  {entries.length === 0 ? "No entries yet." : "No results."}
                </p>
              )}
              {filteredEntries.map((e) => (
                <div
                  key={e.login}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-ax-raised group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {e.isMod && <span title="Moderator" className="text-xs font-bold text-green-300">MOD</span>}
                    {e.isVip && <span title="VIP" className="text-xs font-bold text-pink-300">VIP</span>}
                    {e.isSubscriber && (
                      <span title="Subscriber" className="inline-flex text-purple-300">
                        <Star aria-hidden="true" strokeWidth={1.75} size={14} fill="currentColor" />
                        <span className="sr-only">Subscriber</span>
                      </span>
                    )}
                    <span className="truncate text-ax-body">{e.displayName || e.login}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(e.login)}
                    className="ml-1 shrink-0 text-ax-muted hover:text-red-300 opacity-0 group-hover:opacity-100 transition"
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
          <div className="flex flex-1 flex-col rounded-md border border-ax-subtle bg-ax-section p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold">Giveaways</h1>
                <p className="text-sm text-ax-secondary mt-0.5">Reward your viewers with giveaways.</p>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                disabled={loadingToggle || !login}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
 isActive
 ? "bg-red-600 hover:bg-red-500 text-ax-heading"
 : "bg-emerald-600 hover:bg-emerald-500 text-ax-heading"
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
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-ax-secondary">Keyword Phrase</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-ax-secondary">Chat Announcements</span>
                  <input
                    type="checkbox"
                    checked={chatAnnounce}
                    onChange={(e) => setChatAnnounce(e.target.checked)}
                    className="h-4 w-4 rounded accent-ax-accent cursor-pointer"
                  />
                </label>
              </div>
              <input
                type="text"
                placeholder="Keyword Phrase"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full rounded-md border border-ax-border bg-ax-raised px-4 py-3 text-sm text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-ax-focus"
              />
              <p className="mt-1.5 text-xs text-ax-muted">
                The message must exactly match the keyword — case-sensitive. No extra text allowed.
              </p>
            </div>

            {/* Subscriber luck multiplier */}
            <div className="mb-8">
              <label className="mb-2 block text-sm font-medium text-ax-secondary">
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
                  className="flex-1 accent-ax-accent"
                />
                <div className="flex h-8 w-16 items-center justify-center rounded border border-ax-border bg-ax-raised text-sm text-ax-body">
                  {subMultiplier}x
                </div>
              </div>
              <p className="mt-1 text-xs text-ax-muted">
                {subMultiplier === 1
                  ? "Subscribers have the same luck as everyone else in the giveaway."
                  : `Subscribers have ${subMultiplier}x more chances to win.`}
              </p>
            </div>

            {/* Winner display / Pick button */}
            {winner ? (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
                <p className="mb-1 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-yellow-300"><Trophy aria-hidden="true" strokeWidth={1.75} size={16} /> Winner</p>
                <p className="text-2xl font-bold text-yellow-200">{winner.displayName || winner.login}</p>
                <p className="text-xs text-ax-secondary mt-1">@{winner.login}{winner.isSubscriber ? " · Subscriber" : ""}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickWinner}
                    disabled={pickingWinner || entries.length === 0}
                    className="rounded-md border border-ax-border bg-ax-raised px-3 py-1.5 text-xs text-ax-body hover:bg-ax-raised disabled:opacity-40 transition"
                  >
                    Reroll
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-md border border-ax-border bg-ax-raised px-3 py-1.5 text-xs text-ax-body hover:bg-ax-raised transition"
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
                className="w-full rounded-md bg-ax-raised py-3 font-mono text-xs font-medium uppercase tracking-[0.08em]st text-ax-body hover:bg-ax-border hover:text-ax-heading disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                {entries.length === 0 ? "NO ENTRIES YET" : pickingWinner ? "PICKING…" : "PICK WINNER"}
              </button>
            )}
          </div>

          {/* Chat Panel */}
          <div className="flex w-96 shrink-0 flex-col rounded-md border border-ax-subtle bg-ax-section overflow-hidden">
            <div className="flex items-center justify-between border-b border-ax-subtle px-4 py-3">
              <h2 className="font-semibold text-ax-body">Stream Chat</h2>
              {chatChannel && (
                <span className="text-xs text-ax-muted">#{chatChannel}</span>
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
                  <p className="text-xs text-ax-muted">Log in to view chat.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
