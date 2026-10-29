"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type RoleOption = "Editor" | "Mod" | "Regular";

type RoleRow = {
  id: number;
  username: string;
  role: string;
};

export default function RolesPage() {
  useRequireAuth();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<RoleOption>("Regular");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
    if (storedLogin) {
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) {
        router.replace("/dashboard");
        return;
      }
      setChannelLogin((activeChannel || storedLogin).toLowerCase());
    }
  }, []);

  useEffect(() => {
    if (!channelLogin) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${backendUrl}/roles?login=${encodeURIComponent(channelLogin)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { roles?: RoleRow[] } = await res.json();
        setRoles(data.roles ?? []);
      } catch { /* ignore */ }
    })();
    return () => controller.abort();
  }, [channelLogin]);

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
    if (!showAddModal) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setShowAddModal(false); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showAddModal]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      revokeSession();
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

  return (
    <main className="h-screen overflow-hidden flex flex-col bg-ax-bg">
      <header className="w-full flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button
            aria-label="Toggle navigation"
            type="button"
            aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}
            className="mr-2 rounded-lg bg-ax-section px-3 py-2 text-sm font-medium text-ax-body hover:bg-ax-raised border border-ax-border"
          >
            <NavIcon name="menu" size={20} tone="inherit" />
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
              <span className="text-ax-accent-text">Axyra</span>
              <span className="text-ax-heading">Bot</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a href={primaryHref} className="hidden">
            {primaryLabel}
          </a>
          {isLoggedIn && (
            <>
              <ManagingChannelBadge />
              <Link
                href="/import"
                className="inline-flex items-center gap-1 rounded-full border border-ax-border bg-ax-section px-3 py-1.5 text-xs font-medium text-ax-body hover:bg-ax-raised hover:border-ax-muted transition"
              >
                <NavIcon name="import" size={16} tone="inherit" />
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}
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

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch min-h-0">
        <div
          className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-ax-subtle bg-ax-section p-3 transition-all duration-200`}
        >
          <nav className="mt-1 flex flex-col gap-4 text-sm text-ax-body">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={mainSectionOpen} onClick={() => setMainSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
                <span>Main</span>
                {sidebarOpen && <NavIcon name={mainSectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {mainSectionOpen && (
                <>
                  <Link
                    href="/dashboard"
                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                aria-expanded={moderationOpen} onClick={() => setModerationOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
                <span>Moderation</span>
                {sidebarOpen && (
                  <NavIcon name={moderationOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />
                )}
              </button>
              {moderationOpen && (
                <>
                  <Link
                    href="/moderation/blocked-terms"
                    aria-current={pathname === "/moderation/blocked-terms" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                aria-expanded={vanitySectionOpen} onClick={() => setVanitySectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
                <span>Vanity</span>
                {sidebarOpen && <NavIcon name={vanitySectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {vanitySectionOpen && (
                <>
                  <Link
                    href="/modules"
                    aria-current={pathname === "/modules" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
                      pathname === "/giveaways"
                        ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
                        : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
                    }`}
                  >
                    <NavIcon name="giveaways" />
                    {sidebarOpen ? <span>Giveaways</span> : <span className="sr-only">Giveaways</span>}
                  </Link>
                  {true && (
                  <Link
                    href="/roles"
                    aria-current={pathname === "/roles" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                <span>Integrations</span>
              </button>
              <Link href="/discord/settings" aria-current={pathname === "/discord/settings" ? "page" : undefined}
 className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                aria-expanded={otherSectionOpen} onClick={() => setOtherSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
              >
                <span>Other</span>
                {sidebarOpen && <NavIcon name={otherSectionOpen ? "chevronDown" : "chevronRight"} size={16} tone="inherit" />}
              </button>
              {otherSectionOpen && (
                <>
                  <Link
                    href="/privacy"
                    aria-current={pathname === "/privacy" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading min-h-0">
          <div className="w-full flex-1 flex flex-col rounded-2xl border border-ax-subtle bg-ax-section p-6 min-h-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold">Roles</h1>
              <button
                type="button"
                onClick={() => { setNewUsername(""); setNewRole("Regular"); setAddError(null); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition shadow-[0_0_14px_rgba(56,189,248,0.35)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>
                Add
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-ax-subtle bg-ax-section min-h-0">
              <table className="min-w-full w-full table-fixed h-full text-sm text-left">
                <thead className="bg-ax-section text-ax-secondary sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Username</th>
                    <th className="px-4 py-3 font-semibold w-40">Role</th>
                    <th className="px-4 py-3 font-semibold w-24 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((row) => (
                    <tr key={row.id} className="border-t border-ax-subtle hover:bg-ax-section">
                      <td className="px-4 py-2 font-mono text-ax-body truncate">{row.username}</td>
                      <td className="px-4 py-2 text-ax-secondary">{row.role}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={async () => {
                            if (!channelLogin) return;
                            setDeletingId(row.id);
                            try {
                              const res = await fetch(`${backendUrl}/roles/delete`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ login: channelLogin, id: row.id }),
                              });
                              if (res.ok) setRoles((prev) => prev.filter((r) => r.id !== row.id));
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-700 bg-red-700/80 text-ax-heading hover:bg-red-600/90 disabled:opacity-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M6 2a1 1 0 0 0-1 1v1H3.5a.5.5 0 0 0 0 1h.54l.76 10.137A2 2 0 0 0 6.79 17h6.42a2 2 0 0 0 1.99-1.863L15.96 5H16.5a.5.5 0 0 0 0-1H15V3a1 1 0 0 0-1-1H6Zm1 2V3h6v1H7Z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {roles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-ax-secondary">
                        No roles assigned yet. Click &ldquo;Add&rdquo; to get started.
                      </td>
                    </tr>
                  )}
                  <tr className="h-full border-t border-ax-subtle"><td colSpan={3} /></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add Role modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div ref={modalRef} className="w-full max-w-md rounded-2xl border border-ax-border bg-ax-section p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-ax-heading">Add Role</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ax-secondary hover:text-ax-body transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Username input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ax-secondary">Username</label>
                <input
                  type="text"
                  placeholder="e.g. username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="rounded-lg border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
                  autoFocus
                />
              </div>

              {/* Role dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ax-secondary">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as RoleOption)}
                  className="rounded-lg border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                >
                  <option value="Editor">Editor</option>
                  <option value="Mod">Mod</option>
                  <option value="Regular">Regular</option>
                </select>
              </div>

              {addError && (
                <div className="text-xs text-red-300">{addError}</div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-ax-border px-4 py-2 text-sm font-medium text-ax-body hover:bg-ax-raised transition"
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newUsername.trim()) { setAddError("Please enter a username."); return; }
                    if (!channelLogin) return;
                    setAdding(true);
                    setAddError(null);
                    try {
                      const res = await fetch(`${backendUrl}/roles`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ login: channelLogin, username: newUsername.trim(), role: newRole }),
                      });
                      if (!res.ok) {
                        setAddError("Failed to add role. Please try again.");
                      } else {
                        const data: { id: number } = await res.json();
                        setRoles((prev) => {
                          const next = [...prev.filter((r) => r.username.toLowerCase() !== newUsername.trim().toLowerCase()), {
                            id: data.id,
                            username: newUsername.trim().toLowerCase(),
                            role: newRole,
                          }];
                          return next.sort((a, b) => a.username.localeCompare(b.username));
                        });
                        setShowAddModal(false);
                      }
                    } catch {
                      setAddError("Network error. Please try again.");
                    } finally {
                      setAdding(false);
                    }
                  }}
                  disabled={!newUsername.trim() || adding}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {adding ? "Adding..." : "Add Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
