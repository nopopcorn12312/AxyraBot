"use client";

import Image from "next/image";
import AxyraBotPFP from "./images/AxyraBotPFP.png";
import { useEffect, useRef, useState } from "react";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/6 bg-slate-950/55 px-5 transition hover:border-white/10 hover:bg-slate-950/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-4 text-left text-sm text-slate-100 transition hover:text-white"
      >
        <span className="pr-4 font-medium tracking-[0.01em]">{question}</span>
        <span
          className={`ml-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-slate-900/80 text-xl font-light text-slate-300 transition-all duration-200 ${open ? "rotate-45 border-slate-500/40 bg-slate-800/90" : ""}`}
        >
          +
        </span>
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-slate-400">{answer}</p>}
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
      <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(51,65,85,0.24),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(30,41,59,0.24),transparent_45%)] blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-slate-950/82 shadow-[0_24px_70px_rgba(2,8,23,0.82)]">
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
          className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-slate-950/90 text-white opacity-0 transition-all duration-200 hover:bg-slate-900 group-hover:opacity-100 focus:outline-none"
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
          className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-slate-950/90 text-white opacity-0 transition-all duration-200 hover:bg-slate-900 group-hover:opacity-100 focus:outline-none"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/8 bg-slate-950/90 px-2 py-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "h-1.5 w-5 bg-slate-300"
                  : "h-1.5 w-1.5 bg-white/40 hover:bg-white/70"
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
    <div className="min-h-screen overflow-x-hidden bg-background text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.18),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(15,23,42,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(51,65,85,0.12),transparent_34%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:56px_56px]" />

      {/* ── NAV ── */}
      <header className={`fixed left-0 right-0 top-0 z-40 transition-all duration-300 ${isScrolled ? "border-b border-white/8 bg-slate-950/88 backdrop-blur-md" : "bg-transparent"}`}>
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-6">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <Image src={AxyraBotPFP} alt="AxyraBot" width={20} height={20} className="rounded" />
            </div>
            <span className="text-base font-semibold tracking-[0.02em] text-white">AxyraBot</span>
          </div>
          <nav className="hidden flex-1 items-center justify-center gap-3 md:flex">
            {[
              { href: "#features", label: "Features" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/commands", label: "Commands" },
              { href: "/api-docs", label: "Docs" },
              { href: "https://discord.gg/p4RbzDvnjA", label: "Support", external: true },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="rounded-full border border-transparent px-4 py-2 text-sm text-slate-400 transition hover:border-white/8 hover:bg-white/[0.03] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div ref={menuRef} className="relative flex items-center gap-3 flex-shrink-0">
            {isLoggedIn ? (
              <>
                <a href="/dashboard" className="rounded-full border border-white/8 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800/85 hover:text-white">Dashboard</a>
                {avatarUrl && (
                  <button type="button" onClick={() => setMenuOpen((o) => !o)} className="focus:outline-none">
                    <Image src={avatarUrl} alt="Profile" width={36} height={36} className="rounded-full ring-2 ring-white/10" />
                  </button>
                )}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-40 rounded-2xl border border-white/8 bg-slate-950/95 py-2 shadow-2xl shadow-black/60">
                    <button type="button" onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]">Log out</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <a href={connectUrl} className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.03] hover:text-white">Log in</a>
                <a href={connectUrl} className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                  Connect Twitch
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_75%_35%,rgba(51,65,85,0.18),transparent),radial-gradient(ellipse_55%_45%_at_15%_65%,rgba(30,41,59,0.12),transparent)]" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
          {/* Left */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-slate-950/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              The Complete Moderation Solution
            </div>
            <h1 className="mb-6 text-5xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl">
              Powerful Moderation<br />
              for <span className="text-slate-200">Twitch</span> &amp; <span className="text-slate-300">Discord</span>
            </h1>
            <p className="mb-8 max-w-xl text-lg leading-relaxed text-slate-400">
              Protect your community, automate moderation, and keep your chat safe 24/7 with AxyraBot
            </p>
            <div className="mb-12 flex flex-wrap gap-3">
              <a href={isDiscordConnected ? "/discord" : "https://discord.gg/p4RbzDvnjA"} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-slate-900/75 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800/90">
                <img src="/DiscordLogo.png" alt="Discord" className="w-5 h-5 brightness-0 invert" />
                {isDiscordConnected ? "Discord Integration" : "Add to Discord"}
              </a>
              <a href={isLoggedIn ? "/dashboard" : connectUrl} className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                {isLoggedIn ? "Dashboard" : "Connect Twitch"}
              </a>
            </div>
            <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Real-time protection", value: "24/7" },
                { label: "Communities onboarded", value: channelCount !== null ? `${channelCount}+` : "…" },
                { label: "Cross-platform control", value: "Twitch + Discord" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/8 bg-slate-950/60 px-4 py-4">
                  <div className="text-lg font-semibold tracking-tight text-white">{item.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Chat UI mockups */}
          <div className="relative flex items-center justify-center pb-12 lg:justify-end">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_60%_50%,rgba(30,41,59,0.24),transparent)]" />
            <div className="relative w-full max-w-md">
              {/* Twitch chat mockup */}
              <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-slate-950/88 shadow-[0_30px_72px_rgba(2,8,23,0.82)]">
                <div className="flex items-center justify-between border-b border-white/8 bg-slate-900/85 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                    <span className="text-xs font-semibold tracking-[0.2em] text-slate-300">TWITCH CHAT</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live moderation</span>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4 text-xs">
                  {[
                    { user: "StreamElements", color: "text-sky-400",    msg: "Check out my socials! linktr.ee/xyz",              mod: false },
                    { user: "AxyraBot",        color: "text-accent",     msg: "@user, links are not allowed!",                   mod: true  },
                    { user: "BadUser123",      color: "text-red-400",    msg: "Buy followers here! bit.ly/spam",                 mod: false },
                    { user: "AxyraBot",        color: "text-accent",     msg: "@BadUser123 has been timed out for 600 seconds.", mod: true  },
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-white/6 bg-slate-900/80 px-3 py-2.5">
                      <span className={`shrink-0 font-semibold ${line.color}`}>{line.user}:</span>
                      <span className={line.mod ? "text-slate-300 italic" : "text-slate-400"}>{line.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Discord server mockup — overlaps bottom-right */}
              <div className="absolute -bottom-10 -right-6 w-64 overflow-hidden rounded-[1.4rem] border border-white/8 bg-slate-950/92 shadow-[0_24px_60px_rgba(2,8,23,0.8)]">
                <div className="flex items-center gap-2 border-b border-white/8 bg-slate-900/85 px-4 py-3">
                  <img src="/DiscordLogo.png" alt="Discord" className="w-5 h-5 brightness-0 invert" />
                  <span className="text-xs font-semibold tracking-[0.2em] text-slate-300">DISCORD SERVER</span>
                </div>
                <div className="space-y-2 px-4 py-4 text-xs">
                  {[
                    { user: "Member",   color: "text-slate-400", msg: "Just joined the server!" },
                    { user: "AxyraBot", color: "text-accent",    msg: "Welcome @Member! Please read #rules and have a great time!" },
                    { user: "AxyraBot", color: "text-accent",    msg: "@Spammer was banned." },
                  ].map((line, i) => (
                    <div key={i} className="flex items-start gap-1.5 rounded-xl border border-white/6 bg-slate-900/78 px-3 py-2">
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
      <section className="border-y border-white/8 bg-white/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl justify-center gap-16 px-6 py-8">
          {[
            { icon: "👥", stat: channelCount !== null ? channelCount.toString() : "…", label: "Communities" },
            { icon: "⚡", stat: "99.9%", label: "Uptime" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-slate-950/35 px-5 py-3">
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
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Everything You Need</div>
            <h2 className="text-4xl font-black tracking-[-0.03em] text-white">Powerful Features. Total Control.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🛡️", color: "text-sky-400",     bg: "bg-sky-400/10 border-sky-400/20",       title: "Auto Moderation",     desc: "Advanced filters detect spam, scams, hate speech, and more in real-time."        },
              { icon: "🔗", color: "text-violet-400",  bg: "bg-violet-400/10 border-violet-400/20", title: "Link Protection",     desc: "Automatically block harmful links, invites, and suspicious URLs."               },
              { icon: "💬", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20",title: "Custom Commands",     desc: "Create unlimited custom commands for Twitch & Discord."                        },
              { icon: "📊", color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20",     title: "Detailed Logs",       desc: "View moderation logs and user history with advanced filters."                   },
              { icon: "🤖", color: "text-pink-400",    bg: "bg-pink-400/10 border-pink-400/20",     title: "Raid Protection",     desc: "Automatically detect and prevent raids & bot attacks."                         },
              { icon: "⚙️", color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20", title: "Highly Customizable", desc: "Fine-tune every setting to match your community's needs."                      },
            ].map((f) => (
              <div key={f.title} className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.05]">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-xl ${f.bg}`}>
                  {f.icon}
                </div>
                <h3 className={`mb-2 text-sm font-bold ${f.color}`}>{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]">
              View All Features →
            </a>
          </div>
        </div>
      </section>

      {/* ── DASHBOARD SECTION ── */}
      <section className="border-y border-white/8 bg-white/[0.025] px-6 py-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
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
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Unified Dashboard</div>
              <h2 className="mb-5 text-4xl font-black tracking-[-0.03em] text-white">Manage Everything<br />in One Place</h2>
              <p className="text-slate-400 leading-relaxed">
                Our powerful dashboard gives you complete control over your Twitch and Discord moderation.
              </p>
            </div>
            <div className="flex-1">
              <ul className="space-y-3 mb-8">
                {["Real-time activity monitoring","Manage settings in seconds","Cross-platform synchronization"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[10px] text-cyan-200">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/90 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.18)] transition hover:bg-cyan-200">
                Explore Dashboard →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── AUTOMATION ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Smart Automation</div>
            <h2 className="mb-4 text-4xl font-black tracking-[-0.03em] text-white">Automate. Protect. Relax.</h2>
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
                <div className={`flex-1 rounded-[1.4rem] border p-5 h-full backdrop-blur-sm ${flow.color}`}>
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
          <div className="mt-10 text-center">
            <a href="/modules" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]">
              Explore Automations
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-white/8 bg-white/[0.025] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-14 text-center text-4xl font-black tracking-[-0.03em] text-white">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-x-16">
            <div className="space-y-4">
              <FAQItem question="Is AxyraBot free?" answer="Yes, AxyraBot is completely free. Connect your Twitch account, authorize the bot, and you're ready to go — no credit card, no paid plans, ever." />
              <FAQItem question="Does it work on both Twitch and Discord?" answer="Yes. AxyraBot supports both platforms. You can moderate Twitch chat and your Discord server from the same unified dashboard." />
              <FAQItem question="How long does setup take?" answer="Most users are up and running in under five minutes. Just connect your Twitch account, add the bot to your Discord, and configure your settings." />
            </div>
            <div className="space-y-4">
              <FAQItem question="Do I need coding experience?" answer="No coding required. Everything is managed through a clean point-and-click dashboard designed for streamers and community managers." />
              <FAQItem question="Is my data safe?" answer="Yes. We take security seriously. Your credentials are never stored in plain text and we only request the minimum permissions needed to operate." />
              <FAQItem question="Where can I get support?" answer="You can reach us through our Discord support server or browse the API documentation for technical details." />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA BAR ── */}
      <section className="border-y border-cyan-300/15 bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02),rgba(34,211,238,0.08))] px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-white/[0.05]">
              <Image src={AxyraBotPFP} alt="AxyraBot" width={20} height={20} className="rounded" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Ready to Protect Your Community?</p>
              <p className="text-xs text-slate-400">Join 10,000+ communities already using AxyraBot.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <a href={isDiscordConnected ? "/discord" : "https://discord.gg/p4RbzDvnjA"} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
              <img src="/DiscordLogo.png" alt="Discord" className="w-5 h-5 brightness-0 invert" />
              {isDiscordConnected ? "Discord Integration" : "Add to Discord"}
            </a>
            <a href={isLoggedIn ? "/dashboard" : connectUrl} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
              {isLoggedIn ? "Dashboard" : "Connect Twitch"}
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/8 bg-background px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <Image src={AxyraBotPFP} alt="AxyraBot" width={36} height={36} className="rounded-2xl ring-1 ring-white/10" />
              <span className="font-bold tracking-tight">
                <span className="text-cyan-300">Axyra</span>
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
                  <a href="https://discord.gg/p4RbzDvnjA" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Discord</a>
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
