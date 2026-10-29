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

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function TermsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch">
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
                  {!isEditor && (
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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading overflow-y-auto">
          <div className="w-full rounded-2xl border border-ax-subtle bg-ax-section p-6 space-y-5">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold">Terms of Service for AxyraBot</h1>
              <p className="text-xs text-ax-secondary">Last updated: January 1, 2026</p>
            </header>

            <p className="text-sm text-ax-secondary">
              These Terms of Service ("Terms") govern the use of AxyraBot, a Twitch chat bot designed to provide
              moderation, automation, and engagement features. By adding or using AxyraBot in a Twitch channel, you
              agree to these Terms.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">1. Acceptance of Terms</h2>
              <p className="text-sm text-ax-secondary">
                By authorizing, installing, or using AxyraBot, you confirm that you have read, understood, and agree to
                be bound by these Terms, as well as Twitch&apos;s Terms of Service, Community Guidelines, and Developer
                Agreement.
              </p>
              <p className="text-sm text-ax-secondary">
                If you do not agree to these Terms, you must not use AxyraBot.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">2. Description of Service</h2>
              <p className="text-sm text-ax-secondary">
                AxyraBot provides automated moderation, chat utilities, engagement tools, and other features within
                Twitch channels. Features may change, be added, or be removed at any time without notice.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">3. Eligibility and Authority</h2>
              <p className="text-sm text-ax-secondary">
                You must have the authority to manage or moderate a Twitch channel to configure or enable AxyraBot
                within that channel. Channel owners and moderators are responsible for how AxyraBot is configured and
                used.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">4. Proper Use</h2>
              <p className="text-sm text-ax-secondary">You agree not to use AxyraBot to:</p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>Violate Twitch&apos;s Terms of Service or Community Guidelines</li>
                <li>Harass, abuse, or harm others</li>
                <li>Engage in spam, scams, or misleading activity</li>
                <li>Circumvent moderation, safety, or platform restrictions</li>
                <li>Collect or misuse personal data</li>
              </ul>
              <p className="text-sm text-ax-secondary">
                Misuse of AxyraBot may result in feature restrictions or service termination.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">5. Data and Privacy</h2>
              <p className="text-sm text-ax-secondary">
                Use of AxyraBot is subject to the AxyraBot Privacy Policy. AxyraBot only processes Twitch-provided data
                as necessary to operate its features and complies with Twitch API requirements.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">6. Availability and Reliability</h2>
              <p className="text-sm text-ax-secondary">
                AxyraBot is provided on an &quot;as is&quot; and &quot;as available&quot; basis. There is no guarantee of uptime,
                availability, or error-free operation. Features may be interrupted due to maintenance, updates, or
                technical issues.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">7. Limitation of Liability</h2>
              <p className="text-sm text-ax-secondary">To the maximum extent permitted by law:</p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>
                  AxyraBot and its owner shall not be liable for any direct, indirect, incidental, or consequential
                  damages
                </li>
                <li>
                  This includes, but is not limited to, loss of data, moderation errors, channel penalties, or service
                  interruptions
                </li>
              </ul>
              <p className="text-sm text-ax-secondary">You use AxyraBot at your own risk.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">8. Indemnification</h2>
              <p className="text-sm text-ax-secondary">
                You agree to indemnify and hold harmless the owner of AxyraBot from any claims, damages, liabilities,
                or expenses arising from your use or misuse of the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">9. Suspension or Termination</h2>
              <p className="text-sm text-ax-secondary">
                Access to AxyraBot may be suspended or terminated at any time, with or without notice, if:
              </p>
              <ul className="list-disc list-inside text-sm text-ax-secondary space-y-1 ml-2">
                <li>These Terms are violated</li>
                <li>Twitch policies are violated</li>
                <li>Continued operation poses technical, legal, or security risks</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">10. Changes to the Service or Terms</h2>
              <p className="text-sm text-ax-secondary">
                These Terms may be updated at any time to reflect changes in functionality, Twitch requirements, or
                legal obligations. Continued use of AxyraBot after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">11. Governing Law</h2>
              <p className="text-sm text-ax-secondary">
                These Terms shall be governed by and interpreted in accordance with applicable laws, without regard to
                conflict of law principles.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-ax-body">12. Contact</h2>
              <p className="text-sm text-ax-secondary">
                For questions regarding these Terms or AxyraBot, please contact the bot owner via the official support,
                repository, or contact method provided with AxyraBot.
              </p>
              <p className="text-sm text-ax-secondary">
                By using AxyraBot, you acknowledge that you have read and agreed to these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
