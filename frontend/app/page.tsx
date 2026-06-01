"use client";

import Image from "next/image";
import AxyraBotPFP from "./images/AxyraBotPFP.png";
import { useEffect, useRef, useState } from "react";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-4 text-left text-sm text-slate-200 hover:text-white transition"
      >
        <span>{question}</span>
        <span
          className={`ml-4 text-xl font-light text-accent transition-transform duration-200 ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      {open && <p className="pb-4 text-sm text-slate-400 leading-relaxed">{answer}</p>}
    </div>
  );
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
  };

  const handleScrollToDetails = () => {
    if (typeof document === "undefined") return;
    const target = document.getElementById("axyra-details");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
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
    <div className="min-h-screen bg-background text-slate-100">

      {/* ── NAV ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled ? "bg-background/80 backdrop-blur-md border-b border-slate-800/60" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto flex h-16 items-center px-6 gap-6">
          <div className="flex items-center gap-3 flex-1">
            <Image src={AxyraBotPFP} alt="AxyraBot" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-accent">Axyra</span>
              <span className="text-white">Bot</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#getstarted" className="hover:text-white transition">Get Started</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>
          <div ref={menuRef} className="relative flex items-center justify-end flex-1 gap-3">
            <a
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-400/30 transition hover:bg-sky-300"
            >
              {primaryLabel}
            </a>
            {isLoggedIn && avatarUrl && (
              <button type="button" onClick={() => setMenuOpen((o) => !o)} className="focus:outline-none">
                <Image src={avatarUrl} alt="Profile" width={34} height={34} className="rounded-full" />
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
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.13),transparent)]" />
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center relative z-10">
          {/* Left: headline + CTA */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              AxyraBot is online
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight mb-5">
              Simplify chat moderation and engage your audience on stream.
            </h1>
            <p className="text-slate-400 text-base mb-8 max-w-lg leading-relaxed">
              AxyraBot connects to your channel in seconds — custom commands, smart event reactions,
              and full moderation tools, all from a clean dashboard.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <a
                href={primaryHref}
                className="inline-flex items-center justify-center rounded-full bg-accent px-7 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-sky-400/30 transition hover:bg-sky-300"
              >
                {primaryLabel}
              </a>
              <p className="text-xs text-slate-500 self-center">Free — no credit card required.</p>
            </div>
          </div>

          {/* Right: live chat preview */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-sky-500/10 blur-2xl" />
            <div className="relative rounded-2xl border border-slate-700 bg-slate-900/90 overflow-hidden shadow-2xl shadow-black/60">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-slate-400 font-medium">Live Chat</span>
              </div>
              <div className="px-4 py-4 space-y-3 text-xs">
                {[
                  { user: "StreamFan22",  color: "text-sky-400",              msg: "Welcome to the stream!" },
                  { user: "TwitchViewer", color: "text-violet-400",           msg: "!hello" },
                  { user: "AxyraBot",     color: "text-accent font-semibold", msg: "Hey TwitchViewer! Welcome! PogChamp" },
                  { user: "ModUser",      color: "text-emerald-400",          msg: "!uptime" },
                  { user: "AxyraBot",     color: "text-accent font-semibold", msg: "The stream has been live for 1h 23m!" },
                  { user: "NewFollower",  color: "text-pink-400",             msg: "just followed! 🎉" },
                  { user: "AxyraBot",     color: "text-accent font-semibold", msg: "Thanks for the follow, NewFollower! 💜" },
                ].map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <span className={`shrink-0 ${line.color}`}>{line.user}:</span>
                    <span className="text-slate-300">{line.msg}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-500">Send a message</div>
                <div className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-slate-900">Chat</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE ROW 1: engagement (mockup left, text right) ── */}
      <section id="features" className="py-20 px-6 bg-slate-950/50 border-y border-slate-800/60">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          {/* Left: command list UI mockup */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 divide-y divide-slate-800 shadow-xl overflow-hidden">
            {[
              { cmd: "!hello",          desc: "Greet chat",                   on: true  },
              { cmd: "!uptime",         desc: "Stream duration",              on: true  },
              { cmd: "!followage",      desc: "How long you've followed",     on: true  },
              { cmd: "!game <category>",desc: "Change game (mods only)",      on: false },
              { cmd: "!title <title>",  desc: "Change stream title (mods)",   on: true  },
            ].map((row) => (
              <div key={row.cmd} className="flex items-center justify-between px-4 py-3 text-xs">
                <div>
                  <div className="font-mono text-sky-300">{row.cmd}</div>
                  <div className="text-slate-500 mt-0.5">{row.desc}</div>
                </div>
                <div
                  className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${
                    row.on ? "bg-accent/80 justify-end" : "bg-slate-700 justify-start"
                  }`}
                >
                  <div className="h-4 w-4 rounded-full bg-white shadow" />
                </div>
              </div>
            ))}
          </div>
          {/* Right: text */}
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Build engagement with your viewers</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Turn chat into community with custom commands, event reactions, chat quotes, and more.
              AxyraBot handles the repetitive stuff so you can focus on your audience.
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                "Custom chat commands with role permissions",
                "Instant responses to follows, raids, and more",
                "Birthday integrations and loyalty hooks",
                "Broadcaster & moderator controls",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FEATURE ROW 2: always online (graphic left, text right) ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div className="flex items-center justify-center">
            <div className="relative flex items-center justify-center w-48 h-48">
              <div className="absolute inset-0 rounded-full bg-sky-500/10 blur-2xl" />
              <div className="relative flex flex-col items-center justify-center w-36 h-36 rounded-full border-2 border-accent/40 bg-slate-900/80 shadow-xl">
                <span className="text-4xl">☁️</span>
                <span className="mt-2 text-xs font-semibold text-accent">24 / 7</span>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Cloud-based and 24/7</h2>
            <p className="text-slate-400 mb-4 leading-relaxed">
              AxyraBot never logs off. It runs completely in the cloud, meaning you don&apos;t have
              to keep a tab open or install any software. Your CPU stays free for gaming and
              streaming.
            </p>
            <p className="text-slate-500 text-sm">
              Powered by Render — always available, even when you&apos;re offline.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE ROW 3: moderation (text left, graphic right) ── */}
      <section className="py-20 px-6 bg-slate-950/50 border-y border-slate-800/60">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Moderate chat to protect your channel</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Keep your community safe with filter options including caps, links, spam, blocked terms,
              and more. Set it up once and let AxyraBot handle the rest.
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                "Blocked terms & phrase filters",
                "Spam and caps detection",
                "AutoMod integration",
                "Per-role permission levels",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 h-4 w-4 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative text-center">
              <div className="absolute -inset-6 rounded-full bg-red-500/5 blur-3xl" />
              <div className="relative text-7xl font-black tracking-tighter leading-none select-none">
                <span className="text-red-400">#</span>
                <span className="text-slate-500">!</span>
                <span className="text-accent">&amp;</span>
                <span className="text-violet-400">%</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">blocked by AxyraBot</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE ROW 4: dashboard (mockup left, text right) ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/40 overflow-hidden">
            <div className="absolute inset-x-8 -top-10 h-20 rounded-full bg-sky-500/15 blur-2xl" />
            <div className="relative space-y-3 text-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300 font-medium">Dashboard</span>
              </div>
              {[
                { label: "Stream Title", value: "Chill coding stream 🎮",        accent: false },
                { label: "Category",     value: "Software & Game Development",   accent: false },
                { label: "Bot Status",   value: "Connected",                     accent: true  },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={row.accent ? "text-emerald-400 font-semibold" : "text-slate-300"}>{row.value}</span>
                </div>
              ))}
              <div className="pt-1 grid grid-cols-3 gap-2">
                {["Commands", "Moderation", "Birthdays"].map((tab) => (
                  <div key={tab} className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-center text-[11px] text-slate-500">
                    {tab}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">Your bot, your dashboard</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              Manage stream titles, categories, custom commands, moderation settings, and more — all
              from a clean web dashboard. No need to type anything in chat during your stream.
            </p>
            <a
              href={primaryHref}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-sky-300 transition"
            >
              Explore the dashboard →
            </a>
          </div>
        </div>
      </section>

      {/* ── EXPLORE BANNER ── */}
      <section className="px-6 py-4">
        <div className="max-w-6xl mx-auto rounded-2xl border border-accent/30 bg-gradient-to-r from-sky-500/10 to-slate-900/60 px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Explore more features</h3>
            <p className="text-sm text-slate-400 mt-1">Discover Discord integration, birthday alerts, roles, modules, and more.</p>
          </div>
          <a
            href="/dashboard"
            className="shrink-0 inline-flex items-center justify-center rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-sky-400/30 transition hover:bg-sky-300"
          >
            Explore features
          </a>
        </div>
      </section>

      {/* ── GET STARTED GRID ── */}
      <section id="getstarted" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Get started with AxyraBot</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm">
              A few things you can do right away after connecting your channel.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "💬",
                title: "How to add custom commands",
                desc: "Create triggers that respond instantly in chat. Set permission levels so only mods or the broadcaster can use certain commands.",
              },
              {
                icon: "🛡️",
                title: "Setting up moderation",
                desc: "Configure blocked terms, spam filters, and AutoMod so your chat stays clean without constant manual action.",
              },
              {
                icon: "🎂",
                title: "Enabling birthday alerts",
                desc: "Let viewers register their birthdays and have AxyraBot celebrate them automatically in chat.",
              },
              {
                icon: "💜",
                title: "Discord integration",
                desc: "Connect your Discord server to get Twitch event notifications and role sync for subscribers and VIPs.",
              },
              {
                icon: "🎭",
                title: "Managing roles & editors",
                desc: "Grant editor access to trusted mods so they can manage bot settings without needing full account access.",
              },
              {
                icon: "⚙️",
                title: "Modules & settings",
                desc: "Toggle optional features on or off to keep your setup lean. Only enable what you actually need.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-slate-700 hover:bg-slate-900 transition"
              >
                <div className="mb-3 flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-2xl">
                  {card.icon}
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-2">{card.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-6 bg-slate-950/50 border-t border-slate-800/60">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently asked questions</h2>
          <FAQItem
            question="Is AxyraBot free?"
            answer="Yes, AxyraBot is completely free to use. Connect your Twitch account, authorize the bot, and you're ready to go — no credit card required."
          />
          <FAQItem
            question="What platforms does AxyraBot support?"
            answer="AxyraBot is currently built for Twitch. Discord integration is supported for notifications and role syncing on your server."
          />
          <FAQItem
            question="Do I need to keep a tab open to keep AxyraBot running?"
            answer="No. AxyraBot runs in the cloud 24/7, so it stays connected to your channel even when you close the browser or turn off your PC."
          />
          <FAQItem
            question="Where can I learn more about how to use AxyraBot?"
            answer="Check out the API Documentation page or connect your account and explore the dashboard — everything is labelled and easy to navigate."
          />
          <FAQItem
            question="Can I give a mod control over bot settings?"
            answer="Yes. You can grant editor access to any Twitch user from the Roles page, letting them manage commands and settings on your behalf."
          />
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="relative overflow-hidden px-6 py-28 bg-background border-t border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_100%,rgba(56,189,248,0.08),transparent)]" />
        <div className="relative max-w-xl mx-auto text-center">
          <p className="text-4xl sm:text-5xl font-black text-white mb-8 leading-tight">— go live in minutes!</p>
          <a
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-3.5 text-base font-bold text-slate-900 shadow-xl shadow-sky-400/30 transition hover:bg-sky-300"
          >
            {primaryLabel}
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 bg-background px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-8">
            <div className="flex items-center gap-3">
              <Image src={AxyraBotPFP} alt="AxyraBot" width={32} height={32} className="rounded-xl" />
              <span className="font-bold tracking-tight">
                <span className="text-accent">Axyra</span>
                <span className="text-white">Bot</span>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
              <div>
                <div className="font-semibold text-slate-200 mb-2">Product</div>
                <div className="flex flex-col gap-1.5 text-slate-400">
                  <a href="/dashboard" className="hover:text-white transition">Dashboard</a>
                  <a href="/commands" className="hover:text-white transition">Commands</a>
                  <a href="/moderation" className="hover:text-white transition">Moderation</a>
                  <a href="/modules" className="hover:text-white transition">Modules</a>
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-200 mb-2">Support</div>
                <div className="flex flex-col gap-1.5 text-slate-400">
                  <a href="#" className="hover:text-white transition">Discord (coming soon)</a>
                  <a href="/api-docs" className="hover:text-white transition">API Documentation</a>
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-200 mb-2">Legal</div>
                <div className="flex flex-col gap-1.5 text-slate-400">
                  <a href="/terms" className="hover:text-white transition">Terms of Service</a>
                  <a href="/privacy" className="hover:text-white transition">Privacy Policy</a>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-6 border-t border-slate-800 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} AxyraBot. All rights reserved.</p>
            <p>Not affiliated with Twitch Interactive, Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
