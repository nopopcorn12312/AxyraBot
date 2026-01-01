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
          <Image
            src={AxyraBotPFP}
            alt="AxyraBot logo"
            width={32}
            height={32}
            className="rounded-full border border-slate-700 shadow-sm shadow-sky-500/40"
          />
          <div className="text-2xl font-semibold tracking-tight">
            <span className="text-accent">Axyra</span>
            <span className="text-white">Bot</span>
          </div>
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
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-1.5 py-1 hover:bg-slate-800 transition"
              >
                {avatarUrl && (
                  <Image
                    src={avatarUrl}
                    alt="Twitch profile picture"
                    width={32}
                    height={32}
                    className="rounded-full border border-slate-700"
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
          <nav className="mt-1 flex flex-col gap-2 text-sm text-slate-200">
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/"
                  ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]"
                  : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">🏠</span>
              {sidebarOpen && <span>Home</span>}
            </Link>

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
                    pathname === "/commands" ? "bg-slate-800/80 text-slate-50" : "hover:bg-slate-800/60"
                  }`}
                >
                  Default commands
                </Link>
                <Link
                  href="/commands?view=custom"
                  className={`rounded-lg px-3 py-1.5 transition ${
                    pathname === "/commands" ? "bg-slate-800/80 text-slate-50" : "hover:bg-slate-800/60"
                  }`}
                >
                  Custom commands
                </Link>
              </div>
            )}

            <Link
              href="/modules"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/modules" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">🧩</span>
              {sidebarOpen && <span>Modules</span>}
            </Link>

            <Link
              href="/privacy"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/privacy" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">🔒</span>
              {sidebarOpen && <span>Privacy</span>}
            </Link>

            <Link
              href="/terms"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/terms" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">📜</span>
              {sidebarOpen && <span>Terms</span>}
            </Link>

            <Link
              href="/api-docs"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition ${
                pathname === "/api-docs" ? "bg-accent text-white shadow-[0_0_18px_rgba(129,140,248,0.6)]" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span className="text-lg">📘</span>
              {sidebarOpen && <span>API Docs</span>}
            </Link>
          </nav>
        </div>

        <div className="flex-1 flex flex-col gap-6 text-slate-50">
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h1 className="text-2xl font-semibold mb-3">API Documentation</h1>
            <p className="text-sm text-slate-300">
              Your API documentation will appear here. Once you have the
              finalized docs, they can replace this placeholder.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
