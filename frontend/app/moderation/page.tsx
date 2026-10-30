"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";
import { responsiveSidebarClassName, useResponsiveSidebar } from "../hooks/useResponsiveSidebar";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function ModerationPage() {
  useRequireAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
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
    <main className="min-h-screen flex flex-col bg-ax-bg">
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
            <Image
              src={AxyraBotPFP}
              alt="AxyraBot logo"
              width={32}
              height={32}
              className="rounded-full"
            />
            <div className="font-display text-xl font-semibold tracking-tight">
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
                className="inline-flex items-center gap-1 rounded-md border border-ax-border bg-ax-section px-3 py-1.5 text-xs font-medium text-ax-body hover:bg-ax-raised hover:border-ax-muted transition"
              >
                <NavIcon name="import" size={16} tone="inherit" />
                <span>Import</span>
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-md bg-ax-section px-1.5 py-1 hover:bg-ax-raised transition"
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

      <div className="flex flex-1 w-full flex-col items-stretch gap-3 px-3 pb-4 pt-3 md:flex-row md:gap-6 md:px-4 md:pb-6 md:pt-6">
        {mobileSidebarOpen && <button type="button" aria-label="Close dashboard menu" onClick={closeMobileSidebar} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
        <div className={responsiveSidebarClassName(sidebarOpen, mobileSidebarOpen)}>
          <div className="mb-3 flex items-center justify-between border-b border-ax-subtle px-2 pb-3 md:hidden">
            <span className="text-sm font-semibold text-ax-body">Dashboard menu</span>
            <button type="button" onClick={closeMobileSidebar} className="rounded-md px-2 py-1 text-sm text-ax-secondary hover:bg-ax-raised hover:text-ax-heading">Close</button>
          </div>
          <nav className="mt-1 flex flex-col gap-4 text-sm text-ax-body">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={mainSectionOpen} onClick={() => setMainSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body"
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body"
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body"
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/giveaways"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}
                  >
                    <NavIcon name="giveaways" />
                    {sidebarOpen ? <span>Giveaways</span> : <span className="sr-only">Giveaways</span>}
                  </Link>
                  {!isEditor && (
                  <Link
                    href="/roles"
                    aria-current={pathname === "/roles" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={otherSectionOpen} onClick={() => setOtherSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ax-secondary hover:text-ax-body"
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/terms"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}
                  >
                    <NavIcon name="terms" />
                    {sidebarOpen ? <span>Terms</span> : <span className="sr-only">Terms</span>}
                  </Link>
                  <Link
                    href="/docs"
                    aria-current={pathname === "/docs" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 pathname === "/docs"
 ? "bg-ax-raised text-ax-heading shadow-[inset_3px_0_0_0_#38BDF8]"
 : "text-ax-body hover:bg-ax-raised/60 hover:text-ax-heading"
 }`}
                  >
                    <NavIcon name="docs" />
                    {sidebarOpen ? <span>Docs</span> : <span className="sr-only">Docs</span>}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        <div className="flex-1 flex flex-col gap-6 text-ax-heading">
          <div className="rounded-md border border-ax-subtle bg-ax-section p-6 min-h-[260px] flex flex-col justify-center items-start">
            <h1 className="text-2xl font-semibold mb-2">Moderation</h1>
            <p className="text-sm text-ax-secondary max-w-xl">
              This page will host your moderation tools and settings. Well fill this out with controls for bans,
              timeouts, filters, and more in a future step.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
