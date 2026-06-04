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

function DashboardCarousel({ slides }: { slides: { src: string; alt: string }[] }) {
  const [current, setCurrent] = useState(0);
  const [displayed, setDisplayed] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = (index: number) => {
    const next = (index + slides.length) % slides.length;
    if (next === current || fading) return;
    setFading(true);
    timerRef.current = setTimeout(() => {
      setDisplayed(next);
      setCurrent(next);
      setFading(false);
    }, 400);
  };

  // Auto-advance every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % slides.length;
        setFading(true);
        setTimeout(() => {
          setDisplayed(next);
          setCurrent(next);
          setFading(false);
        }, 400);
        return prev; // real update happens inside timeout
      });
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="relative group">
      <div className="absolute -inset-4 rounded-3xl bg-accent/5 blur-3xl" />
      <div className="relative rounded-2xl border border-slate-700/60 overflow-hidden shadow-2xl shadow-black/60">
        {/* Images stacked; only the displayed one is visible */}
        <div className="relative w-full">
          {/* Invisible first image keeps the container height correct */}
          <img src={slides[0].src} alt="" className="w-full h-auto block invisible" aria-hidden="true" />
          {slides.map((slide, i) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500"
              style={{ opacity: i === displayed ? (fading ? 0 : 1) : 0, pointerEvents: i === displayed ? "auto" : "none" }}
            />
          ))}
        </div>

        {/* Left arrow */}
        <button
          type="button"
          aria-label="Previous"
          onClick={() => goTo(current - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/75 transition-all duration-200 focus:outline-none"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Right arrow */}
        <button
          type="button"
          aria-label="Next"
          onClick={() => goTo(current + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/75 transition-all duration-200 focus:outline-none"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-4 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>
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
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
  const [channelCount, setChannelCount] = useState<number | null>(null);
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
    const storedGuild = window.localStorage.getItem("axyra.discord.selectedGuild");
    if (storedGuild) {
      setIsDiscordConnected(true);
    }

    fetch(`${backendUrl}/channels`)
      .then((r) => r.json())
      .then((d) => setChannelCount((d.channels ?? []).length))
      .catch(() => {});
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
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      window.localStorage.removeItem("axyra.avatar");
    }
    setIsLoggedIn(false);
    setAvatarUrl(null);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.location.href = "/";
  };

  // After Twitch auth, send users back to the homepage so we can update
  // local state and show the Dashboard buttons/avatar.
  const redirectTarget = frontendUrl ? `${frontendUrl}` : "";
  const _lastLogin = typeof window !== "undefined" ? (window.localStorage.getItem("axyra.lastLogin") ?? "") : "";
  const connectUrl = redirectTarget
    ? `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${_lastLogin ? `&hint=${encodeURIComponent(_lastLogin)}` : ""}`
    : `${backendUrl}/auth/start${_lastLogin ? `?hint=${encodeURIComponent(_lastLogin)}` : ""}`;

  const primaryHref = isLoggedIn ? "/dashboard" : connectUrl;
  const primaryLabel = isLoggedIn ? "Dashboard" : "Connect Twitch";

  return (
    <div className="min-h-screen bg-background text-slate-100">

      {/* ── NAV ── */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${isScrolled ? "bg-background/90 backdrop-blur-md border-b border-slate-800/60" : ""}`}>
        <div className="max-w-7xl mx-auto flex h-16 items-center px-6 gap-6">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 border border-accent/40">
              <Image src={AxyraBotPFP} alt="AxyraBot" width={20} height={20} className="rounded" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">AxyraBot</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-400 flex-1 justify-center">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="/dashboard" className="hover:text-white transition">Dashboard</a>
            <a href="/commands" className="hover:text-white transition">Commands</a>
            <a href="/api-docs" className="hover:text-white transition">Docs</a>
            <a href="https://discord.gg/RmtMQaVxEU" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Support</a>
          </nav>
          <div ref={menuRef} className="relative flex items-center gap-3 flex-shrink-0">
            {isLoggedIn ? (
              <>
                <a href="/dashboard" className="text-sm text-slate-300 hover:text-white transition px-4 py-2">Dashboard</a>
                {avatarUrl && (
                  <button type="button" onClick={() => setMenuOpen((o) => !o)} className="focus:outline-none">
                    <Image src={avatarUrl} alt="Profile" width={32} height={32} className="rounded-full" />
                  </button>
                )}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-slate-700 bg-slate-900/95 py-2 shadow-lg">
                    <button type="button" onClick={handleLogout} className="w-full px-4 py-2 text-sm text-left text-slate-200 hover:bg-slate-800">Log out</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <a href={connectUrl} className="text-sm text-slate-300 hover:text-white transition px-4 py-2">Log in</a>
                <a href={connectUrl} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-400/20 transition hover:bg-sky-300">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                  Connect Twitch
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_70%_40%,rgba(139,92,246,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_20%_60%,rgba(56,189,248,0.08),transparent)]" />
        <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center py-20 relative z-10">
          {/* Left */}
          <div>
            <div className="inline-block text-xs font-semibold tracking-widest text-accent/80 uppercase mb-4">
              The Complete Moderation Solution
            </div>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
              Powerful Moderation<br />
              for <span className="text-accent">Twitch</span> &amp; <span className="text-violet-400">Discord</span>
            </h1>
            <p className="text-slate-400 text-lg mb-8 max-w-lg leading-relaxed">
              Protect your community, automate moderation, and keep your chat safe 24/7 with AxyraBot
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <a href={isDiscordConnected ? "/discord" : "https://discord.com"} className="inline-flex items-center gap-2 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition">
                <img src="/DiscordLogo.png" alt="Discord" className="w-5 h-5 brightness-0 invert" />
                {isDiscordConnected ? "Discord Integration" : "Add to Discord"}
              </a>
              <a href={isLoggedIn ? "/dashboard" : connectUrl} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 px-5 py-3 text-sm font-bold text-white transition">
                <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                {isLoggedIn ? "Dashboard" : "Connect Twitch"}
              </a>
            </div>
            {/* Social proof */}
          </div>

          {/* Right: Chat UI mockups */}
          <div className="relative flex items-center justify-center lg:justify-end pb-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_60%_50%,rgba(139,92,246,0.2),transparent)]" />
            <div className="relative w-full max-w-md">
              {/* Twitch chat mockup */}
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/90 shadow-2xl shadow-black/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-950/60">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                  <span className="text-xs font-semibold text-slate-300">TWITCH CHAT</span>
                </div>
                <div className="px-4 py-3 space-y-3 text-xs">
                  {[
                    { user: "StreamElements", color: "text-sky-400",    msg: "Check out my socials! linktr.ee/xyz",              mod: false },
                    { user: "AxyraBot",        color: "text-accent",     msg: "@user, links are not allowed!",                   mod: true  },
                    { user: "BadUser123",      color: "text-red-400",    msg: "Buy followers here! bit.ly/spam",                 mod: false },
                    { user: "AxyraBot",        color: "text-accent",     msg: "@BadUser123 has been timed out for 600 seconds.", mod: true  },
                  ].map((line, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className={`shrink-0 font-semibold ${line.color}`}>{line.user}:</span>
                      <span className={line.mod ? "text-slate-300 italic" : "text-slate-400"}>{line.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Discord server mockup — overlaps bottom-right */}
              <div className="absolute -bottom-10 -right-6 w-64 rounded-xl border border-slate-700/60 bg-slate-900/95 shadow-2xl shadow-black/60 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#5865f2]/20">
                  <img src="/DiscordLogo.png" alt="Discord" className="w-5 h-5 brightness-0 invert" />
                  <span className="text-xs font-semibold text-slate-300">DISCORD SERVER</span>
                </div>
                <div className="px-4 py-3 space-y-2 text-xs">
                  {[
                    { user: "Member",   color: "text-slate-400", msg: "Just joined the server!" },
                    { user: "AxyraBot", color: "text-accent",    msg: "Welcome @Member! Please read #rules and have a great time!" },
                    { user: "AxyraBot", color: "text-accent",    msg: "@Spammer was banned." },
                  ].map((line, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className={`shrink-0 font-semibold ${line.color}`}>{line.user}:</span>
                      <span className="text-slate-400">{line.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-center gap-16">
          {[
            { icon: "👥", stat: channelCount !== null ? channelCount.toString() : "…", label: "Communities" },
            { icon: "⚡", stat: "99.9%", label: "Uptime" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className="text-2xl font-black text-white">{s.stat}</div>
                <div className="text-sm text-slate-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-3">Everything You Need</div>
            <h2 className="text-4xl font-black text-white">Powerful Features. Total Control.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "🛡️", color: "text-sky-400",     bg: "bg-sky-400/10 border-sky-400/20",       title: "Auto Moderation",     desc: "Advanced filters detect spam, scams, hate speech, and more in real-time."        },
              { icon: "🔗", color: "text-violet-400",  bg: "bg-violet-400/10 border-violet-400/20", title: "Link Protection",     desc: "Automatically block harmful links, invites, and suspicious URLs."               },
              { icon: "💬", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20",title: "Custom Commands",     desc: "Create unlimited custom commands for Twitch & Discord."                        },
              { icon: "📊", color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20",     title: "Detailed Logs",       desc: "View moderation logs and user history with advanced filters."                   },
              { icon: "🤖", color: "text-pink-400",    bg: "bg-pink-400/10 border-pink-400/20",     title: "Raid Protection",     desc: "Automatically detect and prevent raids & bot attacks."                         },
              { icon: "⚙️", color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20", title: "Highly Customizable", desc: "Fine-tune every setting to match your community's needs."                      },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900 transition">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border text-xl mb-4 ${f.bg}`}>
                  {f.icon}
                </div>
                <h3 className={`text-sm font-bold mb-2 ${f.color}`}>{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 px-6 py-2.5 text-sm font-semibold text-slate-200 transition">
              View All Features →
            </a>
          </div>
        </div>
      </section>

      {/* ── DASHBOARD SECTION ── */}
      <section className="py-24 px-6 bg-slate-950/50 border-y border-slate-800/60">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">
          {/* Carousel */}
          {(() => {
            const slides = [
              { src: "/AxyraDashboard.png",  alt: "AxyraBot Dashboard" },
              { src: "/AxyraCommands.png",   alt: "AxyraBot Commands" },
              { src: "/AxyraDiscord.png",    alt: "AxyraBot Discord" },
              { src: "/AxyraGiveaway.png",   alt: "AxyraBot Giveaway" },
              { src: "/AxyraModule.png",     alt: "AxyraBot Modules" },
            ];
            return <DashboardCarousel slides={slides} />;
          })()}
          {/* Text below */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-10">
            <div className="flex-1">
              <div className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-3">Unified Dashboard</div>
              <h2 className="text-4xl font-black text-white mb-5">Manage Everything<br />in One Place</h2>
              <p className="text-slate-400 leading-relaxed">
                Our powerful dashboard gives you complete control over your Twitch and Discord moderation.
              </p>
            </div>
            <div className="flex-1">
              <ul className="space-y-3 mb-8">
                {["Real-time activity monitoring","Manage settings in seconds","Cross-platform synchronization"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-sky-400/20 transition hover:bg-sky-300">
                Explore Dashboard →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── AUTOMATION ── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-3">Smart Automation</div>
            <h2 className="text-4xl font-black text-white mb-4">Automate. Protect. Relax.</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm">
              Create powerful automated workflows without writing a single line of code.
            </p>
          </div>
          <div className="flex flex-col lg:flex-row items-stretch gap-4">
            {[
              { trigger: "IF someone posts a scam link",   color: "border-red-500/30 bg-red-500/5",       accent: "text-red-400",    icons: ["🗑️","⏱️","🔔"], steps: ["Delete message","Timeout user for 60s","Alert moderators"]           },
              { trigger: "IF a new member joins Discord",  color: "border-accent/30 bg-accent/5",         accent: "text-accent",     icons: ["🎭","💬","📋"], steps: ["Assign welcome role","Send welcome message","Log member join"]        },
              { trigger: "IF chat becomes too fast",       color: "border-violet-500/30 bg-violet-500/5", accent: "text-violet-400", icons: ["🐌","🔔","📢"], steps: ["Enable slow mode","Notify moderators","Post announcement"]            },
            ].map((flow, idx) => (
              <div key={idx} className="flex-1 flex items-center gap-3">
                <div className={`flex-1 rounded-xl border p-5 h-full ${flow.color}`}>
                  <div className={`text-xs font-bold mb-4 ${flow.accent}`}>{flow.trigger}</div>
                  <div className="space-y-2">
                    {flow.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <span>{flow.icons[i]}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {idx < 2 && <div className="hidden lg:flex items-center justify-center text-slate-500 text-xl shrink-0">→</div>}
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/modules" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 px-6 py-2.5 text-sm font-semibold text-slate-200 transition">
              Explore Automations
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6 bg-slate-950/50 border-t border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-white text-center mb-14">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-x-16">
            <div>
              <FAQItem question="Is AxyraBot free?" answer="Yes, AxyraBot is completely free. Connect your Twitch account, authorize the bot, and you're ready to go — no credit card, no paid plans, ever." />
              <FAQItem question="Does it work on both Twitch and Discord?" answer="Yes. AxyraBot supports both platforms. You can moderate Twitch chat and your Discord server from the same unified dashboard." />
              <FAQItem question="How long does setup take?" answer="Most users are up and running in under five minutes. Just connect your Twitch account, add the bot to your Discord, and configure your settings." />
            </div>
            <div>
              <FAQItem question="Do I need coding experience?" answer="No coding required. Everything is managed through a clean point-and-click dashboard designed for streamers and community managers." />
              <FAQItem question="Is my data safe?" answer="Yes. We take security seriously. Your credentials are never stored in plain text and we only request the minimum permissions needed to operate." />
              <FAQItem question="Where can I get support?" answer="You can reach us through our Discord support server or browse the API documentation for technical details." />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA BAR ── */}
      <section className="bg-accent/10 border-y border-accent/20 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/20 border border-accent/30">
              <Image src={AxyraBotPFP} alt="AxyraBot" width={20} height={20} className="rounded" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Ready to Protect Your Community?</p>
              <p className="text-xs text-slate-400">Join 10,000+ communities already using AxyraBot.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <a href={isDiscordConnected ? "/discord" : "https://discord.com"} className="inline-flex items-center gap-2 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] px-4 py-2 text-sm font-bold text-white transition">
              <img src="/DiscordLogo.png" alt="Discord" className="w-5 h-5 brightness-0 invert" />
              {isDiscordConnected ? "Discord Integration" : "Add to Discord"}
            </a>
            <a href={isLoggedIn ? "/dashboard" : connectUrl} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-bold text-white transition">
              <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
              {isLoggedIn ? "Dashboard" : "Connect Twitch"}
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-800 bg-background px-6 py-10">
        <div className="max-w-7xl mx-auto">
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
