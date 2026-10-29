"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import ManagingChannelBadge from "../components/ManagingChannelBadge";
import { usePersistentSectionState } from "../hooks/usePersistentSectionState";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { revokeSession } from "../lib/session";
import NavIcon from "../components/NavIcon";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

const defaultLiveAnnouncementMessage = "$(channel) is now live! Streaming $(game) | $(title)";
const defaultRaidShoutoutMessage = "Make sure to go check out $(raider)'s channel at https://twitch.tv/$(raider) and they were playing $(game)!";

type ModuleRow = {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  message: string;
  native_shoutout_enabled?: boolean;
  native_shoutout_min_viewers?: number;
};

type BirthdayCommandConfig = {
  name: string;
  enabled: boolean;
  message: string;
};

type ToggleProps = {
  enabled: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

function ModuleToggle({ enabled, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      aria-pressed={enabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? "bg-emerald-500" : "bg-ax-border"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${
          enabled ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ModulesPage() {
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
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingNativeShoutout, setSavingNativeShoutout] = useState(false);
  const [savingNativeShoutoutThreshold, setSavingNativeShoutoutThreshold] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [birthdayCommands, setBirthdayCommands] = useState<BirthdayCommandConfig[]>([]);
  const [loadingBirthdayCommands, setLoadingBirthdayCommands] = useState(false);
  const [birthdayCommandsError, setBirthdayCommandsError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!login) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `${backendUrl}/modules/settings?login=${encodeURIComponent(login)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error("Failed to load modules");
        }
        const data: { modules?: ModuleRow[] } = await res.json();
        setModules(data.modules || []);
      } catch (err) {
        console.error(err);
        setError("Could not load modules.");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [login]);

  // When the birthdays module dropdown is opened, load per-command defaults
  // and any custom messages.
  useEffect(() => {
    if (!login || openModule !== "birthdays") return;
    let cancelled = false;
    setLoadingBirthdayCommands(true);
    setBirthdayCommandsError(null);
    (async () => {
      try {
        const [defaultsRes, messagesRes] = await Promise.all([
          fetch(
            `${backendUrl}/commands/default-settings?login=${encodeURIComponent(login)}`,
          ),
          fetch(
            `${backendUrl}/birthdays/command-messages?login=${encodeURIComponent(login)}`,
          ),
        ]);
        if (!defaultsRes.ok || !messagesRes.ok) {
          throw new Error("Failed to load birthday command settings");
        }
        const defaultsJson: { commands?: { name: string; enabled: boolean }[] } =
          await defaultsRes.json();
        const messagesJson: { commands?: { name: string; message: string }[] } =
          await messagesRes.json();
        const defaultsMap: Record<string, boolean> = {};
        for (const row of defaultsJson.commands || []) {
          defaultsMap[row.name.toLowerCase()] = row.enabled;
        }
        const messagesMap: Record<string, string> = {};
        for (const row of messagesJson.commands || []) {
          messagesMap[row.name.toLowerCase()] = row.message ?? "";
        }
        const birthdayNames = [
          "!birthday",
          "!nextbday",
          "!whenbday",
          "!addbday",
          "!addmybday",
          "!delbday",
          "!editbday",
        ];
        const configs: BirthdayCommandConfig[] = birthdayNames.map((name) => {
          const key = name.toLowerCase();
          return {
            name,
            enabled: defaultsMap[key] ?? true,
            message: messagesMap[key] ?? "",
          };
        });
        if (!cancelled) {
          setBirthdayCommands(configs);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setBirthdayCommandsError("Could not load birthday command settings.");
        }
      } finally {
        if (!cancelled) {
          setLoadingBirthdayCommands(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login, openModule]);

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

  const handleToggle = async (moduleName: string, next: boolean) => {
    if (!login) return;
    setModules((prev) =>
      prev.map((m) => (m.name === moduleName ? { ...m, enabled: next } : m)),
    );
    try {
      const res = await fetch(`${backendUrl}/modules/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, module: moduleName, enabled: next }),
      });
      if (!res.ok) {
        throw new Error("Failed to save module setting");
      }
    } catch (err) {
      console.error(err);
      // revert on failure
      setModules((prev) =>
        prev.map((m) =>
          m.name === moduleName ? { ...m, enabled: !next } : m,
        ),
      );
    }
  };

  const handleNativeShoutoutToggle = async (next: boolean) => {
    if (!login) return;
    const previous = modules.find((mod) => mod.name === "raid_shoutout")?.native_shoutout_enabled ?? true;
    setModules((current) => current.map((mod) =>
      mod.name === "raid_shoutout" ? { ...mod, native_shoutout_enabled: next } : mod,
    ));
    setSavingNativeShoutout(true);
    setEditError(null);
    try {
      const res = await fetch(`${backendUrl}/modules/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, module: "raid_native_shoutout", enabled: next }),
      });
      if (!res.ok) throw new Error("Failed to save native shoutout setting");
    } catch (err) {
      console.error(err);
      setModules((current) => current.map((mod) =>
        mod.name === "raid_shoutout" ? { ...mod, native_shoutout_enabled: previous } : mod,
      ));
      setEditError("Could not save the native shoutout setting.");
    } finally {
      setSavingNativeShoutout(false);
    }
  };

  const handleNativeShoutoutThresholdSave = async (module: ModuleRow) => {
    if (!login) return;
    const minimumViewers = Math.max(0, Math.floor(module.native_shoutout_min_viewers ?? 0));
    setSavingNativeShoutoutThreshold(true);
    setEditError(null);
    try {
      const res = await fetch(`${backendUrl}/modules/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          module: "raid_native_shoutout",
          enabled: module.native_shoutout_enabled ?? true,
          message: String(minimumViewers),
        }),
      });
      if (!res.ok) throw new Error("Failed to save raid viewer threshold");
      setModules((current) => current.map((entry) =>
        entry.name === "raid_shoutout"
          ? { ...entry, native_shoutout_min_viewers: minimumViewers }
          : entry,
      ));
    } catch (err) {
      console.error(err);
      setEditError("Could not save the raid viewer threshold.");
    } finally {
      setSavingNativeShoutoutThreshold(false);
    }
  };

  const handleBirthdayCommandToggle = async (commandName: string, next: boolean) => {
    if (!login) return;
    setBirthdayCommands((prev) =>
      prev.map((c) => (c.name === commandName ? { ...c, enabled: next } : c)),
    );
    try {
      const res = await fetch(`${backendUrl}/commands/default-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, command: commandName, enabled: next }),
      });
      if (!res.ok) {
        throw new Error("Failed to save command setting");
      }
      if (commandName.toLowerCase() === "!birthday") {
        setModules((prev) =>
          prev.map((m) =>
            m.name === "birthdays" ? { ...m, enabled: next } : m,
          ),
        );
      }
    } catch (err) {
      console.error(err);
      setBirthdayCommands((prev) =>
        prev.map((c) =>
          c.name === commandName ? { ...c, enabled: !next } : c,
        ),
      );
    }
  };

  const handleBirthdayCommandMessageSave = async (
    commandName: string,
    message: string,
  ) => {
    if (!login) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`${backendUrl}/birthdays/command-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, command: commandName, message: trimmed }),
      });
      if (!res.ok) {
        throw new Error("Failed to save message");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBirthdayCommandMessageReset = async (commandName: string) => {
    if (!login) return;
    try {
      const res = await fetch(`${backendUrl}/birthdays/command-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          command: commandName,
          resetToDefault: true,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to reset message");
      }
      setBirthdayCommands((prev) =>
        prev.map((c) => (c.name === commandName ? { ...c, message: "" } : c)),
      );
    } catch (err) {
      console.error(err);
    }
  };

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

        <div className="flex-1 flex flex-col gap-6 text-ax-heading">
          <div className="rounded-2xl border border-ax-subtle bg-ax-section p-6">
            <h1 className="text-2xl font-semibold mb-2">Modules</h1>
            <p className="text-sm text-ax-secondary mb-4">
              Enable or disable optional automation modules for your channel.
            </p>
            {!login && (
              <p className="text-sm text-ax-secondary">
                Log in on the homepage to manage modules for your channel.
              </p>
            )}
            {login && (
              <>
                {loading && (
                  <p className="text-sm text-ax-secondary">Loading modules…</p>
                )}
                {error && (
                  <p className="text-sm text-red-300 mb-2">{error}</p>
                )}
                <div className="space-y-4 mt-2">
                  {modules.map((m) => (
                    <div
                      key={m.name}
                      className="rounded-xl border border-ax-subtle bg-ax-section"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenModule((current) =>
                            current === m.name ? null : m.name,
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-medium text-ax-body">
                            {m.label}
                          </span>
                          <span className="text-xs text-ax-secondary">
                            {m.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <NavIcon
                            name={openModule === m.name ? "chevronDown" : "chevronRight"}
                            size={18}
                            tone="inherit"
                            className="text-ax-secondary"
                          />
                          <ModuleToggle
                            enabled={m.enabled}
                            onChange={(next) => handleToggle(m.name, next)}
                          />
                        </div>
                      </button>

                      {/* Live announcement dropdown */}
                      {openModule === m.name && m.name === "live_announcement" && (
                        <div className="border-t border-ax-subtle px-4 py-3">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-ax-body">
                              Announcement message
                            </span>
                          </div>
                          <p className="mb-1 text-xs text-ax-secondary">
                            Current message: {m.message || defaultLiveAnnouncementMessage}
                          </p>
                          <div className="mt-3 border-t border-ax-subtle pt-3">
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-medium text-ax-secondary">
                                Announcement message
                              </label>
                              <input
                                type="text"
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                className="w-full rounded-md border border-ax-border bg-ax-section px-2 py-1 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                placeholder={defaultLiveAnnouncementMessage}
                              />
                              <p className="text-[11px] text-ax-secondary">
                                You can use $(channel), $(game), and $(title) as
                                variables.
                              </p>
                              {editError && (
                                <div className="text-xs text-red-300">{editError}</div>
                              )}
                              <div className="mt-1 flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMessage(m.message ?? "");
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
                                    if (!login) return;
                                    setSavingEdit(true);
                                    setEditError(null);
                                    try {
                                      const res = await fetch(`${backendUrl}/modules/settings`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login,
                                          module: "live_announcement",
                                          enabled: m.enabled,
                                          resetToDefault: true,
                                        }),
                                      });
                                      if (!res.ok) {
                                        setEditError("Failed to restore default. Please try again.");
                                      } else {
                                        const nextMessage = defaultLiveAnnouncementMessage;
                                        setModules((prev) =>
                                          prev.map((mod) =>
                                            mod.name === "live_announcement"
                                              ? { ...mod, message: nextMessage }
                                              : mod,
                                          ),
                                        );
                                        setEditMessage(nextMessage);
                                      }
                                    } catch {
                                      setEditError("Network error while restoring default.");
                                    } finally {
                                      setSavingEdit(false);
                                    }
                                  }}
                                  className="rounded-md border border-ax-border px-3 py-1 text-xs font-medium text-ax-body hover:bg-ax-raised disabled:opacity-60"
                                  disabled={savingEdit}
                                >
                                  Restore Default
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!login) return;
                                    const trimmed = editMessage.trim();
                                    if (!trimmed) {
                                      setEditError("Message cannot be empty.");
                                      return;
                                    }
                                    setSavingEdit(true);
                                    setEditError(null);
                                    try {
                                      const res = await fetch(`${backendUrl}/modules/settings`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login,
                                          module: "live_announcement",
                                          enabled: m.enabled,
                                          message: trimmed,
                                        }),
                                      });
                                      if (!res.ok) {
                                        setEditError("Failed to save changes. Please try again.");
                                      } else {
                                        setModules((prev) =>
                                          prev.map((mod) =>
                                            mod.name === "live_announcement"
                                              ? { ...mod, message: trimmed }
                                              : mod,
                                          ),
                                        );
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
                          </div>
                        </div>
                      )}

                      {/* Raid auto-shoutout dropdown */}
                      {openModule === m.name && m.name === "raid_shoutout" && (
                        <div className="border-t border-ax-subtle px-4 py-3">
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-ax-body">
                              Shoutout message
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 rounded-md border border-ax-subtle bg-ax-section px-3 py-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-ax-body">Native Twitch /shoutout command</span>
                              <span className="text-[11px] text-ax-muted">Independently sends Twitch&apos;s built-in shoutout when a raid arrives.</span>
                            </div>
                            <ModuleToggle
                              enabled={m.native_shoutout_enabled ?? true}
                              onChange={handleNativeShoutoutToggle}
                              disabled={savingNativeShoutout}
                            />
                          </div>
                          <div className="flex flex-col gap-2 rounded-md border border-ax-subtle bg-ax-section px-3 py-2 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex flex-col gap-1">
                              <label htmlFor="native-shoutout-min-viewers" className="text-xs font-medium text-ax-body">
                                Minimum raid viewers for native shoutout
                              </label>
                              <p className="text-[11px] text-ax-muted">0 sends it for every raid. Below the minimum, only the custom chat message is sent.</p>
                              <input
                                id="native-shoutout-min-viewers"
                                type="number"
                                min={0}
                                step={1}
                                value={m.native_shoutout_min_viewers ?? 0}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  if (Number.isInteger(value) && value >= 0) {
                                    setModules((current) => current.map((entry) =>
                                      entry.name === "raid_shoutout"
                                        ? { ...entry, native_shoutout_min_viewers: value }
                                        : entry,
                                    ));
                                  }
                                }}
                                className="w-32 rounded-md border border-ax-border bg-ax-section px-2 py-1 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleNativeShoutoutThresholdSave(m)}
                              disabled={savingNativeShoutoutThreshold}
                              className="self-start rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-ax-btn-text hover:bg-accent/90 disabled:opacity-60 sm:self-auto"
                            >
                              {savingNativeShoutoutThreshold ? "Saving..." : "Save threshold"}
                            </button>
                          </div>
                          <p className="mb-1 text-xs text-ax-secondary">
                            Current message: {m.message || defaultRaidShoutoutMessage}
                          </p>
                          <div className="mt-3 border-t border-ax-subtle pt-3">
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-medium text-ax-secondary">
                                Shoutout message
                              </label>
                              <input
                                type="text"
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                className="w-full rounded-md border border-ax-border bg-ax-section px-2 py-1 text-sm text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                placeholder={defaultRaidShoutoutMessage}
                              />
                              <p className="text-[11px] text-ax-secondary">
                                You can use $(raider) and $(game) as variables.
                                This custom chat message is sent independently of the native shoutout toggle above.
                              </p>
                              {editError && (
                                <div className="text-xs text-red-300">{editError}</div>
                              )}
                              <div className="mt-1 flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMessage(m.message ?? "");
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
                                    if (!login) return;
                                    setSavingEdit(true);
                                    setEditError(null);
                                    try {
                                      const res = await fetch(`${backendUrl}/modules/settings`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login,
                                          module: "raid_shoutout",
                                          enabled: m.enabled,
                                          resetToDefault: true,
                                        }),
                                      });
                                      if (!res.ok) {
                                        setEditError("Failed to restore default. Please try again.");
                                      } else {
                                        const nextMessage = defaultRaidShoutoutMessage;
                                        setModules((prev) =>
                                          prev.map((mod) =>
                                            mod.name === "raid_shoutout"
                                              ? { ...mod, message: nextMessage }
                                              : mod,
                                          ),
                                        );
                                        setEditMessage(nextMessage);
                                      }
                                    } catch {
                                      setEditError("Network error while restoring default.");
                                    } finally {
                                      setSavingEdit(false);
                                    }
                                  }}
                                  className="rounded-md border border-ax-border px-3 py-1 text-xs font-medium text-ax-body hover:bg-ax-raised disabled:opacity-60"
                                  disabled={savingEdit}
                                >
                                  Restore Default
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!login) return;
                                    const trimmed = editMessage.trim();
                                    if (!trimmed) {
                                      setEditError("Message cannot be empty.");
                                      return;
                                    }
                                    setSavingEdit(true);
                                    setEditError(null);
                                    try {
                                      const res = await fetch(`${backendUrl}/modules/settings`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          login,
                                          module: "raid_shoutout",
                                          enabled: m.enabled,
                                          message: trimmed,
                                        }),
                                      });
                                      if (!res.ok) {
                                        setEditError("Failed to save changes. Please try again.");
                                      } else {
                                        setModules((prev) =>
                                          prev.map((mod) =>
                                            mod.name === "raid_shoutout"
                                              ? { ...mod, message: trimmed }
                                              : mod,
                                          ),
                                        );
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
                          </div>
                        </div>
                      )}

                      {/* Birthdays module dropdown */}
                      {openModule === m.name && m.name === "birthdays" && (
                        <div className="border-t border-ax-subtle px-4 py-3 text-xs text-ax-body">
                          <p className="mb-2 text-ax-secondary">
                            Control individual birthday commands and customize how the bot responds.
                          </p>
                          {birthdayCommandsError && (
                            <p className="mb-2 text-red-300">{birthdayCommandsError}</p>
                          )}
                          {loadingBirthdayCommands && (
                            <p className="mb-2 text-ax-secondary">Loading birthday commands…</p>
                          )}
                          {!loadingBirthdayCommands && (
                            <div className="space-y-3">
                              {birthdayCommands.map((cmd) => {
                                const canEditMessage =
                                  cmd.name === "!birthday" || cmd.name === "!nextbday";
                                return (
                                <div
                                  key={cmd.name}
                                  className="rounded-lg border border-ax-subtle bg-ax-section px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-ax-body">
                                          {cmd.name}
                                        </span>
                                      </div>
                                    </div>
                                    <ModuleToggle
                                      enabled={cmd.enabled}
                                      onChange={(next) =>
                                        handleBirthdayCommandToggle(cmd.name, next)
                                      }
                                    />
                                  </div>
                                  {canEditMessage && (
                                    <div className="mt-2 flex flex-col gap-1">
                                      <input
                                        type="text"
                                        value={cmd.message}
                                        onChange={(e) =>
                                          setBirthdayCommands((prev) =>
                                            prev.map((c) =>
                                              c.name === cmd.name
                                                ? { ...c, message: e.target.value }
                                                : c,
                                            ),
                                          )
                                        }
                                        className="w-full rounded-md border border-ax-border bg-ax-section px-2 py-1 text-xs text-ax-body focus:outline-none focus:ring-2 focus:ring-accent/60"
                                        placeholder="Leave empty to use the default response"
                                      />
                                      <p className="text-base font-bold text-ax-secondary">
                                        You can use simple placeholders like
                                        {" "}
                                        <code className="rounded bg-ax-raised px-1 py-0.5 text-[10px]">
                                          $(names)
                                        </code>
                                        ,
                                        {" "}
                                        <code className="rounded bg-ax-raised px-1 py-0.5 text-[10px]">
                                          $(date)
                                        </code>
                                        .
                                      </p>
                                      <div className="mt-1 flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleBirthdayCommandMessageReset(cmd.name)
                                          }
                                          className="rounded-md border border-ax-border px-2 py-0.5 text-[11px] text-ax-body hover:bg-ax-raised"
                                        >
                                          Reset
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleBirthdayCommandMessageSave(
                                              cmd.name,
                                              cmd.message,
                                            )
                                          }
                                          className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-ax-btn-text hover:bg-accent/90"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );})}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {modules.length === 0 && !loading && !error && (
                    <p className="text-sm text-ax-secondary">
                      No modules available yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
