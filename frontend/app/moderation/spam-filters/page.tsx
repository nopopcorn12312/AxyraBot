"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePersistentSectionState } from "../../hooks/usePersistentSectionState";
import { useRequireAuth } from "../../hooks/useRequireAuth";
import { useEffect, useRef, useState } from "react";

import AxyraLogo from "../../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../../components/ManagingChannelBadge";

const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";

type SpamFilter = {
  id: number;
  type: "caps" | "link" | "length" | "emotes";
  action: "timeout" | "delete" | "ban";
  timeout_seconds: number;
};

const FILTER_LABELS: Record<SpamFilter["type"], string> = {
  caps: "Caps Filter",
  link: "Link Filter",
  length: "Length Filter",
  emotes: "Emotes Filter",
};

export default function SpamFiltersPage() {
  useRequireAuth();
  const pathname = usePathname();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
    }
    if (storedAvatar) setAvatarUrl(storedAvatar);
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

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.location.href = "/";
  };

  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const _lastLogin = typeof window !== "undefined" ? (window.localStorage.getItem("axyra.lastLogin") ?? "") : "";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${_lastLogin ? `&hint=${encodeURIComponent(_lastLogin)}` : ""}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  // Add Filter modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState<SpamFilter["type"]>("caps");
  const [newAction, setNewAction] = useState<"timeout" | "delete" | "ban">("delete");
  const [timeoutSeconds, setTimeoutSeconds] = useState("60");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Spam filters list
  const [spamFilters, setSpamFilters] = useState<SpamFilter[]>([]);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const login = window.localStorage.getItem("axyra.login");
    const activeChannel = window.localStorage.getItem("axyra.activeChannel");
    if (login) setChannelLogin((activeChannel || login).toLowerCase());
  }, []);

  useEffect(() => {
    if (!channelLogin) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${backendUrl}/moderation/spam-filters?login=${encodeURIComponent(channelLogin)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { filters?: SpamFilter[] } = await res.json();
        setSpamFilters(data.filters ?? []);
      } catch { /* ignore */ }
    })();
    return () => controller.abort();
  }, [channelLogin]);

  useEffect(() => {
    if (!showAddModal) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setShowAddModal(false); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showAddModal]);

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
              src={AxyraLogo}
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
          <a href={primaryHref} className="hidden">{primaryLabel}</a>
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

                  <Link
                    href="/commands"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/commands"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">❓</span>
                    {sidebarOpen && <span>Commands</span>}
                  </Link>

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
                onClick={() => setVanitySectionOpen((open) => !open)}
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
                    href="/giveaways"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                      pathname === "/giveaways"
                        ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <span className="text-lg">🎁</span>
                    {sidebarOpen && <span>Giveaways</span>}
                  </Link>
                  {!isEditor && (
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
                  )}
                </>
              )}
            </div>

            {/* Integrations section */}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => {}} className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Integrations</span>
              </button>
              <Link href="/discord" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/discord" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}>
                <span className="text-lg">🎮</span>{sidebarOpen && <span>Discord</span>}
              </Link>
            </div>

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOtherSectionOpen((open) => !open)}
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
                    <span className="text-lg">📄</span>
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

        <main className="flex-1 overflow-hidden">
          <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/40 flex flex-col">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-50">Spam Filters</h1>
                <p className="mt-1 text-sm text-slate-400">
                  Configure automatic spam detection and filtering for your chat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setFilterType("caps"); setNewAction("delete"); setTimeoutSeconds("60"); setAddError(null); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition shadow-[0_0_14px_rgba(129,140,248,0.4)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>
                Add Filter
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60 min-h-0">
              <table className="min-w-full w-full table-fixed h-full text-sm text-left">
                <thead className="bg-slate-900/80 text-slate-300 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Filter Type</th>
                    <th className="px-4 py-3 font-semibold w-40">Action</th>
                    <th className="px-4 py-3 font-semibold w-24 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {spamFilters.map((row) => (
                    <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-900/60">
                      <td className="px-4 py-2 text-slate-100">{FILTER_LABELS[row.type]}</td>
                      <td className="px-4 py-2 text-slate-300 capitalize">
                        {row.action === "timeout" ? `Timeout (${row.timeout_seconds}s)` : row.action === "ban" ? "Ban" : "Delete message"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={async () => {
                            if (!channelLogin) return;
                            setDeletingId(row.id);
                            try {
                              const res = await fetch(`${backendUrl}/moderation/spam-filters/delete`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ login: channelLogin, id: row.id }),
                              });
                              if (res.ok) setSpamFilters((prev) => prev.filter((f) => f.id !== row.id));
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-700 bg-red-700/80 text-white hover:bg-red-600/90 disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M6 2a1 1 0 0 0-1 1v1H3.5a.5.5 0 0 0 0 1h.54l.76 10.137A2 2 0 0 0 6.79 17h6.42a2 2 0 0 0 1.99-1.863L15.96 5H16.5a.5.5 0 0 0 0-1H15V3a1 1 0 0 0-1-1H6Zm1 2V3h6v1H7Z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {spamFilters.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                        No spam filters yet. Click &ldquo;Add Filter&rdquo; to get started.
                      </td>
                    </tr>
                  )}
                  <tr className="h-full border-t border-slate-800"><td colSpan={3} /></tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      {/* Add Filter modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div ref={modalRef} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-50">Add Spam Filter</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Filter type dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">Filter Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as SpamFilter["type"])}
                  className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                  autoFocus
                >
                  <option value="caps">Caps Filter</option>
                  <option value="link">Link Filter</option>
                  <option value="length">Length Filter</option>
                  <option value="emotes">Emotes Filter</option>
                </select>
              </div>

              {/* Action dropdown + timeout seconds */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">Action</label>
                <div className="flex items-center gap-3">
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value as "timeout" | "delete" | "ban")}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                  >
                    <option value="timeout">Timeout</option>
                    <option value="delete">Delete message</option>
                    <option value="ban">Ban</option>
                  </select>
                  {newAction === "timeout" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1209600"
                        value={timeoutSeconds}
                        onChange={(e) => setTimeoutSeconds(e.target.value)}
                        className="w-24 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                      />
                      <span className="text-sm text-slate-400 whitespace-nowrap">seconds</span>
                    </div>
                  )}
                </div>
              </div>

              {addError && (
                <div className="text-xs text-red-400">{addError}</div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition"
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!channelLogin) return;
                    setAdding(true);
                    setAddError(null);
                    try {
                      const res = await fetch(`${backendUrl}/moderation/spam-filters`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          login: channelLogin,
                          type: filterType,
                          action: newAction,
                          timeout_seconds: newAction === "timeout" ? parseInt(timeoutSeconds) || 60 : 60,
                        }),
                      });
                      if (!res.ok) {
                        setAddError("Failed to add filter. Please try again.");
                      } else {
                        const data: { id: number } = await res.json();
                        setSpamFilters((prev) => [...prev, {
                          id: data.id,
                          type: filterType,
                          action: newAction,
                          timeout_seconds: newAction === "timeout" ? parseInt(timeoutSeconds) || 60 : 60,
                        }]);
                        setShowAddModal(false);
                      }
                    } catch {
                      setAddError("Network error. Please try again.");
                    } finally {
                      setAdding(false);
                    }
                  }}
                  disabled={adding}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {adding ? "Adding..." : "Add Filter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
