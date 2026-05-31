"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function ApiDocsPage() {
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
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
  };

  const redirectTarget = frontendUrl || "https://axyrabot.com";
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
              <h1 className="text-2xl font-semibold mb-1">API Documentation</h1>
              <p className="text-sm text-slate-400">
                All endpoints accept and return JSON. POST requests require{" "}
                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Content-Type: application/json</span>.
                Query parameters must be URL-encoded. All endpoints support CORS.
              </p>
            </div>

            {/* Channel Management */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Channel Management</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/join</span>
                  Join the bot to a channel. Body:{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channelname\" }"}</span>
                  . Returns <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">200 ok</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/part</span>
                  Remove the bot from a channel. Body:{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channelname\" }"}</span>
                  . Returns <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">200 ok</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/channels</span>
                  Returns all channels the bot has joined.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"channels\": [\"login\", ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Stream Info */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Stream Info &amp; Updates</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/stream/info</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the channel&apos;s current stream title and category from Twitch.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"title\": \"...\", \"category\": \"...\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/stream/update</span>
                  Update stream title and/or category. The backend resolves the category name to a Twitch game ID automatically.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"title\": \"...\", \"category\": \"...\" }"}</span>.
                  Returns <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">204 No Content</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/categories/search</span>
                  Search Twitch categories/games. Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">q</span> (search term, required),{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required for auth lookup).
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"data\": [{ \"id\": \"...\", \"name\": \"...\", \"box_art_url\": \"...\" }, ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Commands */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Commands API</h2>
              <h3 className="text-sm font-semibold text-slate-200 mt-1">Default Commands</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/default-settings</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all built-in commands and their enabled state. Rows missing from the DB default to enabled.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!watchtime\", \"enabled\": true }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/default-settings</span>
                  Enable or disable a single default command.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!watchtime\", \"enabled\": false }"}</span>.
                </li>
              </ul>
              <h3 className="text-sm font-semibold text-slate-200 mt-4">Custom Commands</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/custom</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!hug\", \"response\": \"...\", \"createdBy\": \"user\", \"enabled\": true, \"role\": \"all\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/custom</span>
                  Toggle a custom command on or off.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hug\", \"enabled\": true }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/custom/update</span>
                  Rename a command, change its response, or update its permission level.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"originalCommand\": \"!hug\", \"command\": \"!hug\", \"response\": \"...\", \"role\": \"all | broadcaster | moderator | vip\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/custom/delete</span>
                  Permanently delete a custom command.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!hug\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/commands/import</span>
                  Bulk-import commands from an external provider (e.g. Nightbot).
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"provider\": \"nightbot\", \"commands\": [{ \"name\": \"!cmd\", \"response\": \"...\" }, ...] }"}</span>.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"imported\": 5, \"provider\": \"nightbot\" }"}</span>.
                </li>
              </ul>
            </section>

            {/* Moderation */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Moderation</h2>
              <h3 className="text-sm font-semibold text-slate-200 mt-1">Blocked Terms</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/moderation/blocked-terms</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"terms\": [{ \"id\": 1, \"term\": \"badword\", \"action\": \"delete | timeout\", \"timeout_seconds\": 60 }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/moderation/blocked-terms</span>
                  Add a blocked term. <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">action</span> must be{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">delete</span> or{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">timeout</span>. When using{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">timeout</span>, set{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">timeout_seconds</span> (1–1209600).
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"term\": \"badword\", \"action\": \"timeout\", \"timeout_seconds\": 300 }"}</span>.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"id\": 1 }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/moderation/blocked-terms/delete</span>
                  Remove a blocked term by ID.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"id\": 1 }"}</span>.
                </li>
              </ul>
            </section>

            {/* Roles */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Roles</h2>
              <p className="text-sm text-slate-400">
                Roles let broadcasters grant users elevated permissions within AxyraBot.
                Available roles: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Editor</span>,{" "}
                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Mod</span>,{" "}
                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Regular</span>.
                Editors can manage a broadcaster&apos;s dashboard on their behalf.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/roles</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all role assignments for the channel.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"roles\": [{ \"id\": 1, \"username\": \"someuser\", \"role\": \"Editor\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/roles</span>
                  Add or update a user&apos;s role (upserts on username).
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"username\": \"someuser\", \"role\": \"Editor\" }"}</span>.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"id\": 1 }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/roles/delete</span>
                  Remove a role assignment by ID.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"id\": 1 }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/roles/editor-channels</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all channels where the given username has the Editor role.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"channels\": [\"broadcaster1\", ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Modules */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Modules</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/modules/settings</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all module configurations for the channel.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"modules\": [{ \"name\": \"live_announcement\", \"label\": \"Go live announcement\", \"description\": \"...\", \"enabled\": true, \"message\": \"...\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/modules/settings</span>
                  Enable/disable a module or update its message template.
                  Set <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">resetToDefault: true</span> to clear any custom message and restore the default.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"module\": \"live_announcement\", \"enabled\": true, \"message\": \"...\", \"resetToDefault\": false }"}</span>.
                </li>
              </ul>
            </section>

            {/* Birthdays */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Birthdays</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/birthdays/list</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns all stored birthdays for the channel.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"birthdays\": [{ \"userLogin\": \"user\", \"displayName\": \"User\", \"month\": 3, \"day\": 14 }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/birthdays/settings</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the channel&apos;s birthday announcement timezone.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"timezone\": \"America/New_York\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/birthdays/settings</span>
                  Update the birthday timezone (must be a valid IANA timezone string).
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"timezone\": \"America/Chicago\" }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/birthdays/command-messages</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the custom message templates for birthday commands.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"commands\": [{ \"name\": \"!birthday\", \"message\": \"...\" }, ...] }"}</span>.
                </li>
                <li>
                  <span className="font-mono bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-xs mr-1">POST</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/birthdays/command-messages</span>
                  Update a birthday command message. Set <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">resetToDefault: true</span> to restore the built-in message.
                  Body: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"login\": \"channel\", \"command\": \"!birthday\", \"message\": \"...\", \"resetToDefault\": false }"}</span>.
                </li>
              </ul>
            </section>

            {/* User */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">User</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/user/avatar</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required).
                  Returns the Twitch profile picture URL for any user.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"avatar_url\": \"https://static-cdn.jtvnw.net/...\" }"}</span>.
                </li>
              </ul>
            </section>

            {/* Audit Logs */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Audit Logs</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <span className="font-mono bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-xs mr-1">GET</span>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">/audit/logs</span>
                  Query: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">login</span> (required),{" "}
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">limit</span> (optional integer, max 100, default 20).
                  Returns recent activity events for a channel ordered by most recent first.
                  Response: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{"{ \"logs\": [{ \"source\": \"twitch\", \"category\": \"stream\", \"description\": \"...\", \"timestamp\": \"2026-01-01T00:00:00Z\" }, ...] }"}</span>.
                </li>
              </ul>
            </section>

            {/* Template Variables */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-1">Template Variables</h2>
              <p className="text-sm text-slate-400">
                Variables can be used in custom command responses and module message templates. The bot substitutes them at runtime when a command fires or an event triggers.
              </p>
              <h3 className="text-sm font-semibold text-slate-200 mt-1">Custom Commands</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(user)</span>Login of the user who triggered the command.</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(channel)</span>The broadcaster&apos;s login for the channel where the command ran.</li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(touser)</span>
                  The argument after the command (e.g. <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">!hug @someUser</span> → <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">someUser</span>). Falls back to <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">$(user)</span> if no argument is given.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(random.chatter)</span>
                  A random viewer currently in chat. Falls back to a recent-chatter cache, then to <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">$(user)</span> if none are available.
                </li>
                <li>
                  <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(count)</span>
                  A per-command counter that increments each time that command is used in a channel.
                </li>
              </ul>
              <h3 className="text-sm font-semibold text-slate-200 mt-4">Live Announcement Module</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(channel)</span>The broadcaster&apos;s login.</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(title)</span>Current stream title. Falls back to <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Untitled stream</span> if empty.</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded mr-2">$(game)</span>Current Twitch category/game. Falls back to <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Just Chatting</span> if empty.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
