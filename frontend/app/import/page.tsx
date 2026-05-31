"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import NightbotPFP from "../images/NightbotPFP.png";
import NightbotBanner from "../images/NightbotBanner.png";
import SteamelementsBanner from "../images/SteamelementsBanner.png";
import FossabotBanner from "../images/FossabotBanner.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type Provider = "nightbot" | "streamelements" | "fossabot" | "other";

const providerDisplay: Record<Provider, string> = {
  nightbot: "Nightbot",
  streamelements: "StreamElements",
  fossabot: "Fossabot",
  other: "Other",
};

export default function ImportPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
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
  const [provider, setProvider] = useState<Provider>("nightbot");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successProvider, setSuccessProvider] = useState<Provider | null>(null);
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
      setLogin((activeChannel || storedLogin).toLowerCase());
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }
  }, []);

  // Pick up Nightbot OAuth redirect status and provider selection from the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const providerParam = params.get("provider");
    if (
      providerParam === "nightbot" ||
      providerParam === "streamelements" ||
      providerParam === "fossabot" ||
      providerParam === "other"
    ) {
      setProvider(providerParam as Provider);
    }
    const nightbotStatus = params.get("nightbot");
    const count = params.get("count");
    if (nightbotStatus === "success") {
      const num = count ? parseInt(count, 10) : NaN;
      const label = !isNaN(num) && num > 0 ? `${num} command${num === 1 ? "" : "s"}` : "your commands";
      setImportResult(`Imported ${label} from Nightbot via OAuth.`);
      setParseError(null);
      setSuccessProvider("nightbot");
      setSuccessModalOpen(true);
    } else if (nightbotStatus === "error") {
      setParseError("Nightbot import failed or was cancelled. You can try again.");
      setImportResult(null);
    }

    // Clean up query params after consuming them so refreshes don't repeat messages.
    if (nightbotStatus || providerParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("nightbot");
      url.searchParams.delete("count");
      // Keep provider so the selection persists.
      window.history.replaceState({}, "", url.toString());
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
    setLogin(null);
    setMenuOpen(false);
  };

  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const handleNightbotOAuth = () => {
    if (!login) {
      setParseError("Log in with Twitch first to import commands.");
      return;
    }
    if (typeof window === "undefined") return;
    const base = frontendUrl || window.location.origin;
    const importUrl = `${base.replace(/\/$/, "")}/import`;
    const url = new URL(`${backendUrl}/nightbot/auth/start`);
    url.searchParams.set("login", login);
    url.searchParams.set("redirect", importUrl);
    window.location.href = url.toString();
  };

  const handleChooseProvider = (next: Provider) => {
    setProvider(next);
    setParseError(null);
    setImportResult(null);
  };

  return (
    <main className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      {successModalOpen && successProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-50">Import complete</h2>
            <p className="mb-4 text-sm text-slate-300">
              Successfully imported from {providerDisplay[successProvider]}.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSuccessModalOpen(false)}
                className="inline-flex items-center rounded-md bg-slate-800 px-4 py-1.5 text-sm font-semibold text-slate-100 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
          <a href={primaryHref} className="hidden">
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

        <div className="flex-1 flex flex-col gap-6 text-slate-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-semibold">Import custom commands</h1>
              {login && (
                <span className="text-xs text-slate-400">
                  Importing for <span className="font-semibold">{login}</span>
                </span>
              )}
            </div>
            {!isLoggedIn && (
              <p className="text-sm text-slate-400">
                Log in with Twitch on the homepage to import commands into your channel.
              </p>
            )}
            {isLoggedIn && (
              <>
                <p className="text-sm text-slate-400 mb-3">
                  Import your commands from other chat bots into AxyraBot. Choose a platform card below to start an
                  import for your channel.
                </p>

                {importResult && (
                  <p className="mb-3 text-xs text-emerald-400">{importResult}</p>
                )}
                {parseError && (
                  <p className="mb-3 text-xs text-rose-400">{parseError}</p>
                )}

                <div className="mt-1 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {/* Nightbot card */}
                  <div
                    className={`flex flex-col overflow-hidden rounded-3xl border ${
                      provider === "nightbot"
                        ? "border-accent shadow-[0_0_22px_rgba(129,140,248,0.7)]"
                        : "border-slate-800"
                    } bg-slate-950/80`}
                  >
                    <div className="relative h-28">
                      <Image
                        src={NightbotBanner}
                        alt="Nightbot banner"
                        fill
                        className="object-cover"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-slate-950/10 to-slate-950/70" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-5 py-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-slate-100">
                            Nightbot
                          </div>
                          <div className="text-xs text-slate-300">Import existing Nightbot commands</div>
                        </div>
                        <p className="text-xs text-slate-400">Imports</p>
                        <ul className="space-y-1 text-xs text-slate-200">
                          <li>✔ Commands</li>
                          <li>✔ Usage counters (where available)</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleNightbotOAuth}
                          className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-sky-400"
                        >
                          Import from Nightbot
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* StreamElements card */}
                  <div
                    className={`flex flex-col overflow-hidden rounded-3xl border ${
                      provider === "streamelements"
                        ? "border-accent shadow-[0_0_22px_rgba(129,140,248,0.7)]"
                        : "border-slate-800"
                    } bg-slate-950/80`}
                  >
                    <div className="relative h-28">
                      <Image
                        src={SteamelementsBanner}
                        alt="StreamElements banner"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-slate-950/10 to-slate-950/70" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-5 py-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-slate-100">
                            StreamElements
                          </div>
                          <div className="text-xs text-slate-300">Import from StreamElements (coming soon)</div>
                        </div>
                        <p className="text-xs text-slate-400">Planned support</p>
                        <ul className="space-y-1 text-xs text-slate-200">
                          <li>✔ Commands</li>
                          <li>✔ Timers</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleChooseProvider("streamelements")}
                          className="inline-flex items-center rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 opacity-70 cursor-default"
                        >
                          Coming soon
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Fossabot card */}
                  <div
                    className={`flex flex-col overflow-hidden rounded-3xl border ${
                      provider === "fossabot"
                        ? "border-accent shadow-[0_0_22px_rgba(129,140,248,0.7)]"
                        : "border-slate-800"
                    } bg-slate-950/80`}
                  >
                    <div className="relative h-28">
                      <Image
                        src={FossabotBanner}
                        alt="Fossabot banner"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/40 via-slate-950/10 to-slate-950/70" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-5 py-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-slate-100">
                            Fossabot
                          </div>
                          <div className="text-xs text-slate-300">Import from Fossabot (coming soon)</div>
                        </div>
                        <p className="text-xs text-slate-400">Planned support</p>
                        <ul className="space-y-1 text-xs text-slate-200">
                          <li>✔ Commands</li>
                          <li>✔ Timers</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleChooseProvider("fossabot")}
                          className="inline-flex items-center rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100 opacity-70 cursor-default"
                        >
                          Coming soon
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
