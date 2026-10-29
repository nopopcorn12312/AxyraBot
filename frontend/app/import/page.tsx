"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { useRequireAuth } from "../hooks/useRequireAuth";
import NightbotPFP from "../images/NightbotPFP.png";
import NightbotBanner from "../images/NightbotBanner.png";
import SteamelementsBanner from "../images/SteamelementsBanner.png";
import FossabotBanner from "../images/FossabotBanner.png";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";
import { Check } from "lucide-react";

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
  useRequireAuth();
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
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      revokeSession();
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setLogin(null);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.location.href = "/";
  };

  const redirectTarget = frontendUrl || "https://axyrabot.com";
  const _lastLogin = typeof window !== "undefined" ? (window.localStorage.getItem("axyra.lastLogin") ?? "") : "";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${_lastLogin ? `&hint=${encodeURIComponent(_lastLogin)}` : ""}`;
  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  const handleNightbotOAuth = async () => {
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
    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(await res.text());
      const data: { url: string } = await res.json();
      window.location.href = data.url;
    } catch {
      setParseError("Couldn't start the Nightbot import. Please try again.");
    }
  };

  const handleChooseProvider = (next: Provider) => {
    setProvider(next);
    setParseError(null);
    setImportResult(null);
  };

  return (
    <main className="min-h-screen flex flex-col bg-ax-bg">
      {successModalOpen && successProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-ax-border bg-ax-section p-5 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-ax-heading">Import complete</h2>
            <p className="mb-4 text-sm text-ax-secondary">
              Successfully imported from {providerDisplay[successProvider]}.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSuccessModalOpen(false)}
                className="inline-flex items-center rounded-md bg-ax-raised px-4 py-1.5 text-sm font-semibold text-ax-body hover:bg-ax-raised"
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

      <div className="flex flex-1 w-full gap-6 px-4 pb-6 items-stretch">
        <div
          className={`${sidebarOpen ? "w-60" : "invisible w-0 -mr-6 -translate-x-4 overflow-hidden !border-0 !p-0 opacity-0"} flex flex-col rounded-2xl border border-ax-subtle bg-ax-section p-3 transition-all duration-200 whitespace-nowrap motion-reduce:transition-none`}
        >
          <nav className="mt-1 flex flex-col gap-4 text-sm text-ax-body">
            {/* Main section */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={mainSectionOpen} onClick={() => setMainSectionOpen((open) => !open)}
                className="flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-ax-secondary hover:text-ax-body"
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
 className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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
                    className={`group flex items-center gap-3 rounded-xl py-2 text-left font-medium transition ${sidebarOpen ? "px-3" : "justify-center px-0"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading">
          <div className="rounded-2xl border border-ax-subtle bg-ax-section p-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-semibold">Import custom commands</h1>
              {login && (
                <span className="text-xs text-ax-secondary">
                  Importing for <span className="font-semibold">{login}</span>
                </span>
              )}
            </div>
            {!isLoggedIn && (
              <p className="text-sm text-ax-secondary">
                Log in with Twitch on the homepage to import commands into your channel.
              </p>
            )}
            {isLoggedIn && (
              <>
                <p className="text-sm text-ax-secondary mb-3">
                  Import your commands from other chat bots into AxyraBot. Choose a platform card below to start an
                  import for your channel.
                </p>

                {importResult && (
                  <p className="mb-3 text-xs text-emerald-300">{importResult}</p>
                )}
                {parseError && (
                  <p className="mb-3 text-xs text-rose-300">{parseError}</p>
                )}

                <div className="mt-1 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {/* Nightbot card */}
                  <div
                    className={`flex flex-col overflow-hidden rounded-3xl border ${
                      provider === "nightbot"
                        ? "border-accent shadow-[0_0_14px_rgba(56,189,248,0.35)]"
                        : "border-ax-subtle"
                    } bg-ax-section`}
                  >
                    <div className="relative h-28">
                      <Image
                        src={NightbotBanner}
                        alt="Nightbot banner"
                        fill
                        className="object-cover"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/5 to-black/50" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-5 py-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-ax-body">
                            Nightbot
                          </div>
                          <div className="text-xs text-ax-secondary">Import existing Nightbot commands</div>
                        </div>
                        <p className="text-xs text-ax-secondary">Imports</p>
                        <ul className="space-y-1 text-xs text-ax-body">
                          <li className="flex items-center gap-1.5"><Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-emerald-300" />Commands</li>
                          <li className="flex items-center gap-1.5"><Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-emerald-300" />Usage counters (where available)</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleNightbotOAuth}
                          className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-xs font-semibold text-ax-btn-text shadow-sm hover:bg-ax-accent"
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
                        ? "border-accent shadow-[0_0_14px_rgba(56,189,248,0.35)]"
                        : "border-ax-subtle"
                    } bg-ax-section`}
                  >
                    <div className="relative h-28">
                      <Image
                        src={SteamelementsBanner}
                        alt="StreamElements banner"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/5 to-black/50" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-5 py-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-ax-body">
                            StreamElements
                          </div>
                          <div className="text-xs text-ax-secondary">Import from StreamElements (coming soon)</div>
                        </div>
                        <p className="text-xs text-ax-secondary">Planned support</p>
                        <ul className="space-y-1 text-xs text-ax-body">
                          <li className="flex items-center gap-1.5"><Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-emerald-300" />Commands</li>
                          <li className="flex items-center gap-1.5"><Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-emerald-300" />Timers</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleChooseProvider("streamelements")}
                          className="inline-flex items-center rounded-md bg-ax-raised px-4 py-2 text-xs font-semibold text-ax-body opacity-70 cursor-default"
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
                        ? "border-accent shadow-[0_0_14px_rgba(56,189,248,0.35)]"
                        : "border-ax-subtle"
                    } bg-ax-section`}
                  >
                    <div className="relative h-28">
                      <Image
                        src={FossabotBanner}
                        alt="Fossabot banner"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/5 to-black/50" />
                    </div>
                    <div className="flex flex-1 flex-col justify-between px-5 py-4 text-sm">
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-ax-body">
                            Fossabot
                          </div>
                          <div className="text-xs text-ax-secondary">Import from Fossabot (coming soon)</div>
                        </div>
                        <p className="text-xs text-ax-secondary">Planned support</p>
                        <ul className="space-y-1 text-xs text-ax-body">
                          <li className="flex items-center gap-1.5"><Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-emerald-300" />Commands</li>
                          <li className="flex items-center gap-1.5"><Check aria-hidden="true" strokeWidth={1.75} size={14} className="shrink-0 text-emerald-300" />Timers</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleChooseProvider("fossabot")}
                          className="inline-flex items-center rounded-md bg-ax-raised px-4 py-2 text-xs font-semibold text-ax-body opacity-70 cursor-default"
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
