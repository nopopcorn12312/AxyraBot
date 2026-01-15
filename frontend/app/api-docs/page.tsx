"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function ApiDocsPage() {
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
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-3">API Documentation</h1>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Authentication &amp; OAuth</h2>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /auth/start</span>
                  Redirects the broadcaster to Twitch OAuth. Accepts optional
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">redirect</span>
                  query parameter (frontend URL) so the user is sent back to your dashboard after authorizing.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /auth/callback</span>
                  Twitch redirects back here with
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">code</span>
                  . The backend exchanges the code for a user access token, stores it, and then redirects to your
                  frontend with
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">login</span>
                  and optional
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">avatar</span>
                  query parameters.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Channel Management</h2>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /join</span>
                  Join the bot to a channel.
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\" }"}</span>
                  . Marks the channel as joined and refreshes EventSub subscriptions.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /part</span>
                  Ask the bot to leave a channel.
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\" }"}</span>
                  . Marks the channel as parted and removes it from active EventSub handling.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /channels</span>
                  Returns the list of joined channels as
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"channels\": [\"login\", ...] }"}</span>
                  .
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Stream Info &amp; Updates</h2>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /stream/info</span>
                  Query parameters:
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">login</span>
                  . Returns the current stream metadata from Twitch as
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"title\": \"...\", \"category\": \"...\" }"}</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /stream/update</span>
                  Updates the broadcaster&apos;s stream title and/or category.
                  Body:
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"title\": \"...\", \"category\": \"...\" }"}</span>
                  . The backend resolves
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">category</span>
                  to a Twitch
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">game_id</span>
                  before calling Helix.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Commands API</h2>
              <h3 className="text-sm font-semibold text-slate-200 mt-1">Default Commands</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /commands/default-settings</span>
                  Query parameters:
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">login</span>
                  . Returns all built-in commands and whether they are enabled for that channel as
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!hello\", \"enabled\": true }, ...] }"}</span>
                  . Missing rows default to enabled.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /commands/default-settings</span>
                  Enable or disable a single default command.
                  Body:
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hello\", \"enabled\": true }"}</span>
                  .
                </li>
              </ul>

              <h3 className="text-sm font-semibold text-slate-200 mt-4">Custom Commands</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /commands/custom</span>
                  Query parameters:
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">login</span>
                  . Returns all stored custom commands for the channel as
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!hug\", \"response\": \"...\", \"createdBy\": \"user\", \"enabled\": true, \"role\": \"all\" }, ...] }"}</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /commands/custom</span>
                  Toggle a single custom command on or off.
                  Body:
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hug\", \"enabled\": true }"}</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /commands/custom/update</span>
                  Update a custom command&apos;s name, response text, and who can use it.
                  Body:
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"originalCommand\": \"!hug\", \"command\": \"!hug\", \"response\": \"...\", \"role\": \"all|broadcaster|moderator|vip\" }"}</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /commands/custom/delete</span>
                  Permanently delete a custom command.
                  Body:
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hug\" }"}</span>
                  .
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Modules API</h2>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">GET /modules/settings</span>
                  Query parameters:
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">login</span>
                  . Returns per-channel module configuration as
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"modules\": [{ \"name\": \"live_announcement\", \"label\": \"Go live announcement\", \"description\": \"...\", \"enabled\": true, \"message\": \"$(channel) is now live! Streaming $(game) | $(title)\" }] }"}</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">POST /modules/settings</span>
                  Enable/disable a module and optionally update its message template.
                  Body:
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"module\": \"live_announcement\", \"enabled\": true, \"message\": \"...\", \"resetToDefault\": false }"}</span>
                  . When
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">resetToDefault</span>
                  is
                  <span className="font-mono bg-slate-800 px-1 py-0.5 rounded ml-1">true</span>
                  , any stored custom message is cleared and the backend falls back to its default template.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Template Variables</h2>
              <p className="text-sm text-slate-300">
                You can use simple template variables inside custom command responses and module messages. The backend
                performs plain string substitution when a command or module fires.
              </p>

              <h3 className="text-sm font-semibold text-slate-200 mt-1">Custom Commands</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(user)</span>
                  Login of the user who triggered the command.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(channel)</span>
                  Channel&apos;s login (owner of the channel where the command ran).
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(touser)</span>
                  The argument text after the command trigger. For example,
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">!hug someUser</span>
                  will set
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">$(touser)</span>
                  to
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">someUser</span>
                  (without the leading @). If no argument is provided, it falls back to
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">$(user)</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(random.chatter)</span>
                  A random current chatter from the channel&apos;s viewer list (via Twitch chatters API). If Twitch returns
                  no chatters, the backend falls back to a recent chatter cache, and finally to
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">$(user)</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(count)</span>
                  A per-command counter that increments each time that specific custom command is successfully used in a
                  channel. For example, a command like
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">!sneeze</span>
                  with response
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">(broadcaster) has sneezed $(count) times.</span>
                  will show 1, 2, 3, ... as viewers trigger it over time.
                </li>
              </ul>

              <h3 className="text-sm font-semibold text-slate-200 mt-4">Live Announcement Module</h3>
              <p className="text-sm text-slate-300">
                The <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">live_announcement</span> module uses a
                separate template for the message sent when your stream goes live. Supported variables:
              </p>
              <ul className="space-y-2 text-sm text-slate-300 mt-1">
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(channel)</span>
                  Broadcaster&apos;s login.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(title)</span>
                  Current stream title. If Twitch reports an empty title, it falls back to
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">Untitled stream</span>
                  .
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(game)</span>
                  Current Twitch category / game name. If empty, it falls back to
                  <span className="ml-1 font-mono bg-slate-800 px-1.5 py-0.5 rounded">Just Chatting</span>
                  .
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
