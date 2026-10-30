"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { responsiveSidebarClassName, useResponsiveSidebar } from "../hooks/useResponsiveSidebar";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

const defaultCommands: { name: string; label?: string; description: string; enabled: boolean }[] = [
  {
    name: "!vanish",
    description: "Times out the user briefly with a playful message.",
    enabled: true,
  },
  {
    name: "!title",
    label: "!title <new title>",
    description: "Changes the stream title (broadcaster or mods only).",
    enabled: true,
  },
  {
    name: "!game",
    label: "!game <category>",
    description: "Changes the Twitch category/game (broadcaster or mods only).",
    enabled: true,
  },
  {
    name: "!accountage",
    label: "!accountage [username]",
    description: "Shows when a user's Twitch account was created.",
    enabled: true,
  },
  {
    name: "!followage",
    label: "!followage [username]",
    description: "Shows how long a user has followed the channel.",
    enabled: true,
  },
  {
    name: "!watchtime",
    label: "!watchtime [username]",
    description: "Shows how many hours a viewer has spent in the channel.",
    enabled: true,
  },
  {
    name: "!uptime",
    description: "Shows how long the channel has been live this session.",
    enabled: true,
  },
  {
    name: "!clip",
    description: "Creates a Twitch clip of the last moments of the stream.",
    enabled: true,
  },
  {
    name: "!commands",
    description: "Links viewers to your channel's custom commands page.",
    enabled: true,
  },
  {
    name: "!birthday",
    description: "Shows birthdays that fall on today from your saved list.",
    enabled: true,
  },
  {
    name: "!nextbday",
    description: "Shows the next upcoming birthday from your saved list.",
    enabled: true,
  },
  {
    name: "!whenbday",
    label: "!whenbday @USER",
    description: "Shows the saved birthday for a specific user.",
    enabled: true,
  },
  {
    name: "!addbday",
    label: "!addbday NAME MM DD",
    description: "Add or update a named birthday (mods only).",
    enabled: true,
  },
  {
    name: "!addmybday",
    label: "!addmybday MM DD",
    description: "Viewers can add their own birthday.",
    enabled: true,
  },
  {
    name: "!delbday",
    label: "!delbday NAME",
    description: "Delete a saved birthday by name (mods only).",
    enabled: true,
  },
  {
    name: "!editbday",
    label: "!editbday USER MM DD",
    description: "Change a user's saved birthday (mods only).",
    enabled: true,
  },
];

type CustomCommandRole = "all" | "broadcaster" | "moderator" | "vip";

type CommandToggleProps = {
  name: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
};

function CommandToggle({ enabled, onChange }: CommandToggleProps) {
  return (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
 enabled ? "bg-emerald-500" : "bg-ax-border"
 }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${
 enabled ? "translate-x-4" : "translate-x-1"
 }`}
    />
  </button>
  );
}

function CommandsPage() {
  useRequireAuth();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [channelLogin, setChannelLogin] = useState<string | null>(null);
  const [loggedInLogin, setLoggedInLogin] = useState<string | null>(null);
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") === "custom" ? "custom" : "default") as "default" | "custom";
  const setView = (next: "default" | "custom") => router.push(`/commands?view=${next}`);
  const [defaultSettings, setDefaultSettings] = useState<Record<string, boolean>>({});
  const [customCommands, setCustomCommands] = useState<
    { name: string; description: string; enabled: boolean; role: CustomCommandRole }[]
  >([]);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editResponse, setEditResponse] = useState("");
  const [editRole, setEditRole] = useState<CustomCommandRole>("all");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [customPage, setCustomPage] = useState(1);
  const CUSTOM_PAGE_SIZE = 14;
  const [commandSearch, setCommandSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCmdName, setNewCmdName] = useState("");
  const [newCmdResponse, setNewCmdResponse] = useState("");
  const [newCmdRole, setNewCmdRole] = useState<CustomCommandRole>("all");
  const [addCmdError, setAddCmdError] = useState<string | null>(null);
  const [addingCmd, setAddingCmd] = useState(false);
  const addModalRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    const channelFromQuery = params.get("channel");

    if (storedLogin) {
      setIsLoggedIn(true);
      setLoggedInLogin(storedLogin.toLowerCase());
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      if (activeChannel && activeChannel.toLowerCase() !== storedLogin.toLowerCase()) setIsEditor(true);
    }
    if (storedAvatar) {
      setAvatarUrl(storedAvatar);
    }

    // Determine which channel's commands to display. If a channel is supplied
    // in the URL, always show that broadcaster's commands (so shared links
    // work for viewers). Otherwise, fall back to the active channel (which may
    // differ from the logged-in user when they are managing another channel).
    if (channelFromQuery) {
      setChannelLogin(channelFromQuery.toLowerCase());
    } else if (storedLogin) {
      const activeChannel = window.localStorage.getItem("axyra.activeChannel");
      setChannelLogin((activeChannel || storedLogin).toLowerCase());
    }
  }, []);

  // Fetch per-command default settings for this broadcaster when viewing
  // default commands.
  useEffect(() => {
    if (!channelLogin || view !== "default") return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/commands/default-settings?login=${encodeURIComponent(channelLogin)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data: { commands?: { name: string; enabled: boolean }[] } = await res.json();
        const map: Record<string, boolean> = {};
        for (const cmd of data.commands || []) {
          map[cmd.name] = cmd.enabled;
        }
        setDefaultSettings(map);
      } catch {
        // ignore fetch errors; defaults will be treated as enabled
      }
    })();
    return () => controller.abort();
  }, [channelLogin, view]);

  // Reset to page 1 whenever the commands list or search query changes
  useEffect(() => { setCustomPage(1); }, [customCommands.length, commandSearch]);

  useEffect(() => {
    if (!channelLogin || view !== "custom") return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/commands/custom?login=${encodeURIComponent(channelLogin)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data: {
          commands?: { name: string; response: string; enabled?: boolean; role?: string }[];
        } = await res.json();
        const rows = (data.commands || []).map((c) => {
          const rawRole = (c.role || "all").toLowerCase();
          let role: CustomCommandRole = "all";
          switch (rawRole) {
            case "broadcaster":
              role = "broadcaster";
              break;
            case "moderator":
              role = "moderator";
              break;
            case "vip":
              role = "vip";
              break;
            default:
              role = "all";
          }
          return {
            name: c.name,
            description: c.response,
            enabled: c.enabled ?? true,
            role,
          };
        });
        setCustomCommands(rows);
      } catch {
        // ignore fetch errors for now
      }
    })();
    return () => controller.abort();
  }, [channelLogin, view]);

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
    <main className="min-h-screen flex flex-col bg-ax-bg md:h-screen md:overflow-hidden">
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

      <div className="flex flex-1 w-full flex-col items-stretch gap-3 px-3 pb-4 pt-3 md:flex-row md:gap-6 md:px-4 md:pb-6 md:pt-6 md:min-h-0">
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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading min-h-0">
          <div className="w-full flex-1 flex flex-col rounded-md border border-ax-subtle bg-ax-section p-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold">Commands</h1>
                <div className="inline-flex rounded-md border border-ax-border bg-ax-section p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setView("default")}
                    aria-pressed={view === "default"}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition sm:px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 view === "default"
 ? "bg-ax-accent text-ax-btn-text"
 : "text-ax-body hover:bg-ax-raised hover:text-ax-heading"
 }`}
                  >
                    Default commands
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("custom")}
                    aria-pressed={view === "custom"}
                    className={`ml-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition sm:px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
 view === "custom"
 ? "bg-ax-accent text-ax-btn-text"
 : "text-ax-body hover:bg-ax-raised hover:text-ax-heading"
 }`}
                  >
                    Custom commands
                  </button>
                </div>
              </div>
              {view === "custom" && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ax-secondary pointer-events-none">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search commands..."
                      value={commandSearch}
                      onChange={(e) => setCommandSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 rounded-md border border-ax-border bg-ax-section text-base text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60 w-64"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setNewCmdName(""); setNewCmdResponse(""); setNewCmdRole("all"); setAddCmdError(null); setShowAddModal(true); }}
                    className="px-4 py-2 rounded-md bg-accent text-ax-btn-text text-sm font-medium hover:bg-accent/90 transition whitespace-nowrap"
                  >
                    Add +
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-0 overflow-auto rounded-md border border-ax-subtle bg-ax-section">
              <table className="min-w-full w-full table-fixed text-sm text-left [&_tbody_tr:last-child]:border-b-0">
                <thead className="bg-ax-section text-ax-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-36">Command</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold w-28 text-center">Enabled</th>
                    {view === "custom" && (
                      <th className="px-4 py-3 font-semibold w-24 text-center">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {view === "default" && (
                    <>
                      {defaultCommands.map((row) => (
                        <tr key={row.name} className="border-t border-ax-subtle hover:bg-ax-section">
                          <td className="px-4 py-2 font-mono text-ax-body truncate">{row.label ?? row.name}</td>
                          <td className="px-4 py-2 text-ax-secondary max-w-0 truncate" title={row.description}>{row.description}</td>
                          <td className="px-4 py-2 text-center">
                            {channelLogin && loggedInLogin === channelLogin ? (
                              <CommandToggle
                                name={row.name}
                                enabled={defaultSettings[row.name] ?? true}
                                onChange={async (next) => {
                                  setDefaultSettings((prev) => ({ ...prev, [row.name]: next }));
                                  try {
                                    await fetch(`${backendUrl}/commands/default-settings`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        login: channelLogin,
                                        command: row.name,
                                        enabled: next,
                                      }),
                                    });
                                  } catch {
                                    // ignore network errors; UI state already updated
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-ax-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {defaultCommands.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-center text-ax-secondary">
                            No commands to display yet.
                          </td>
                        </tr>
                      )}
                      {/* filler row — absorbs remaining height */}
                      <tr className="h-full border-t border-ax-subtle"><td colSpan={3} /></tr>
                    </>
                  )}
                  {view === "custom" && (() => {
                    const query = commandSearch.trim().toLowerCase();
                    const filtered = query
                      ? customCommands.filter((c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query))
                      : customCommands;
                    const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOM_PAGE_SIZE));
                    const safePage = Math.min(customPage, totalPages);
                    const pageRows = filtered.slice((safePage - 1) * CUSTOM_PAGE_SIZE, safePage * CUSTOM_PAGE_SIZE);
                    return (
                      <>{pageRows.map((row) => (
                        <Fragment key={row.name}>
                          <tr className="border-t border-ax-subtle hover:bg-ax-section">
                            <td className="px-4 py-2 font-mono text-ax-body truncate">{row.name}</td>
                            <td className="px-4 py-2 text-ax-secondary max-w-0 truncate" title={row.description}>{row.description}</td>
                            <td className="px-4 py-2 text-center">
                              {isLoggedIn && channelLogin && loggedInLogin === channelLogin ? (
                                <CommandToggle
                                  name={row.name}
                                  enabled={row.enabled}
                                  onChange={async (next) => {
                                    setCustomCommands((prev) =>
                                      prev.map((cmd) =>
                                        cmd.name === row.name ? { ...cmd, enabled: next } : cmd,
                                      ),
                                    );
                                    try {
                                      await fetch(`${backendUrl}/commands/custom`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login: channelLogin,
                                          command: row.name,
                                          enabled: next,
                                        }),
                                      });
                                    } catch {
                                      // ignore network errors; UI state already updated
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-ax-muted text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {isLoggedIn && channelLogin && loggedInLogin === channelLogin ? (
                                <div className="inline-flex items-center gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingCommand === row.name) {
                                        setEditingCommand(null);
                                        setEditError(null);
                                        return;
                                      }
                                      setEditingCommand(row.name);
                                      setEditName(row.name);
                                      setEditResponse(row.description);
                                      setEditRole(row.role);
                                      setEditError(null);
                                    }}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ax-border bg-ax-section text-ax-secondary hover:bg-ax-raised"
                                  >
                                    <span className="sr-only">Edit command</span>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-3.5 w-3.5"
                                    >
                                      <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.518l-3 .8a.5.5 0 0 1-.606-.606l.8-3a2 2 0 0 1 .518-.878l8.5-8.5Z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteTarget(row.name);
                                      setDeleteError(null);
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ax-secondary transition hover:bg-red-500/15 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ax-focus disabled:opacity-50"
                                  >
                                    <span className="sr-only">Delete command</span>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-3.5 w-3.5"
                                    >
                                      <path d="M6 2a1 1 0 0 0-1 1v1H3.5a.5.5 0 0 0 0 1h.54l.76 10.137A2 2 0 0 0 6.79 17h6.42a2 2 0 0 0 1.99-1.863L15.96 5H16.5a.5.5 0 0 0 0-1H15V3a1 1 0 0 0-1-1H6Zm1 2V3h6v1H7Z" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-ax-muted text-xs">—</span>
                              )}
                            </td>
                          </tr>
                          {editingCommand === row.name && (
                            <tr className="border-t border-ax-subtle bg-ax-section">
                              <td colSpan={4} className="px-4 py-3">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <label className="text-xs font-medium text-ax-secondary sm:w-32">Command name</label>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      className="flex-1 rounded-md border border-ax-border bg-ax-section px-2 py-1 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <label className="text-xs font-medium text-ax-secondary sm:w-32">Response</label>
                                    <input
                                      type="text"
                                      value={editResponse}
                                      onChange={(e) => setEditResponse(e.target.value)}
                                      className="flex-1 rounded-md border border-ax-border bg-ax-section px-2 py-1 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                    <label className="text-xs font-medium text-ax-secondary sm:w-32">Who can use</label>
                                    <select
                                      value={editRole}
                                      onChange={(e) => setEditRole(e.target.value as CustomCommandRole)}
                                      className="flex-1 rounded-md border border-ax-border bg-ax-section px-2 py-1 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                    >
                                      <option value="all">Everyone</option>
                                      <option value="vip">VIP+</option>
                                      <option value="moderator">Mod+</option>
                                      <option value="broadcaster">Owner only</option>
                                    </select>
                                  </div>
                                  {editError && (
                                    <div className="text-xs text-red-300">{editError}</div>
                                  )}
                                  <div className="mt-1 flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommand(null);
                                        setEditError(null);
                                      }}
                                      className="rounded-md border border-ax-border px-3 py-1 text-xs font-medium text-ax-body hover:bg-ax-raised"
                                      disabled={savingEdit}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!channelLogin || !editingCommand) return;
                                        const trimmedName = editName.trim();
                                        if (!trimmedName) {
                                          setEditError("Command name cannot be empty.");
                                          return;
                                        }
                                        setSavingEdit(true);
                                        setEditError(null);
                                        try {
                                          const res = await fetch(`${backendUrl}/commands/custom/update`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              login: channelLogin,
                                              originalCommand: editingCommand,
                                              command: trimmedName,
                                              response: editResponse,
                                              role: editRole,
                                            }),
                                          });
                                          if (!res.ok) {
                                            setEditError("Failed to save changes. Please try again.");
                                          } else {
                                            setCustomCommands((prev) =>
                                              prev.map((cmd) =>
                                                cmd.name === editingCommand
                                                  ? {
                                                      ...cmd,
                                                      name: trimmedName,
                                                      description: editResponse,
                                                      role: editRole,
                                                    }
                                                  : cmd,
                                              ),
                                            );
                                            setEditingCommand(null);
                                          }
                                        } catch {
                                          setEditError("Network error while saving changes.");
                                        } finally {
                                          setSavingEdit(false);
                                        }
                                      }}
                                      className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-ax-btn-text hover:bg-accent/90 disabled:opacity-60"
                                      disabled={savingEdit}
                                    >
                                      {savingEdit ? "Saving..." : "Save changes"}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                      {customCommands.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-ax-secondary">
                            No commands to display yet.
                          </td>
                        </tr>
                      )}
                      {customCommands.length > 0 && pageRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-ax-secondary">
                            No commands match your search.
                          </td>
                        </tr>
                      )}
                      {/* filler row — absorbs remaining height */}
                      <tr className="h-full border-t border-ax-subtle"><td colSpan={4} /></tr>
                    </>);
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination — custom commands only */}
            {view === "custom" && (() => {
              const query = commandSearch.trim().toLowerCase();
              const filtered = query
                ? customCommands.filter((c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query))
                : customCommands;
              const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOM_PAGE_SIZE));
              if (totalPages <= 1) return null;
              const safePage = Math.min(customPage, totalPages);
              return (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setCustomPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="flex items-center justify-center text-ax-secondary hover:text-ax-heading disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <span className="text-sm text-ax-secondary">
                    Page <span className="font-semibold text-ax-body">{safePage}</span> of{" "}
                    <span className="font-semibold text-ax-body">{totalPages}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="flex items-center justify-center text-ax-secondary hover:text-ax-heading disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div ref={addModalRef} className="w-full max-w-md rounded-md border border-ax-border bg-ax-section p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-ax-heading">Add Custom Command</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ax-secondary hover:text-ax-body transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ax-secondary">Command name</label>
                <input
                  type="text"
                  placeholder="e.g. !socials"
                  value={newCmdName}
                  onChange={(e) => setNewCmdName(e.target.value)}
                  className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ax-secondary">Bot response</label>
                <textarea
                  placeholder="What the bot says when the command is triggered..."
                  value={newCmdResponse}
                  onChange={(e) => setNewCmdResponse(e.target.value)}
                  rows={3}
                  className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body placeholder-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60 resize-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ax-secondary">User level</label>
                <select
                  value={newCmdRole}
                  onChange={(e) => setNewCmdRole(e.target.value as CustomCommandRole)}
                  className="rounded-md border border-ax-border bg-ax-section px-3 py-2 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                >
                  <option value="all">Everyone</option>
                  <option value="vip">VIP+</option>
                  <option value="moderator">Mod+</option>
                  <option value="broadcaster">Owner only</option>
                </select>
              </div>
              {addCmdError && <div className="text-xs text-red-300">{addCmdError}</div>}
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-md border border-ax-border px-4 py-2 text-sm font-medium text-ax-body hover:bg-ax-raised transition"
                  disabled={addingCmd}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newCmdName.trim() || !newCmdResponse.trim() || addingCmd}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ax-btn-text hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (!channelLogin || !newCmdName.trim() || !newCmdResponse.trim()) return;
                    setAddingCmd(true);
                    setAddCmdError(null);
                    try {
                      const res = await fetch(`${backendUrl}/commands/custom/add`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ login: channelLogin, command: newCmdName.trim(), response: newCmdResponse.trim(), role: newCmdRole }),
                      });
                      if (!res.ok) {
                        setAddCmdError("Failed to add command. Please try again.");
                      } else {
                        setCustomCommands((prev) => [
                          ...prev,
                          { name: newCmdName.trim(), description: newCmdResponse.trim(), enabled: true, role: newCmdRole },
                        ]);
                        setShowAddModal(false);
                      }
                    } catch {
                      setAddCmdError("Network error. Please try again.");
                    } finally {
                      setAddingCmd(false);
                    }
                  }}
                >
                  {addingCmd ? "Adding..." : "Add Command"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <DeleteCommandModal
          commandName={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (deleting) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={async () => {
            if (!channelLogin || !deleteTarget) return;
            setDeleting(true);
            setDeleteError(null);
            try {
              const res = await fetch(`${backendUrl}/commands/custom/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  login: channelLogin,
                  command: deleteTarget,
                }),
              });
              if (!res.ok) {
                setDeleteError("Failed to delete command. Please try again.");
              } else {
                setCustomCommands((prev) => prev.filter((cmd) => cmd.name !== deleteTarget));
                setDeleteTarget(null);
              }
            } catch {
              setDeleteError("Network error while deleting command.");
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </main>
  );
}

// Delete confirmation modal overlay
function DeleteCommandModal({
  commandName,
  onCancel,
  onConfirm,
  deleting,
  error,
}: {
  commandName: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-md border border-ax-subtle bg-ax-section p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ax-body mb-2">Delete command</h2>
        <p className="text-sm text-ax-secondary mb-3">
          Are you sure you want to delete
          <span className="font-mono text-red-300"> {commandName} </span>
          for this channel? This action cannot be undone.
        </p>
        {error && <div className="mb-2 text-xs text-red-300">{error}</div>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-ax-border px-3 py-1 text-xs font-medium text-ax-body hover:bg-ax-raised disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-ax-heading hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommandsPageWrapper() {
  return (
    <Suspense>
      <CommandsPage />
    </Suspense>
  );
}
