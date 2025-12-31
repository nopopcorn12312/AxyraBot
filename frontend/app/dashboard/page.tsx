"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AxyraBotPFP from "../images/AxyraBotPFP.png";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function DashboardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [login, setLogin] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamCategory, setStreamCategory] = useState("");
  const [loadingStream, setLoadingStream] = useState(false);
  const [savingStream, setSavingStream] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLogin = window.localStorage.getItem("axyra.login");
    const storedAvatar = window.localStorage.getItem("axyra.avatar");
    if (storedLogin) {
      setIsLoggedIn(true);
      setLogin(storedLogin);
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
    setLoadingStream(true);
    setStatusMessage(null);
    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/stream/info?login=${encodeURIComponent(
        login
      )}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load stream info");
        }
        return res.json();
      })
      .then((data) => {
        setStreamTitle(data.title || "");
        setStreamCategory(data.category || "");
      })
      .catch((err) => {
        console.error(err);
        setStatusMessage("Could not load stream info.");
      })
      .finally(() => setLoadingStream(false));
  }, [login]);

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

  const handleJoinChannel = async () => {
    if (!login) return;
    setStatusMessage(null);
    try {
      const res = await fetch(`${backendUrl}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      if (!res.ok) {
        throw new Error("Join failed");
      }
      setStatusMessage("Channel joined successfully.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Could not join channel.");
    }
  };

  const handleConfirmChanges = async () => {
    if (!login) return;
    setSavingStream(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${backendUrl}/stream/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          title: streamTitle,
          category: streamCategory,
        }),
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Update failed");
      }
      setStatusMessage("Stream updated.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Could not update stream.");
    } finally {
      setSavingStream(false);
    }
  };

  const redirectTarget = frontendUrl || "http://localhost:3000";
  const connectUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent(
    redirectTarget,
  )}`;
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
            className="hidden" // header CTA hidden on dashboard, but href kept for consistency
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
          <nav className="mt-1 flex flex-col gap-2 text-sm text-slate-300">
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
        <div className="flex-1 flex flex-col lg:flex-row gap-6 text-slate-50">
          <div className="flex-1 lg:basis-2/3 h-64 rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
            <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
            <p className="text-sm text-slate-400">
              This area will show your channel overview, stats, and recent
              activity. Use it to get a quick snapshot of how AxyraBot is
              interacting with your stream.
            </p>
          </div>
          <div className="w-full lg:basis-1/3 h-64 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-4">Stream Details</h2>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Stream Title
              </label>
              <input
                type="text"
                className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                placeholder="Current stream title"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                disabled={!login || loadingStream}
              />
              <label className="block text-sm font-semibold text-slate-300 mb-2 mt-1">
                Stream Category
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/70"
                placeholder="Current stream category"
                value={streamCategory}
                onChange={(e) => setStreamCategory(e.target.value)}
                disabled={!login || loadingStream}
              />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={handleJoinChannel}
                  disabled={!login}
                  className="flex-1 inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/40 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Join channel
                </button>
                <button
                  onClick={handleConfirmChanges}
                  disabled={!login || savingStream}
                  className="flex-1 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-md shadow-sky-500/40 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {savingStream ? "Saving..." : "Confirm Changes"}
                </button>
              </div>
              {statusMessage && (
                <div className="text-xs text-slate-300">{statusMessage}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
