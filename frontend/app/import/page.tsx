"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

type Provider = "nightbot" | "streamelements" | "fossabot" | "other";

type ParsedCommand = {
  name: string;
  response: string;
};

export default function ImportPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainSectionOpen, setMainSectionOpen] = useState(true);
  const [vanitySectionOpen, setVanitySectionOpen] = useState(true);
  const [otherSectionOpen, setOtherSectionOpen] = useState(true);
  const [commandsOpen, setCommandsOpen] = useState(true);
  const [provider, setProvider] = useState<Provider>("nightbot");
  const [rawInput, setRawInput] = useState("");
  const [parsed, setParsed] = useState<ParsedCommand[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      setLogin(storedLogin.toLowerCase());
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
      setParsed([]);
      setRawInput("");
    } else if (nightbotStatus === "error") {
      setParseError("Nightbot import failed or was cancelled. You can try again or use manual paste.");
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

  const redirectTarget = frontendUrl || "http://localhost:3000";
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

  const handleParse = () => {
    setParseError(null);
    setImportResult(null);
    const text = rawInput || "";
    const lines = text.split(/\r?\n/);
    const seen = new Map<string, string>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("!")) continue;
      const firstSpace = trimmed.indexOf(" ");
      if (firstSpace === -1) continue;
      const name = trimmed.slice(0, firstSpace).trim();
      const response = trimmed.slice(firstSpace + 1).trim();
      if (!name || !response) continue;
      seen.set(name, response);
    }
    const result: ParsedCommand[] = Array.from(seen.entries()).map(([name, response]) => ({
      name,
      response,
    }));
    if (result.length === 0) {
      setParsed([]);
      setParseError("No commands detected. Paste lines like `!hello Hello chat!`.");
      return;
    }
    setParsed(result);
  };

  const handleImport = async () => {
    if (!login) return;
    if (parsed.length === 0) {
      setParseError("Parse commands first before importing.");
      return;
    }
    setImporting(true);
    setImportResult(null);
    setParseError(null);
    try {
      const res = await fetch(`${backendUrl}/commands/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          provider,
          commands: parsed,
        }),
      });
      if (!res.ok) {
        throw new Error("Import failed");
      }
      const data = await res.json().catch(() => ({} as any));
      const count = (data && typeof data.imported === "number") ? data.imported : parsed.length;
      setImportResult(`Imported ${count} command${count === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      setParseError("Could not import commands. Please try again.");
    } finally {
      setImporting(false);
    }
  };

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
          <a href={primaryHref} className="hidden">
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
                  Choose your existing bot, paste a list of custom commands (one per line), then parse and import
                  them as AxyraBot custom commands.
                </p>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Source bot
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as Provider)}
                      className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                    >
                      <option value="nightbot">Nightbot</option>
                      <option value="streamelements">StreamElements</option>
                      <option value="fossabot">Fossabot</option>
                      <option value="other">Other</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      This is used for audit logs only; paste commands in the format <span className="font-mono">!hello Hello chat!</span>.
                    </p>
                  </div>
                </div>

                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Paste commands
                </label>
                <textarea
                  rows={6}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                  placeholder="!hello Hello chat!\n!discord Join the server at https://..."
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleParse}
                    className="inline-flex items-center justify-center rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    Parse commands
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || parsed.length === 0 || !login}
                    className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? "Importing..." : "Import parsed commands"}
                  </button>
                </div>
                {parseError && (
                  <p className="mt-2 text-xs text-rose-400">{parseError}</p>
                )}
                {importResult && !parseError && (
                  <p className="mt-2 text-xs text-emerald-400">{importResult}</p>
                )}

                {parsed.length > 0 && (
                    {provider === "nightbot" && (
                      <button
                        type="button"
                        onClick={handleNightbotOAuth}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/70 bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-500 hover:border-emerald-400 transition"
                      >
                        <span className="text-xs">⬆</span>
                        <span>Import directly from Nightbot</span>
                      </button>
                    )}
                  <div className="mt-4 max-h-64 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/60">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-300">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Command</th>
                          <th className="px-3 py-2 font-semibold">Response (preview)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.map((cmd) => (
                          <tr key={cmd.name} className="border-t border-slate-800">
                            <td className="px-3 py-1.5 font-mono text-slate-100 whitespace-nowrap">{cmd.name}</td>
                            <td className="px-3 py-1.5 text-slate-200">
                              {cmd.response.length > 120
                                ? `${cmd.response.slice(0, 117)}...`
                                : cmd.response}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
