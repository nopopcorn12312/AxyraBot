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
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
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

  // After Twitch auth, send users back to the homepage so we can update
  // local state and show the Dashboard buttons/avatar.
  const redirectTarget = frontendUrl ? `${frontendUrl}` : "";
  const connectUrl = redirectTarget
    ? `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}`
    : `${backendUrl}/auth/start`;

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
            <a href="#faq" className="hover:text-white transition">Docs</a>
            <a href="#faq" className="hover:text-white transition">Support</a>
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
              Protect your community, automate moderation, and keep your chat safe 24/7 with AxyraBot.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <a href={isDiscordConnected ? "/discord" : "https://discord.com"} className="inline-flex items-center gap-2 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.113 18.1.132 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
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
                  <svg className="w-4 h-4 text-[#5865f2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.113 18.1.132 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
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
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 gap-8">
          {[
            { icon: "👥", stat: "10,000+", label: "Communities" },
            { icon: "⚡", stat: "99.9%",   label: "Uptime"      },
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
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: dashboard UI mockup */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-accent/5 blur-3xl" />
            <div className="relative rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden shadow-2xl shadow-black/60">
              <div className="bg-slate-950/80 px-4 py-3 flex items-center gap-3 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Image src={AxyraBotPFP} alt="AxyraBot" width={14} height={14} className="rounded" />
                  AxyraBot Dashboard
                </div>
              </div>
              <div className="flex text-xs">
                {/* Sidebar */}
                <div className="w-28 shrink-0 border-r border-slate-800 bg-slate-950/60 p-3 space-y-1">
                  {["Overview","Moderation","Commands","Automations","Logs","Analytics","Servers","Settings"].map((item, i) => (
                    <div key={item} className={`px-2 py-1.5 rounded text-[11px] ${i === 0 ? "bg-accent/20 text-accent font-semibold" : "text-slate-500"}`}>{item}</div>
                  ))}
                </div>
                {/* Main */}
                <div className="flex-1 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Messages Blocked", val: "128,456", change: "+5.1%", up: true  },
                      { label: "Users Timed Out",  val: "2,345",   change: "+4.1%", up: true  },
                      { label: "Bans Issued",      val: "567",     change: "+2.2%", up: false },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <div className="text-[10px] text-slate-500 mb-1">{s.label}</div>
                        <div className="text-sm font-black text-white">{s.val}</div>
                        <div className={`text-[10px] ${s.up ? "text-emerald-400" : "text-red-400"}`}>{s.change}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[11px] font-semibold text-slate-300 mb-2">Recent Events</div>
                      <div className="space-y-1.5">
                        {["User123 timed out · Spam links","BadUser banned · Hate speech","SomeUser timed out · Suspicious URLs","Bot detected · Blocked 43 msgs"].map((e) => (
                          <div key={e} className="text-[10px] text-slate-500 truncate">{e}</div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                      <div className="text-[11px] font-semibold text-slate-300 mb-2">Messages Over Time</div>
                      <div className="h-16 flex items-end gap-0.5">
                        {[30,45,35,60,40,70,55,80,65,90,75,95].map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm bg-accent/40" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Right: text */}
          <div>
            <div className="text-xs font-semibold tracking-widest text-accent/70 uppercase mb-3">Unified Dashboard</div>
            <h2 className="text-4xl font-black text-white mb-5">Manage Everything<br />in One Place</h2>
            <p className="text-slate-400 mb-7 leading-relaxed">
              Our powerful dashboard gives you complete control over your Twitch and Discord moderation.
            </p>
            <ul className="space-y-3 mb-8">
              {["Real-time activity monitoring","Manage settings in seconds","Advanced analytics & insights","Cross-platform synchronization"].map((item) => (
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
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.113 18.1.132 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
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
