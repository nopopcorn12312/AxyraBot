"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { responsiveSidebarClassName, useResponsiveSidebar } from "../hooks/useResponsiveSidebar";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function ApiDocsPage() {
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
          <a
            href={primaryHref}
            className="hidden"
          >
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

      <div className="flex flex-1 w-full flex-col items-stretch gap-3 px-3 pb-4 pt-3 md:min-h-0 md:flex-row md:gap-6 md:px-4 md:pb-6 md:pt-6">
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
                    href="/api-docs"
                    aria-current={pathname === "/api-docs" ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-md py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading overflow-y-auto">
          <div className="w-full rounded-md border border-ax-subtle bg-ax-section p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1">API Documentation</h1>
              <p className="text-sm text-ax-secondary">
                All endpoints accept and return JSON. POST requests require{" "}
                <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Content-Type: application/json</span>.
                Query parameters must be URL-encoded. All endpoints support CORS. Dashboard endpoints require the{" "}
                <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Authorization: Bearer &lt;session&gt;</span>{" "}
                header issued at Twitch login, and only act on channels you own or are an Editor of.
              </p>
            </div>

            {/* Channel Management */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Channel Management</h2>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/join</span>
                  Join the bot to a channel. Body:{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channelname\" }"}</span>
                  . Returns <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">200 ok</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/part</span>
                  Remove the bot from a channel. Body:{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channelname\" }"}</span>
                  . Returns <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">200 ok</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/channels</span>
                  Returns all channels the bot has joined.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"channels\": [\"login\", ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Stream Info */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Stream Info &amp; Updates</h2>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/stream/info</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the channel&apos;s current stream title and category from Twitch.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"title\": \"...\", \"category\": \"...\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/stream/update</span>
                  Update stream title and/or category. The backend resolves the category name to a Twitch game ID automatically.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"title\": \"...\", \"category\": \"...\" }"}</span>.
                  Returns <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">204 No Content</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/categories/search</span>
                  Search Twitch categories/games. Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">q</span> (search term, required),{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required for auth lookup).
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"data\": [{ \"id\": \"...\", \"name\": \"...\", \"box_art_url\": \"...\" }, ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Commands */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Commands API</h2>
              <h3 className="text-sm font-semibold text-ax-body mt-1">Default Commands</h3>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/default-settings</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all built-in commands and their enabled state. Rows missing from the DB default to enabled.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!watchtime\", \"enabled\": true }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/default-settings</span>
                  Enable or disable a single default command.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!watchtime\", \"enabled\": false }"}</span>.
                </li>
              </ul>
              <h3 className="text-sm font-semibold text-ax-body mt-4">Custom Commands</h3>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/custom</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!hug\", \"response\": \"...\", \"createdBy\": \"user\", \"enabled\": true, \"role\": \"all\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/custom</span>
                  Toggle a custom command on or off.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hug\", \"enabled\": true }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/custom/update</span>
                  Rename a command, change its response, or update its permission level.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"originalCommand\": \"!hug\", \"command\": \"!hug\", \"response\": \"...\", \"role\": \"all | broadcaster | moderator | vip\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/custom/delete</span>
                  Permanently delete a custom command.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hug\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/commands/import</span>
                  Bulk-import commands from an external provider (e.g. Nightbot).
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"provider\": \"nightbot\", \"commands\": [{ \"name\": \"!cmd\", \"response\": \"...\" }, ...] }"}</span>.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"imported\": 5, \"provider\": \"nightbot\" }"}</span>.
                </li>
              </ul>
            </section>

            {/* Moderation */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Moderation</h2>
              <h3 className="text-sm font-semibold text-ax-body mt-1">Blocked Terms</h3>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/moderation/blocked-terms</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"terms\": [{ \"id\": 1, \"term\": \"badword\", \"action\": \"delete | timeout\", \"timeout_seconds\": 60 }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/moderation/blocked-terms</span>
                  Add a blocked term. <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">action</span> must be{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">delete</span> or{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">timeout</span>. When using{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">timeout</span>, set{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">timeout_seconds</span> (1–1209600).
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"term\": \"badword\", \"action\": \"timeout\", \"timeout_seconds\": 300 }"}</span>.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"id\": 1 }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/moderation/blocked-terms/delete</span>
                  Remove a blocked term by ID.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"id\": 1 }"}</span>.
                </li>
              </ul>
            </section>

            {/* Roles */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Roles</h2>
              <p className="text-sm text-ax-secondary">
                Roles let broadcasters grant users elevated permissions within AxyraBot.
                Available roles: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Editor</span>,{" "}
                <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Mod</span>,{" "}
                <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Regular</span>.
                Editors can manage a broadcaster&apos;s dashboard on their behalf.
              </p>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/roles</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all role assignments for the channel.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"roles\": [{ \"id\": 1, \"username\": \"someuser\", \"role\": \"Editor\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/roles</span>
                  Add or update a user&apos;s role (upserts on username).
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"username\": \"someuser\", \"role\": \"Editor\" }"}</span>.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"id\": 1 }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/roles/delete</span>
                  Remove a role assignment by ID.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"id\": 1 }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/roles/editor-channels</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all channels where the given username has the Editor role.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"channels\": [\"broadcaster1\", ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Modules */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Modules</h2>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/modules/settings</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all module configurations for the channel.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"modules\": [{ \"name\": \"live_announcement\", \"label\": \"Go live announcement\", \"description\": \"...\", \"enabled\": true, \"message\": \"...\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/modules/settings</span>
                  Enable/disable a module or update its message template.
                  Set <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">resetToDefault: true</span> to clear any custom message and restore the default.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"module\": \"live_announcement\", \"enabled\": true, \"message\": \"...\", \"resetToDefault\": false }"}</span>.
                </li>
              </ul>
            </section>

            {/* Birthdays */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Birthdays</h2>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/birthdays/list</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all stored birthdays for the channel.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"birthdays\": [{ \"userLogin\": \"user\", \"displayName\": \"User\", \"month\": 3, \"day\": 14 }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/birthdays/settings</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the channel&apos;s birthday announcement timezone.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"timezone\": \"America/New_York\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/birthdays/settings</span>
                  Update the birthday timezone (must be a valid IANA timezone string).
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"timezone\": \"America/Chicago\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/birthdays/command-messages</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the custom message templates for birthday commands.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!birthday\", \"message\": \"...\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/birthdays/command-messages</span>
                  Update a birthday command message. Set <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">resetToDefault: true</span> to restore the built-in message.
                  Body: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!birthday\", \"message\": \"...\", \"resetToDefault\": false }"}</span>.
                </li>
              </ul>
            </section>

            {/* User */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">User</h2>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/user/avatar</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the Twitch profile picture URL for any user.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"avatar_url\": \"https://static-cdn.jtvnw.net/...\" }"}</span>.
                </li>
              </ul>
            </section>

            {/* Audit Logs */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Audit Logs</h2>
              <ul className="space-y-3 text-sm text-ax-secondary">
                <li>
                  <span className="font-mono bg-sky-900/60 text-ax-accent-text px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">/audit/logs</span>
                  Query: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">login</span> (required),{" "}
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">limit</span> (optional integer, max 100, default 20).
                  Returns recent activity events for a channel ordered by most recent first.
                  Response: <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">{"{ \"logs\": [{ \"source\": \"twitch\", \"category\": \"stream\", \"description\": \"...\", \"timestamp\": \"2026-01-01T00:00:00Z\" }, ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Template Variables */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ax-body border-b border-ax-border pb-1">Template Variables</h2>
              <p className="text-sm text-ax-secondary">
                Variables can be used in custom command responses and module message templates. The bot substitutes them at runtime when a command fires or an event triggers.
              </p>
              <h3 className="text-sm font-semibold text-ax-body mt-1">Custom Commands</h3>
              <ul className="space-y-2 text-sm text-ax-secondary">
                <li><span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(user)</span>Login of the user who triggered the command.</li>
                <li><span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(channel)</span>The broadcaster&apos;s login for the channel where the command ran.</li>
                <li>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(touser)</span>
                  The argument after the command (e.g. <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">!hug @someUser</span> → <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">someUser</span>). Falls back to <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">$(user)</span> if no argument is given.
                </li>
                <li>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(random.chatter)</span>
                  A random viewer currently in chat. Falls back to a recent-chatter cache, then to <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">$(user)</span> if none are available.
                </li>
                <li>
                  <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(count)</span>
                  A per-command counter that increments each time that command is used in a channel.
                </li>
              </ul>
              <h3 className="text-sm font-semibold text-ax-body mt-4">Live Announcement Module</h3>
              <ul className="space-y-2 text-sm text-ax-secondary">
                <li><span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(channel)</span>The broadcaster&apos;s login.</li>
                <li><span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(title)</span>Current stream title. Falls back to <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Untitled stream</span> if empty.</li>
                <li><span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded mr-2">$(game)</span>Current Twitch category/game. Falls back to <span className="font-mono bg-ax-raised px-1.5 py-0.5 rounded">Just Chatting</span> if empty.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
