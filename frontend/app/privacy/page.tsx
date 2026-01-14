"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function PrivacyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = useState(true);
  const [vanitySectionOpen, setVanitySectionOpen] = useState(true);
  const [otherSectionOpen, setOtherSectionOpen] = useState(true);
  const [commandsOpen, setCommandsOpen] = useState(false);
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
              <h1 className="text-2xl font-semibold">Privacy Policy for AxyraBot</h1>
              <p className="text-xs text-slate-400">Last updated: January 1, 2026</p>
            </header>

            <p className="text-sm text-slate-300">
              AxyraBot is a Twitch chat bot that provides moderation, automation, and engagement features in Twitch
              channels. This Privacy Policy is designed to comply with the Twitch Developer Agreement and Twitch API
              requirements, and explains how data is collected, used, stored, and protected.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">1. Data Collected</h2>
              <p className="text-sm text-slate-300">
                AxyraBot only collects data necessary to provide its functionality, as permitted by Twitch. This may
                include:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>Twitch usernames and user IDs</li>
                <li>Chat messages sent in channels where AxyraBot is present</li>
                <li>Command usage and interaction data</li>
                <li>Channel-specific configuration settings set by moderators or channel owners</li>
              </ul>
              <p className="text-sm text-slate-300 mt-2">AxyraBot does not collect or store:</p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>Real names, email addresses, IP addresses, or precise location data</li>
                <li>Passwords, authentication credentials, or payment information</li>
                <li>Data unrelated to Twitch bot functionality</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">2. Use of Twitch Data</h2>
              <p className="text-sm text-slate-300">
                All data collected by AxyraBot is used strictly to:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>Provide moderation features (e.g., message filtering, timeouts, logging)</li>
                <li>Respond to chat commands and automation triggers</li>
                <li>Manage opt-in features such as giveaways or birthday lists</li>
                <li>Maintain and improve bot reliability</li>
              </ul>
              <p className="text-sm text-slate-300">
                Data is not used for advertising, tracking, profiling, or marketing purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">3. Data Storage and Retention</h2>
              <p className="text-sm text-slate-300">
                AxyraBot follows Twitch&apos;s data minimization requirements:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
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
              <h2 className="text-lg font-semibold text-slate-100">4. Data Sharing and Disclosure</h2>
              <p className="text-sm text-slate-300">
                AxyraBot does not sell, rent, or share Twitch data with third parties.
              </p>
              <p className="text-sm text-slate-300">Data may only be disclosed if:</p>
              <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 ml-2">
                <li>Required by applicable law</li>
                <li>
                  Necessary to comply with Twitch&apos;s Terms of Service, Developer Agreement, or valid legal requests
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">5. Third-Party Services</h2>
              <p className="text-sm text-slate-300">
                AxyraBot accesses Twitch services via the official Twitch API and is subject to Twitch&apos;s Privacy Policy
                and Terms of Service. AxyraBot is not responsible for Twitch&apos;s own data practices.
              </p>
              <p className="text-sm text-slate-300">
                If third-party services are used for hosting or infrastructure, they are used solely to operate the bot
                and do not receive Twitch data for independent use.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">6. Security Measures</h2>
              <p className="text-sm text-slate-300">
                Reasonable administrative and technical safeguards are used to protect stored data against unauthorized
                access, alteration, or loss. While best practices are followed, no system can be guaranteed to be
                completely secure.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">7. User Rights and Control</h2>
              <p className="text-sm text-slate-300">
                Channel owners and moderators may request deletion of stored channel configuration data, disable
                features, or remove AxyraBot from their channel at any time.
              </p>
              <p className="text-sm text-slate-300">
                Requests regarding data handling should be directed to the bot owner or official support contact.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">8. Policy Updates</h2>
              <p className="text-sm text-slate-300">
                This Privacy Policy may be updated as required to maintain compliance with Twitch policies or
                applicable laws. Updates take effect immediately upon posting.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-100">9. Contact</h2>
              <p className="text-sm text-slate-300">
                For questions or concerns about this Privacy Policy or AxyraBot&apos;s data practices, contact the bot
                owner via the official support or repository listed with AxyraBot.
              </p>
              <p className="text-sm text-slate-300">
                By using AxyraBot, you acknowledge that you have read and understood this Privacy Policy.
              </p>
            </section>

            <section className="space-y-2 border-t border-slate-800 pt-4 mt-2">
              <h2 className="text-lg font-semibold text-slate-100">Short Public-Facing Privacy Notice</h2>
              <h3 className="text-sm font-semibold text-slate-200">AxyraBot Privacy Summary</h3>
              <p className="text-sm text-slate-300">
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
