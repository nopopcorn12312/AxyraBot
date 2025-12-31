"use client";

import Image from "next/image";
import AxyraBotPFP from "../images/AxyraBotPFP.png";
import { useEffect, useRef, useState } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function DashboardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("axyra.login");
    if (stored === "1") {
      setIsLoggedIn(true);
    }
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

  const redirectTarget = frontendUrl ? `${frontendUrl}` : "";
  const connectUrl = redirectTarget
    ? `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`
    : `${backendUrl}/auth/start`;

  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  return (
    <main className="min-h-screen flex flex-col px-4 bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <header className="w-full max-w-6xl mx-auto mt-6 flex items-center px-6">
        <div className="flex items-center gap-4 flex-1">
          <Image
            src={AxyraBotPFP}
            alt="AxyraBot profile picture"
            width={44}
            height={44}
            className="rounded-2xl"
          />
          <div className="text-2xl font-semibold tracking-tight">
            <span className="text-accent">Axyra</span>
            <span className="text-white">Bot</span>
          </div>
        </div>
        <nav className="flex items-center justify-center gap-8 text-base text-slate-300">
          <button className="transition hover:text-white">Features</button>
          <button className="transition hover:text-white">Support</button>
        </nav>
        <div ref={menuRef} className="relative flex items-center justify-end flex-1 gap-3">
          <a
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 transition hover:bg-sky-500"
          >
            {primaryLabel}
          </a>
          {isLoggedIn && avatarUrl && (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="relative flex items-center focus:outline-none"
            >
              <Image
                src={avatarUrl}
                alt="Twitch profile picture"
                width={36}
                height={36}
                className="rounded-full border border-slate-700"
              />
            </button>
          )}
          {isLoggedIn && menuOpen && (
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
      </header>

      <div className="flex-1 flex w-full mt-8 gap-6">
        <div
          className={`${sidebarOpen ? "w-60" : "w-16"} flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-3 transition-all duration-200`}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="mb-4 flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            <span className="text-lg">☰</span>
            {sidebarOpen && <span>Collapse</span>}
          </button>
          <nav className="flex flex-col gap-2 text-sm text-slate-300">
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800 text-left">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {sidebarOpen && <span>Overview</span>}
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800 text-left">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {sidebarOpen && <span>Commands</span>}
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800 text-left">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              {sidebarOpen && <span>Settings</span>}
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-800 text-left">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              {sidebarOpen && <span>Integrations</span>}
            </button>
          </nav>
        </div>
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-50">
          <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Your AxyraBot dashboard will live here. Sidebar items are placeholders
            for future sections like commands, settings, and integrations.
          </p>
        </div>
      </div>
    </main>
  );
}
