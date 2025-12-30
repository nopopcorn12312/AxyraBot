"use client";

import { useSearchParams } from "next/navigation";

export default function ConnectedPage() {
  const searchParams = useSearchParams();
  const login = searchParams.get("login");

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-glow backdrop-blur-md">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50">
          Twitch connected
        </h1>
        <p className="mt-4 text-sm text-slate-300">
          {login
            ? `AxyraBot is now configured to join ${login}'s channel when the bot is running.`
            : "Your Twitch account has been connected. AxyraBot will join your channel when the bot is running."}
        </p>
        <p className="mt-6 text-xs text-slate-400">
          You can close this tab and return to your stream.
        </p>
      </div>
    </main>
  );
}
