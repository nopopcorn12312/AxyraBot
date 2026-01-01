"use client";

import Image from "next/image";
import AxyraBotPFP from "./images/AxyraBotPFP.png";
import { useEffect, useRef, useState } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // If we just came back from Twitch, capture any login/avatar params
    const params = new URLSearchParams(window.location.search);
    const loginFromQuery = params.get("login");
    const avatarFromQuery = params.get("avatar");
    if (loginFromQuery) {
      window.localStorage.setItem("axyra.login", loginFromQuery);
    }
    if (avatarFromQuery) {
      window.localStorage.setItem("axyra.avatar", avatarFromQuery);
    }

    // Strip login/avatar from the URL after first use so a refresh
    // doesn't immediately log the user back in after they log out.
    if (loginFromQuery || avatarFromQuery) {
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", newUrl);
    }

    const storedLogin = window.localStorage.getItem("axyra.login");
    if (storedLogin) {
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
  // After Twitch auth, send users back to the homepage so we can update
  // local state and show the Dashboard buttons/avatar.
  const redirectTarget = frontendUrl ? `${frontendUrl}` : "";
  const connectUrl = redirectTarget
    ? `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`
    : `${backendUrl}/auth/start`;

  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Login with Twitch";

  return (
    <main className="min-h-screen flex flex-col px-4 bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <section className="min-h-[95vh] flex flex-col">
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

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-3xl w-full flex flex-col items-center text-center space-y-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>AxyraBot is online</span>
          </div>

          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-glow backdrop-blur-md">
	            <div className="absolute inset-x-12 -top-24 -z-10 h-48 rounded-full bg-sky-500/20 blur-3xl" />

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">
              Level up your Twitch chat with
              <span className="text-accent"> AxyraBot</span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-300">
              AxyraBot connects to your channel in seconds, responds instantly to
              custom commands and listens to Twitch events so your community always feels engaged.
            </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3">
                <a
                      href={primaryHref}
                      className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 transition hover:bg-sky-500"
                    >
                    {primaryLabel}
                  </a>
              <p className="text-xs text-slate-400 max-w-xs text-center">
                You&apos;ll be redirected to Twitch to authorize the bot.
              </p>
            </div>
          </div>
        </div>
      </div>
      </section>

      {/* Scroll cue + lower sections wrapper with grey background */}
      <div className="w-full bg-slate-950/80 border-t border-slate-800">
      <section className="w-full flex justify-center pb-6 pt-4">
        <div className="flex items-center justify-center h-10 w-10 rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 shadow-sm shadow-slate-900/80">
          <span className="text-lg">▼</span>
        </div>
      </section>

      {/* Features */}
      <section className="w-full max-w-5xl mx-auto pb-12">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold tracking-wide text-slate-200">Features</h2>
          <p className="mt-1 text-xs text-slate-400">Preview of what AxyraBot can do for your channel.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm shadow-slate-900/80">
            <div className="mb-4 rounded-xl bg-slate-950/80 px-3 py-2 text-left">
              <div className="text-[10px] font-semibold text-slate-400">Command</div>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <span>!hello</span>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-50 mb-1">Instant commands</h3>
            <p className="text-xs text-slate-400">
              Welcome new viewers and trigger responses with simple chat commands. Perfect for quick
              interactions and callouts.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm shadow-slate-900/80">
            <div className="mb-4 rounded-xl bg-slate-950/80 px-3 py-2 text-left">
              <div className="text-[10px] font-semibold text-slate-400">Event</div>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                <span>New follower</span>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-50 mb-1">Smart reactions</h3>
            <p className="text-xs text-slate-400">
              Automatically thank followers and respond to Twitch events so your community always
              feels noticed.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm shadow-slate-900/80">
            <div className="mb-4 rounded-xl bg-slate-950/80 px-3 py-2 text-left">
              <div className="text-[10px] font-semibold text-slate-400">Dashboard</div>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-100">
                <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
                <span>Commands & stream info</span>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-50 mb-1">Clean control panel</h3>
            <p className="text-xs text-slate-400">
              Manage titles, categories, and commands from a simple web dashboard instead of typing
              everything in chat.
            </p>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="w-full max-w-5xl mx-auto pb-12">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold tracking-wide text-slate-200">
            Dashboard & Tables
          </h2>
          <p className="mt-1 text-xs text-slate-400 max-w-xl mx-auto">
            Get a quick look at commands, stream info, and connection status at a glance. Designed
            to stay readable even during a busy stream.
          </p>
        </div>
        <div className="relative rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/40 overflow-hidden">
          <div className="absolute inset-x-16 -top-24 h-40 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="relative grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] text-xs">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-medium">Joined channels</span>
                </div>
                <span className="text-[10px] text-slate-500">Preview</span>
              </div>
              <div className="h-40 rounded-lg border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950/90" />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 flex flex-col gap-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-300 mb-1">Stream details</div>
                <p className="text-[11px] text-slate-400">
                  Edit your title, category, and connection status without leaving the browser.
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 border border-emerald-500/40">
                  Real-time updates
                </span>
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-sky-300 border border-sky-500/40">
                  EventSub powered
                </span>
                <span className="rounded-full bg-violet-500/10 px-3 py-1 text-violet-300 border border-violet-500/40">
                  Simple to use
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who we are */}
      <section className="w-full max-w-4xl mx-auto pb-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-center shadow-sm shadow-slate-900/80">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Who we are</h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto">
            AxyraBot is built to make Twitch moderation and engagement feel effortless. Whether
            you&apos;re just starting your channel or managing a busy community, the goal is to keep
            commands, stream info, and EventSub reactions simple so you can focus on your content.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto pb-6 text-[11px] text-slate-400">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="h-6 w-6 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center text-xs">
              🤖
            </span>
            <span className="font-medium">AxyraBot</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-200 mb-1">Product</div>
              <div className="flex flex-col gap-0.5">
                <a href="/dashboard" className="hover:text-slate-200">Dashboard</a>
                <a href="/commands" className="hover:text-slate-200">Commands</a>
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-1">Support</div>
              <div className="flex flex-col gap-0.5">
                <a href="#" className="hover:text-slate-200">Discord (coming soon)</a>
                <a href="/api-docs" className="hover:text-slate-200">API Documentation</a>
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-1">Legal</div>
              <div className="flex flex-col gap-0.5">
                <a href="/terms" className="hover:text-slate-200">Terms of Service</a>
                <a href="/privacy" className="hover:text-slate-200">Privacy Policy</a>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-slate-500">© {new Date().getFullYear()} AxyraBot. All rights reserved.</p>
      </footer>
      </div>
    </main>
  );
}
