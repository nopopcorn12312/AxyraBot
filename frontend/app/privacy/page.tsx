"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";
import { responsiveSidebarClassName, useResponsiveSidebar } from "../hooks/useResponsiveSidebar";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function PrivacyPage() {
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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading overflow-y-auto">
          <div className="w-full rounded-md border border-ax-subtle bg-ax-section p-6 space-y-5">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold">Privacy Policy for AxyraBot</h1>
              <p className="text-xs text-ax-secondary">Last updated: January 1, 2026</p>
            </header>

            <p className="text-sm text-ax-secondary">
              AxyraBot is a Twitch chat bot that provides moderation, automation, and engagement features in Twitch
              channels. This Privacy Policy is designed to comply with the Twitch Developer Agreement and Twitch API
              requirements, and explains how data is collected, used, stored, and protected.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">1. Data Collected</h2>
              <p className="text-sm text-ax-secondary">
                AxyraBot only collects data necessary to provide its functionality, as permitted by Twitch. This may
                include:
              </p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>Twitch usernames and user IDs</li>
                <li>Chat messages sent in channels where AxyraBot is present</li>
                <li>Command usage and interaction data</li>
                <li>Channel-specific configuration settings set by moderators or channel owners</li>
              </ul>
              <p className="text-sm text-ax-secondary mt-2">AxyraBot does not collect or store:</p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>Real names, email addresses, IP addresses, or precise location data</li>
                <li>Passwords, authentication credentials, or payment information</li>
                <li>Data unrelated to Twitch bot functionality</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">2. Use of Twitch Data</h2>
              <p className="text-sm text-ax-secondary">
                All data collected by AxyraBot is used strictly to:
              </p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>Provide moderation features (e.g., message filtering, timeouts, logging)</li>
                <li>Respond to chat commands and automation triggers</li>
                <li>Manage opt-in features such as giveaways or birthday lists</li>
                <li>Maintain and improve bot reliability</li>
              </ul>
              <p className="text-sm text-ax-secondary">
                Data is not used for advertising, tracking, profiling, or marketing purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">3. Data Storage and Retention</h2>
              <p className="text-sm text-ax-secondary">
                AxyraBot follows Twitch&apos;s data minimization requirements:
              </p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>Data is stored only for as long as necessary to provide functionality</li>
                <li>Temporary data may be processed in real time and not retained</li>
                <li>
                  Persistent data (such as channel settings or opt-in lists) is retained until it is removed by a
                  channel moderator or owner, AxyraBot is removed from the channel, or the data is no longer required
                  for operation
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">4. Data Sharing and Disclosure</h2>
              <p className="text-sm text-ax-secondary">
                AxyraBot does not sell, rent, or share Twitch data with third parties.
              </p>
              <p className="text-sm text-ax-secondary">Data may only be disclosed if:</p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>Required by applicable law</li>
                <li>
                  Necessary to comply with Twitch&apos;s Terms of Service, Developer Agreement, or valid legal requests
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">5. Third-Party Services</h2>
              <p className="text-sm text-ax-secondary">
                AxyraBot accesses Twitch services via the official Twitch API and is subject to Twitch&apos;s Privacy Policy
                and Terms of Service. AxyraBot is not responsible for Twitch&apos;s own data practices.
              </p>
              <p className="text-sm text-ax-secondary">
                If third-party services are used for hosting or infrastructure, they are used solely to operate the bot
                and do not receive Twitch data for independent use.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">6. Security Measures</h2>
              <p className="text-sm text-ax-secondary">
                Reasonable administrative and technical safeguards are used to protect stored data against unauthorized
                access, alteration, or loss. While best practices are followed, no system can be guaranteed to be
                completely secure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">7. User Rights and Control</h2>
              <p className="text-sm text-ax-secondary">
                Channel owners and moderators may request deletion of stored channel configuration data, disable
                features, or remove AxyraBot from their channel at any time.
              </p>
              <p className="text-sm text-ax-secondary">
                Requests regarding data handling should be directed to the bot owner or official support contact.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">8. Policy Updates</h2>
              <p className="text-sm text-ax-secondary">
                This Privacy Policy may be updated as required to maintain compliance with Twitch policies or
                applicable laws. Updates take effect immediately upon posting.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">9. Contact</h2>
              <p className="text-sm text-ax-secondary">
                For questions or concerns about this Privacy Policy or AxyraBot&apos;s data practices, contact the bot
                owner via the official support or repository listed with AxyraBot.
              </p>
              <p className="text-sm text-ax-secondary">
                By using AxyraBot, you acknowledge that you have read and understood this Privacy Policy.
              </p>
            </section>

            <section className="space-y-2 border-t border-ax-subtle pt-4 mt-2">
              <h2 className="text-lg font-semibold text-ax-body">Short Public-Facing Privacy Notice</h2>
              <h3 className="text-sm font-semibold text-ax-body">AxyraBot Privacy Summary</h3>
              <p className="text-sm text-ax-secondary">
                AxyraBot only uses Twitch-provided data (such as usernames, user IDs, and chat messages) to operate
                moderation and chat features. Data is not sold, shared, or used for advertising. Information is stored
                only as long as necessary and can be removed by channel moderators at any time. AxyraBot complies with
                Twitch&apos;s Developer Agreement and API requirements.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
