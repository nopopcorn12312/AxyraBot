"use client";

import Image from "next/image";
import AxyraBotPFP from "./images/AxyraBotPFP.png";
import { useEffect, useState } from "react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
  const redirectTarget = frontendUrl ? `${frontendUrl}/dashboard` : "";
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
        <div className="flex items-center justify-end flex-1 gap-3">
          <a
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-400/40 transition hover:bg-sky-500"
          >
            {primaryLabel}
          </a>
          {isLoggedIn && avatarUrl && (
            <Image
              src={avatarUrl}
              alt="Twitch profile picture"
              width={36}
              height={36}
              className="rounded-full border border-slate-700"
            />
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
    </main>
  );
}
