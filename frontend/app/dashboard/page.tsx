"use client";

import Image from "next/image";
import type React from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";

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

function Sparkline({ data, color, gradId }: { data: number[]; color: string; gradId: string }) {
  if (!data.length) return <div className="h-24 w-full" />;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 80;
  const pts = data.map((v, i) => [
    (i / Math.max(data.length - 1, 1)) * w,
    h - 4 - (v / max) * (h - 8),
  ] as [number, number]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardPage() {
  useRequireAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [login, setLogin] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [editorChannels, setEditorChannels] = useState<string[]>([]);
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
  const [chatStats, setChatStats] = useState<{
    msgs_per_min: number;
    unique_chatters: number;
    history: { label: string; msgs: number; chatters: number }[];
  } | null>(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

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
    const storedActive = window.localStorage.getItem("axyra.activeChannel");
    if (storedLogin) {
      setIsLoggedIn(true);
      setLogin(storedLogin);
      setActiveChannel(storedActive || storedLogin);
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
  }, []);

  // Fetch channels where the logged-in user has Editor role
  useEffect(() => {
    if (!login) return;
    (async () => {
      try {
        const res = await fetch(`${backendUrl}/roles/editor-channels?login=${encodeURIComponent(login)}`);
        if (!res.ok) return;
        const data: { channels?: string[] } = await res.json();
        setEditorChannels(data.channels ?? []);
      } catch { /* ignore */ }
    })();
  }, [login]);

  const handleChannelSwitch = (channel: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("axyra.activeChannel", channel);
    }
    setActiveChannel(channel);
  };

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
    if (!activeChannel) return;
    setLoadingStream(true);
    setStatusMessage(null);
    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/stream/info?login=${encodeURIComponent(
        activeChannel
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
  }, [activeChannel]);

  // Load recent activity for the logged-in channel and auto-refresh on an interval.
  useEffect(() => {
    if (!activeChannel) return;

    let cancelled = false;
    hasLoadedActivityRef.current = false;

    const fetchActivity = () => {
      const isInitial = !hasLoadedActivityRef.current;
      if (isInitial) {
        setLoadingActivity(true);
        setActivityError(null);
      }
      fetch(
        `${backendUrl}/audit/logs?login=${encodeURIComponent(activeChannel)}&limit=20`,
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
  }, [activeChannel]);

  // Poll chat stats (messages per minute + unique chatters) every 30 s
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    const poll = () => {
      fetch(`${backendUrl}/chat/stats?login=${encodeURIComponent(activeChannel)}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setChatStats(d); })
        .catch(() => {});
    };
    poll();
    const id = window.setInterval(poll, 30000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [activeChannel]);

  // Determine whether the current channel is already joined
  useEffect(() => {
    if (!activeChannel) return;
    fetch(`${backendUrl}/channels`)
      .then((res) => res.json())
      .then((data) => {
        const chans: string[] = data.channels || [];
        const lower = activeChannel.toLowerCase();
        setJoined(chans.some((c) => c.toLowerCase() === lower));
      })
      .catch((err) => {
        console.error(err);
      });
  }, [activeChannel]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      revokeSession();
      window.localStorage.removeItem("axyra.avatar");
      window.localStorage.removeItem("axyra.activeChannel");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setLogin(null);
    setActiveChannel(null);
    setEditorChannels([]);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.location.href = "/";
  };
  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const _lastLogin = typeof window !== "undefined" ? (window.localStorage.getItem("axyra.lastLogin") ?? "") : "";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${_lastLogin ? `&hint=${encodeURIComponent(_lastLogin)}` : ""}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const handleJoinChannel = async () => {
    if (!activeChannel) return;
    setJoining(true);
    setStatusMessage(null);
    try {
      const endpoint = joined ? "/part" : "/join";
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: activeChannel }),
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
    if (!activeChannel) return;
    setSavingStream(true);
    setStatusMessage(null);
    setChangesConfirmed(false);
    try {
      const res = await fetch(`${backendUrl}/stream/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: activeChannel,
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
    <main className="min-h-screen flex flex-col bg-ax-bg md:h-screen md:overflow-hidden">
      <header className="w-full flex items-center justify-between gap-2 px-3 py-3 sm:px-4 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2 flex-1 sm:gap-4">
          <button
            type="button"
            aria-label="Open dashboard menu"
            onClick={() => {
              if (window.matchMedia("(min-width: 768px)").matches) {
                setSidebarOpen((open: boolean) => !open);
              } else {
                setMobileSidebarOpen(true);
              }
            }}
            className="shrink-0 rounded-lg border border-ax-border bg-ax-section p-2 text-sm font-medium text-ax-body hover:bg-ax-raised sm:mr-2 sm:px-3 sm:py-2"
          >
            <NavIcon name="menu" size={20} tone="inherit" />
          </button>
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Image
              src={AxyraBotPFP}
              alt="AxyraBot logo"
              width={30}
              height={30}
              className="shrink-0 rounded-full"
            />
            <div className="truncate text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">
              <span className="text-ax-accent-text">Axyra</span>
              <span className="text-ax-heading">Bot</span>
            </div>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <a href={primaryHref} className="hidden">
            {primaryLabel}
          </a>
          {isLoggedIn && (
            <>
              <ManagingChannelBadge />
              <Link
                href="/import"
                className="hidden items-center gap-1 rounded-full border border-ax-border bg-ax-section px-3 py-1.5 text-xs font-medium text-ax-body transition hover:border-ax-muted hover:bg-ax-raised md:inline-flex"
              >
                <NavIcon name="import" size={16} tone="inherit" />
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-expanded={menuOpen} onClick={() => setMenuOpen((open: boolean) => !open)}
                  className="flex items-center gap-2 rounded-full bg-ax-section px-1.5 py-1 hover:bg-ax-raised transition"
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
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-ax-border bg-ax-section py-2 shadow-lg">
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

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close dashboard menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}
      <div className="flex flex-1 w-full items-stretch gap-3 px-3 pb-4 md:min-h-0 md:gap-6 md:px-4 md:pb-6">
        <div
          className={`${mobileSidebarOpen ? "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] rounded-none shadow-2xl" : "hidden"} ${sidebarOpen ? "md:w-60" : "md:w-16"} flex-col border border-ax-subtle bg-ax-section p-3 transition-all duration-200 md:relative md:inset-auto md:z-auto md:flex md:max-w-none md:rounded-2xl md:bg-ax-section md:shadow-none`}
        >
          <div className="mb-3 flex items-center justify-between border-b border-ax-subtle px-2 pb-3 md:hidden">
            <span className="text-sm font-semibold text-ax-body">Dashboard menu</span>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-md px-2 py-1 text-sm text-ax-secondary hover:bg-ax-raised hover:text-ax-heading"
            >
              Close
            </button>
          </div>
          <nav className="mt-1 flex flex-1 flex-col gap-4 overflow-y-auto text-sm text-ax-body">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={mainSectionOpen} onClick={() => setMainSectionOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
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
                  <Link
                    href="/dashboard"
                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/dashboard"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="dashboard" />
                    {sidebarOpen ? <span>Dashboard</span> : <span className="sr-only">Dashboard</span>}
                  </Link>

                  <Link
                    href="/commands"
                    aria-current={pathname === "/commands" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/commands"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="commands" />
                    {sidebarOpen ? <span>Commands</span> : <span className="sr-only">Commands</span>}
                  </Link>
                </>
              )}
            </div>

            {/* Moderation section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={moderationOpen} onClick={() => setModerationOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
                {sidebarOpen ? (
                  <span>Moderation</span>
                ) : (
                  <>
                    <span className="sr-only">Moderation</span>
                    <span aria-hidden="true" className="mx-auto block h-px w-6 bg-ax-border" />
                  </>
                )}
                {sidebarOpen && (
                  <NavIcon name={moderationOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />
                )}
              </button>
              {moderationOpen && (
                <>
                  <Link
                    href="/moderation/blocked-terms"
                    aria-current={pathname === "/moderation/blocked-terms" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/moderation/blocked-terms"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="blockedTerms" />
                    {sidebarOpen ? <span>Blocked Terms</span> : <span className="sr-only">Blocked Terms</span>}
                  </Link>
                  <Link
                    href="/moderation/spam-filters"
                    aria-current={pathname === "/moderation/spam-filters" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/moderation/spam-filters"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="spamFilters" />
                    {sidebarOpen ? <span>Spam Filters</span> : <span className="sr-only">Spam Filters</span>}
                  </Link>
                </>
              )}
            </div>

            {/* Vanity section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={vanitySectionOpen} onClick={() => setVanitySectionOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
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
                  <Link
                    href="/modules"
                    aria-current={pathname === "/modules" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/modules"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="modules" />
                    {sidebarOpen ? <span>Modules</span> : <span className="sr-only">Modules</span>}
                  </Link>
                  <Link
                    href="/birthdays"
                    aria-current={pathname === "/birthdays" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/birthdays"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="birthdays" />
                    {sidebarOpen ? <span>Birthdays</span> : <span className="sr-only">Birthdays</span>}
                  </Link>
                  <Link
                    href="/giveaways"
                    aria-current={pathname === "/giveaways" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/giveaways"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="giveaways" />
                    {sidebarOpen ? <span>Giveaways</span> : <span className="sr-only">Giveaways</span>}
                  </Link>
                  {!(activeChannel && activeChannel !== login) && (
                  <Link
                    href="/roles"
                    aria-current={pathname === "/roles" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/roles"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="roles" />
                    {sidebarOpen ? <span>Roles</span> : <span className="sr-only">Roles</span>}
                  </Link>
                  )}
                </>
              )}
            </div>

            {/* Integrations section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary">
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
 className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
   pathname === "/discord/settings"
     ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
     : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}>
                <NavIcon name="discord" />{sidebarOpen ? <span>Discord</span> : <span className="sr-only">Discord</span>}
              </Link>
            </div>

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={otherSectionOpen} onClick={() => setOtherSectionOpen((open: boolean) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
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
                  <Link
                    href="/privacy"
                    aria-current={pathname === "/privacy" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/privacy"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="privacy" />
                    {sidebarOpen ? <span>Privacy</span> : <span className="sr-only">Privacy</span>}
                  </Link>
                  <Link
                    href="/terms"
                    aria-current={pathname === "/terms" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/terms"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="terms" />
                    {sidebarOpen ? <span>Terms</span> : <span className="sr-only">Terms</span>}
                  </Link>
                  <Link
                    href="/api-docs"
                    aria-current={pathname === "/api-docs" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/api-docs"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="apiDocs" />
                    {sidebarOpen ? <span>API Docs</span> : <span className="sr-only">API Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 text-ax-heading md:min-h-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:gap-6 lg:min-h-0">
          <div className="w-full flex-none rounded-2xl border border-ax-subtle bg-ax-section p-4 sm:p-5 md:flex-1 md:p-6 lg:basis-2/3 lg:min-h-0">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-xl font-semibold sm:text-2xl">Recent Activity</h1>
              <span className="text-xs text-ax-secondary">Latest changes from Twitch &amp; AxyraBot</span>
            </div>
            {!activeChannel && (
              <p className="text-sm text-ax-secondary">
                Connect with Twitch to see recent activity for your channel.
              </p>
            )}
            {activeChannel && (
              <div className="flex flex-col pr-1 md:flex-1 md:overflow-y-auto">
                {loadingActivity && (
                  <p className="text-sm text-ax-secondary">Loading activity…</p>
                )}
                {activityError && !loadingActivity && (
                  <p className="text-sm text-rose-300">{activityError}</p>
                )}
                {!loadingActivity && !activityError && activity.length === 0 && (
                  <p className="text-sm text-ax-secondary">
                    No recent activity yet. Changes you make with AxyraBot and
                    certain Twitch events (like follows and going live) will
                    appear here.
                  </p>
                )}
                {!loadingActivity && !activityError && activity.length > 0 && (
                  <ul className="mt-1 text-sm divide-y divide-ax-subtle">
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
                              ? "bg-ax-section"
                              : "bg-ax-section"
                          }`}
                        >
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              isTwitch ? "bg-violet-400" : "bg-ax-accent"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClasses}`}
                              >
                                {badgeLabel}
                              </span>
                              <span className="text-[11px] text-ax-muted">
                                {formatTimeAgo(item.timestamp)}
                              </span>
                            </div>
                            <p className="text-ax-body leading-snug">
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

          <div className="flex w-full flex-col gap-3 md:min-h-0 lg:basis-1/3">
          <div className="flex flex-col justify-between rounded-2xl border border-ax-subtle bg-ax-section p-4 sm:p-5 md:p-6">
            <div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold sm:text-xl">Stream Details</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ax-body sm:text-sm md:text-base">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      joined ? "bg-emerald-400" : "bg-red-500"
                    }`}
                  />
                  <span>{joined ? "Bot is connected" : "Bot is not connected"}</span>
                </div>
              </div>
              <label className="block text-sm font-semibold text-ax-secondary mb-2">
                Stream Title
              </label>
              <input
                type="text"
                className="mb-5 w-full rounded-lg border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                placeholder="Current stream title"
                value={streamTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStreamTitle(e.target.value)
                }
                disabled={!login || loadingStream}
              />
              <label className="block text-sm font-semibold text-ax-secondary mb-2 mt-1">
                Stream Category
              </label>
              <div className="relative" ref={categoryWrapperRef}>
                <input
                  type="text"
                  className="w-full rounded-lg border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
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
                  <ul className="absolute z-50 mt-1 w-full rounded-lg border border-ax-border bg-ax-section shadow-xl overflow-hidden">
                    {categorySuggestions.map((cat) => (
                      <li key={cat.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-ax-body hover:bg-ax-raised transition"
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
                  disabled={!activeChannel || joining}
                  className={`flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-ax-heading shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition ${
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
                  disabled={!activeChannel || savingStream}
                  className={`flex-1 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition ${
                    changesConfirmed
                      ? "bg-emerald-500 text-ax-heading shadow-emerald-500/40 hover:bg-emerald-400"
                      : "bg-accent text-ax-btn-text shadow-sky-500/40 hover:bg-ax-accent"
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
          {/* Chat Stats Charts */}
          {activeChannel && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-ax-subtle bg-ax-section p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ax-secondary">Messages / min</h3>
                  <span className="text-2xl font-bold text-ax-accent-text tabular-nums">
                    {chatStats ? chatStats.msgs_per_min : "—"}
                  </span>
                </div>
                <Sparkline
                  data={(chatStats?.history ?? []).map((b) => b.msgs)}
                  color="#38bdf8"
                  gradId="grad-msgs"
                />
              </div>
              <div className="rounded-2xl border border-ax-subtle bg-ax-section p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ax-secondary">Unique Chatters</h3>
                  <span className="text-2xl font-bold text-violet-300 tabular-nums">
                    {chatStats ? chatStats.unique_chatters : "—"}
                  </span>
                </div>
                <Sparkline
                  data={(chatStats?.history ?? []).map((b) => b.chatters)}
                  color="#a78bfa"
                  gradId="grad-chatters"
                />
              </div>
            </div>
          )}
          </div>{/* end right column */}
          </div>{/* end inner flex row */}
        </div>{/* end outer column */}
      </div>
    </main>
  );
}
