const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function HomePage() {
  const redirectTarget = frontendUrl ? `${frontendUrl}/dashboard` : "";
  const connectUrl = redirectTarget
    ? `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`
    : `${backendUrl}/auth/start`;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <div className="max-w-3xl w-full flex flex-col items-center text-center space-y-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-1 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>AxyraBot is live in your chat</span>
        </div>

        <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-glow backdrop-blur-md">
          <div className="absolute inset-x-12 -top-24 -z-10 h-48 rounded-full bg-purple-500/20 blur-3xl" />

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">
            Level up your Twitch chat with
            <span className="text-accent"> AxyraBot</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300">
            AxyraBot connects to your channel in seconds, responds instantly to
            custom commands like <span className="font-mono">!test</span>, and
            listens to Twitch events so your community always feels engaged.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={connectUrl}
              className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 transition hover:bg-purple-500"
            >
              Connect my Twitch
            </a>
            <p className="text-xs text-slate-400 max-w-xs">
              You&apos;ll be redirected to Twitch to authorize the bot. No passwords
              are ever stored.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1">
            Powered by Next.js &amp; Vercel
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1">
            Backend: Go + Render
          </span>
        </div>
      </div>
    </main>
  );
}
