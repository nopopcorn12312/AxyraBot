"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function TermsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = useState(true);
  const [vanitySectionOpen, setVanitySectionOpen] = useState(true);
  const [otherSectionOpen, setOtherSectionOpen] = useState(true);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
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
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
  };

  const redirectTarget = frontendUrl || "http://localhost:3000";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

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
          <a
            href={primaryHref}
            className="hidden"
          >
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
                {sidebarOpen && <span className="text-[10px]">{mainSectionOpen ? "▾" : "▸"}</span>}
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
                    onClick={() => setCommandsOpen((open) => !open)}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-medium text-slate-200 hover:bg-slate-800/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">❓</span>
                      {sidebarOpen && <span>Commands</span>}
                    </div>
                    {sidebarOpen && (
                      <span className="text-xs text-slate-400">{commandsOpen ? "▾" : "▸"}</span>
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
                onClick={() => setModerationOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Moderation</span>
                {sidebarOpen && (
                  <span className="text-[10px]">{moderationOpen ? "▾" : "▸"}</span>
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
                {sidebarOpen && <span className="text-[10px]">{vanitySectionOpen ? "▾" : "▸"}</span>}
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
                </>
              )}
            </div>

            {/* Other section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOtherSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
              >
                <span>Other</span>
                {sidebarOpen && <span className="text-[10px]">{otherSectionOpen ? "▾" : "▸"}</span>}
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

        <div className="flex-1 flex flex-col gap-6 text-slate-50 overflow-y-auto">
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-5">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold">Terms of Service for AxyraBot</h1>
              <p className="text-xs text-slate-400">Last updated: January 1, 2026</p>
            </header>

            <p className="text-sm text-slate-300">
              These Terms of Service ("Terms") govern the use of AxyraBot, a Twitch chat bot designed to provide
              moderation, automation, and engagement features. By adding or using AxyraBot in a Twitch channel, you
              agree to these Terms.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">1. Acceptance of Terms</h2>
              <p className="text-sm text-slate-300">
                By authorizing, installing, or using AxyraBot, you confirm that you have read, understood, and agree to
                be bound by these Terms, as well as Twitch&apos;s Terms of Service, Community Guidelines, and Developer
                Agreement.
              </p>
              <p className="text-sm text-slate-300">
                If you do not agree to these Terms, you must not use AxyraBot.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">2. Description of Service</h2>
              <p className="text-sm text-slate-300">
                AxyraBot provides automated moderation, chat utilities, engagement tools, and other features within
                Twitch channels. Features may change, be added, or be removed at any time without notice.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">3. Eligibility and Authority</h2>
              <p className="text-sm text-slate-300">
                You must have the authority to manage or moderate a Twitch channel to configure or enable AxyraBot
                within that channel. Channel owners and moderators are responsible for how AxyraBot is configured and
                used.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">4. Proper Use</h2>
              <p className="text-sm text-slate-300">You agree not to use AxyraBot to:</p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>Violate Twitch&apos;s Terms of Service or Community Guidelines</li>
                <li>Harass, abuse, or harm others</li>
                <li>Engage in spam, scams, or misleading activity</li>
                <li>Circumvent moderation, safety, or platform restrictions</li>
                <li>Collect or misuse personal data</li>
              </ul>
              <p className="text-sm text-slate-300">
                Misuse of AxyraBot may result in feature restrictions or service termination.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">5. Data and Privacy</h2>
              <p className="text-sm text-slate-300">
                Use of AxyraBot is subject to the AxyraBot Privacy Policy. AxyraBot only processes Twitch-provided data
                as necessary to operate its features and complies with Twitch API requirements.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">6. Availability and Reliability</h2>
              <p className="text-sm text-slate-300">
                AxyraBot is provided on an &quot;as is&quot; and &quot;as available&quot; basis. There is no guarantee of uptime,
                availability, or error-free operation. Features may be interrupted due to maintenance, updates, or
                technical issues.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">7. Limitation of Liability</h2>
              <p className="text-sm text-slate-300">To the maximum extent permitted by law:</p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>
                  AxyraBot and its owner shall not be liable for any direct, indirect, incidental, or consequential
                  damages
                </li>
                <li>
                  This includes, but is not limited to, loss of data, moderation errors, channel penalties, or service
                  interruptions
                </li>
              </ul>
              <p className="text-sm text-slate-300">You use AxyraBot at your own risk.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">8. Indemnification</h2>
              <p className="text-sm text-slate-300">
                You agree to indemnify and hold harmless the owner of AxyraBot from any claims, damages, liabilities,
                or expenses arising from your use or misuse of the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">9. Suspension or Termination</h2>
              <p className="text-sm text-slate-300">
                Access to AxyraBot may be suspended or terminated at any time, with or without notice, if:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>These Terms are violated</li>
                <li>Twitch policies are violated</li>
                <li>Continued operation poses technical, legal, or security risks</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">10. Changes to the Service or Terms</h2>
              <p className="text-sm text-slate-300">
                These Terms may be updated at any time to reflect changes in functionality, Twitch requirements, or
                legal obligations. Continued use of AxyraBot after updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">11. Governing Law</h2>
              <p className="text-sm text-slate-300">
                These Terms shall be governed by and interpreted in accordance with applicable laws, without regard to
                conflict of law principles.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">12. Contact</h2>
              <p className="text-sm text-slate-300">
                For questions regarding these Terms or AxyraBot, please contact the bot owner via the official support,
                repository, or contact method provided with AxyraBot.
              </p>
              <p className="text-sm text-slate-300">
                By using AxyraBot, you acknowledge that you have read and agreed to these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
