"use client";

import Image, { type StaticImageData } from "next/image";
import AxyraBotPFP from "./images/AxyraBotPFP.png";
import NightbotBanner from "./images/NightbotBanner.png";
import SteamelementsBanner from "./images/SteamelementsBanner.png";
import FossabotBanner from "./images/FossabotBanner.png";
// Imported (not referenced by path) so each screenshot gets a content-hashed
// URL: replacing a file can never leave browsers showing the old copy.
import ShotDashboard from "../public/AxyraDashboard.png";
import ShotCommands from "../public/AxyraCommands.png";
import ShotDiscord from "../public/AxyraDiscord.png";
import ShotSpam from "../public/AxyraSpam.png";
import ShotGiveaway from "../public/AxyraGiveaway.png";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { exchangeLoginCode, revokeSession } from "./lib/session";
import { bodyFont, displayFont, monoFont } from "./fonts";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";
const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
const supportUrl = "https://discord.gg/p4RbzDvnjA";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus";
const container = "mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-12";

function externalProps(href: string) {
  return href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

// ── Brand marks ──────────────────────────────────────────────────────────────

function TwitchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function DiscordIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <img src="/DiscordLogo.png" alt="" aria-hidden="true" className={`${className} brightness-0 invert`} />;
}

// The tally light: the brand's single accent mark, borrowed from the
// on-air light on a camera. Used for "live" state and the headline period.
function Tally({ on = true, className = "" }: { on?: boolean; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-[2px] ${on ? "bg-ax-accent shadow-[0_0_10px_rgba(56,189,248,0.7)]" : "bg-ax-muted"} ${className}`} />;
}

// ── Static content ───────────────────────────────────────────────────────────

const navLinks = [
  { href: "#console", label: "Console" },
  { href: "#dashboard", label: "Dashboard" },
  { href: "#commands", label: "Commands" },
  { href: "#platforms", label: "Twitch & Discord" },
];

type Rule = "links" | "terms" | "caps";

const rules: { id: Rule; label: string; hint: string; tag: string }[] = [
  { id: "links", label: "Link protection", hint: "Removes unapproved URLs", tag: "link" },
  { id: "terms", label: "Blocked terms", hint: "Your custom phrase list", tag: "term" },
  { id: "caps", label: "Caps filter", hint: "Stops shouting", tag: "caps" },
];

// Scripted chat for the console demo. `rule` marks which filter would catch it.
const chatScript: { user: string; color: string; text: string; rule?: Rule }[] = [
  { user: "pixelpanda", color: "#6ee7b7", text: "that clutch was unreal" },
  { user: "freesubz_99", color: "#fca5a5", text: "free subs here → bit.ly/free-subs", rule: "links" },
  { user: "mod_lena", color: "#fcd34d", text: "welcome in everyone" },
  { user: "hypetrain", color: "#ddd6fe", text: "WHY IS NOBODY TALKING ABOUT THIS PLAY", rule: "caps" },
  { user: "quietfox", color: "#bfdbfe", text: "!commands" },
  { user: "spoilerkid", color: "#fed7aa", text: "spoiler: the boss is his brother", rule: "terms" },
  { user: "nightowl", color: "#fbcfe8", text: "first time catching a stream live, hi!" },
  { user: "dealsbot", color: "#fca5a5", text: "cheap followers at follow-farm.biz", rule: "links" },
  { user: "pixelpanda", color: "#6ee7b7", text: "gg chat" },
];

const botReplies: Record<Rule, (user: string) => string> = {
  links: (u) => `@${u}, links aren't allowed here — message removed.`,
  terms: (u) => `@${u}, that phrase is blocked in this chat.`,
  caps: (u) => `@${u}, please ease up on the caps.`,
};

const showcase = [
  { id: "dashboard", label: "Dashboard", desc: "Twitch and AxyraBot activity, stream title and category, and chat stats on one screen.", src: ShotDashboard, alt: "AxyraBot dashboard showing recent activity and stream details" },
  { id: "commands", label: "Commands", desc: "Create, edit and permission custom commands without learning any syntax.", src: ShotCommands, alt: "Custom and default commands manager" },
  { id: "discord", label: "Discord", desc: "Go-live and mod alerts, birthday posts, ticket panels and role mappings for your server.", src: ShotDiscord, alt: "Discord integration settings with channel notifications and role mappings" },
  { id: "spam", label: "Spam filters", desc: "Choose what counts as spam and whether it's deleted, timed out or banned.", src: ShotSpam, alt: "Spam filter configuration" },
  { id: "giveaways", label: "Giveaways", desc: "Keyword or active-chatter entries, a subscriber multiplier and a fair winner pick.", src: ShotGiveaway, alt: "Giveaway manager with entries and winner picker" },
];

// Real command exchanges — replies match the bot's actual chat responses.
const commandExamples = [
  { who: "mod_lena", role: "Mods", input: "!title Speedrunning Elden Ring — any%", reply: "New title is set: Speedrunning Elden Ring — any%" },
  { who: "mod_lena", role: "Mods", input: "!addcom !discord Join the community: discord.gg/yourserver", reply: "mod_lena the command !discord has been added." },
  { who: "quietfox", role: "Everyone", input: "!commands", reply: "All of yourchannel's custom commands can be found here axyrabot.com/commands/yourchannel" },
];

const platformRows = [
  { area: "Moderation", twitch: "Link, caps, length and emote filters, plus your own blocked terms.", discord: "Ban, kick, timeout and warn slash commands, and a honeypot channel for spam bots." },
  { area: "Alerts", twitch: "Raid detection with automatic shout-outs.", discord: "Go-live and mod-alert channels, welcome messages and auto-roles." },
  { area: "Community", twitch: "Custom commands, giveaways and birthday shout-outs.", discord: "Ticket panels, reaction roles and giveaways." },
  { area: "Records", twitch: "An activity log of bot actions and Twitch events.", discord: "Mod logs with case numbers, notes and warnings." },
];

const importSources: { name: string; provider: string; image: StaticImageData; fit: string }[] = [
  { name: "Nightbot", provider: "nightbot", image: NightbotBanner, fit: "object-cover" },
  { name: "StreamElements", provider: "streamelements", image: SteamelementsBanner, fit: "object-contain bg-black" },
  { name: "Fossabot", provider: "fossabot", image: FossabotBanner, fit: "object-cover" },
];

const faqs = [
  { q: "Is AxyraBot free?", a: "Yes, AxyraBot is completely free. Connect your Twitch account, authorize the bot, and you're ready to go — no credit card, no paid plans, ever." },
  { q: "Does it work on both Twitch and Discord?", a: "Yes. AxyraBot supports both platforms. You can moderate Twitch chat and your Discord server from the same unified dashboard." },
  { q: "How long does setup take?", a: "Most users are up and running in under five minutes. Just connect your Twitch account, add the bot to your Discord, and configure your settings." },
  { q: "Do I need coding experience?", a: "No coding required. Everything is managed through a clean point-and-click dashboard designed for streamers and community managers." },
  { q: "Is my data safe?", a: "Yes. We take security seriously. Your credentials are never stored in plain text and we only request the minimum permissions needed to operate." },
  { q: "Where can I get support?", a: "You can reach us through our Discord support server or browse the API documentation for technical details." },
];

// ── Layout primitives ────────────────────────────────────────────────────────

// Each section opens on a full-width hairline carrying a mono index, like a
// page in a logbook. Heading sits in a left rail; content takes the rest.
// `wide` stacks the content under the heading at full width (for screenshots).
function Section({ id, index, label, title, intro, wide = false, children }: { id: string; index: string; label: string; title: ReactNode; intro?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-t border-ax-subtle">
      <div className={`${container} py-20 lg:py-28`}>
        <p className="font-code text-xs text-ax-secondary">
          <Tally className="mr-2 align-middle" /><span className="text-ax-heading">{index}</span> — {label}
        </p>
        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-x-8">
          <div className={wide ? "lg:col-span-12 lg:grid lg:grid-cols-12 lg:gap-x-8" : "lg:col-span-4"}>
            <h2 id={`${id}-title`} className={`font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.02em] text-ax-heading sm:text-[2.5rem] ${wide ? "lg:col-span-6" : ""}`}>
              {title}
            </h2>
            {intro && <div className={`mt-5 max-w-sm leading-relaxed text-ax-body ${wide ? "lg:col-span-5 lg:col-start-8 lg:mt-0 lg:self-end" : ""}`}>{intro}</div>}
          </div>
          <div className={wide ? "lg:col-span-12" : "lg:col-span-8"}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-ax-raised ${focusRing}`}
    >
      <span>
        <span className="block text-sm font-medium text-ax-heading">{label}</span>
        <span className="block text-xs text-ax-muted">{hint}</span>
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-[4px] border transition ${checked ? "border-ax-accent bg-ax-accent" : "border-ax-border bg-ax-raised"}`} aria-hidden="true">
        <span className={`absolute top-[3px] h-3 w-3 rounded-[2px] transition-all ${checked ? "left-[19px] bg-ax-btn-text" : "left-[3px] bg-ax-body"}`} />
      </span>
    </button>
  );
}

type ChatLine = { key: number; user: string; color: string; text: string; removed?: boolean; bot?: boolean };
type LogEntry = { key: number; time: string; user: string; tag: string };

function clock(seconds: number) {
  const base = 20 * 3600 + 14 * 60; // the demo stream "starts" at 20:14
  const t = base + seconds;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
}

// The mod console: scripted chat flows in, the visitor's filter switches
// decide what AxyraBot removes, and every removal lands in the mod log.
function ModConsole() {
  const reducedMotion = usePrefersReducedMotion();
  const [enabled, setEnabled] = useState<Record<Rule, boolean>>({ links: true, terms: true, caps: true });
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ seen: 0, removed: 0 });
  const indexRef = useRef(0);
  const keyRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const pushNext = () => {
    const step = indexRef.current;
    const msg = chatScript[step % chatScript.length];
    indexRef.current += 1;
    const caught = msg.rule !== undefined && enabledRef.current[msg.rule];
    const next: ChatLine[] = [{ key: keyRef.current++, user: msg.user, color: msg.color, text: msg.text, removed: caught }];
    if (caught && msg.rule) {
      next.push({ key: keyRef.current++, user: "AxyraBot", color: "#FFFFFF", text: botReplies[msg.rule](msg.user), bot: true });
      const tag = rules.find((r) => r.id === msg.rule)!.tag;
      setLog((prev) => [{ key: keyRef.current++, time: clock(step * 7), user: msg.user, tag }, ...prev].slice(0, 14));
    }
    setLines((prev) => [...prev, ...next].slice(-16));
    setStats((s) => ({ seen: s.seen + 1, removed: s.removed + (caught ? 1 : 0) }));
  };

  // Seed enough history that both the chat and the mod log start full, then keep chat flowing.
  useEffect(() => {
    for (let i = 0; i < 24; i++) pushNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = setInterval(pushNext, 1900);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, reducedMotion]);

  const live = !paused && !reducedMotion;
  const paneLabel = "font-code text-[11px] uppercase tracking-[0.08em] text-ax-muted";

  return (
    <div className="overflow-hidden rounded-md border border-ax-border bg-ax-section shadow-panel">
      {/* Console title bar */}
      <div className="flex items-center justify-between gap-4 border-b border-ax-border bg-ax-raised px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <TwitchIcon className="h-3.5 w-3.5 shrink-0 text-[#a970ff]" />
          <span className="truncate font-code text-xs text-ax-body">#yourchannel</span>
          <span className="hidden font-code text-xs text-ax-body sm:inline">· example data</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 font-code text-[11px] uppercase tracking-[0.08em] text-ax-body">
            <Tally on={live} />
            {live ? "Live" : "Paused"}
          </span>
          {reducedMotion ? (
            <button type="button" onClick={pushNext} className={`rounded-[4px] border border-ax-border px-2.5 py-1 font-code text-[11px] text-ax-body hover:border-ax-body ${focusRing}`}>
              Next message
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play chat demo" : "Pause chat demo"}
              className={`flex h-7 w-7 items-center justify-center rounded-[4px] border border-ax-border text-ax-body hover:border-ax-body hover:text-ax-heading ${focusRing}`}
            >
              {paused ? (
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" /></svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z" /></svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-[1.35fr_1fr] lg:grid-cols-[1.45fr_1fr_0.85fr]">
        {/* Chat */}
        <div className="flex h-[340px] flex-col border-b border-ax-subtle md:row-span-2 md:h-[400px] md:border-b-0 md:border-r lg:row-span-1">
          <p className={`${paneLabel} px-4 pt-3`}>Chat</p>
          <ul className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 pb-4 pt-2 text-[13.5px] leading-snug [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]" aria-label="Example chat messages">
            {lines.map((line) => (
              <li key={line.key} className={`motion-safe:animate-fade-up ${line.bot ? "border-l-2 border-ax-accent pl-3" : ""}`}>
                <span className="font-semibold" style={{ color: line.color }}>
                  {line.bot && <Image src={AxyraBotPFP} alt="" width={14} height={14} className="mr-1.5 inline align-[-2px]" />}
                  {line.user}
                </span>
                <span className="text-ax-muted">: </span>
                {line.removed ? (
                  <>
                    <span className="text-ax-muted line-through decoration-rose-400/60">{line.text}</span>
                    <span className="ml-2 font-code text-[10px] uppercase tracking-wider text-rose-300/90">removed</span>
                  </>
                ) : (
                  <span className={line.bot ? "text-ax-body" : "text-ax-body"}>{line.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Filters */}
        <div className="border-b border-ax-subtle lg:order-last lg:border-b-0 lg:border-l">
          <p className={`${paneLabel} px-4 pb-1 pt-3`}>Filters</p>
          <div className="divide-y divide-ax-subtle">
            {rules.map((r) => (
              <Switch key={r.id} label={r.label} hint={r.hint} checked={enabled[r.id]} onChange={() => setEnabled((e) => ({ ...e, [r.id]: !e[r.id] }))} />
            ))}
          </div>
          <dl className="grid grid-cols-2 border-t border-ax-subtle">
            <div className="border-r border-ax-subtle px-4 py-3">
              <dt className={paneLabel}>Seen</dt>
              <dd className="mt-1 font-code text-xl tabular-nums text-ax-heading">{stats.seen}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className={paneLabel}>Removed</dt>
              <dd className="mt-1 font-code text-xl font-bold tabular-nums text-ax-accent">{stats.removed}</dd>
            </div>
          </dl>
        </div>

        {/* Mod log */}
        {/* The log fills whatever height the row gives it; entries past the bottom are clipped. */}
        <div className="flex h-[240px] flex-col md:h-auto md:min-h-[180px]">
          <p className={`${paneLabel} px-4 pt-3`}>Mod log</p>
          {log.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ax-muted">Nothing removed yet.</p>
          ) : (
            <div className="relative flex-1">
              <ol className="absolute inset-0 overflow-hidden px-4 pb-4 pt-2 font-code text-[12px] [mask-image:linear-gradient(to_top,transparent,black_2.5rem)]" aria-label="Example mod log">
                {log.map((e) => (
                  <li key={e.key} className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-3 border-b border-ax-subtle py-2 last:border-0 motion-safe:animate-fade-up">
                    <span className="tabular-nums text-ax-muted">{e.time}</span>
                    <span className="text-ax-body">{e.tag}</span>
                    <span className="truncate text-ax-body">{e.user}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Dashboard viewer: WAI-ARIA tabs that swap real screenshots.
function DashboardViewer() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const focusTab = (index: number) => {
    const next = (index + showcase.length) % showcase.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); focusTab(active + 1); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); focusTab(active - 1); }
    if (e.key === "Home") { e.preventDefault(); focusTab(0); }
    if (e.key === "End") { e.preventDefault(); focusTab(showcase.length - 1); }
  };

  const item = showcase[active];
  const zoomRef = useRef<HTMLDialogElement | null>(null);

  return (
    <div>
      <div role="tablist" aria-label="Dashboard pages" className="flex flex-wrap border-b border-ax-subtle">
        {showcase.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${s.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
              className={`-mb-px flex items-baseline gap-2 border-b-2 px-3 py-3 text-sm transition first:pl-0 ${focusRing} ${
                selected ? "border-ax-accent text-ax-heading" : "border-transparent text-ax-secondary hover:text-ax-body"
              }`}
            >
              <span className="font-code text-[11px] text-ax-secondary" aria-hidden="true">0{i + 1}</span>
              {s.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${item.id}`} className="pt-6">
        <p className="max-w-xl text-ax-body">{item.desc}</p>
        <button
          type="button"
          onClick={() => zoomRef.current?.showModal()}
          aria-label={`View full size: ${item.alt}`}
          className={`group relative mt-6 block w-full cursor-zoom-in overflow-hidden rounded-md border border-ax-border bg-ax-section shadow-card ${focusRing}`}
        >
          <Image
            key={item.id}
            src={item.src}
            alt={item.alt}
            quality={90}
            sizes="(min-width: 1200px) 1104px, 100vw"
            className="h-auto w-full motion-safe:animate-fade-up"
          />
          <span className="absolute bottom-3 right-3 rounded-[4px] border border-ax-border bg-ax-raised/90 px-2.5 py-1 font-code text-[11px] text-ax-body opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            Click to enlarge
          </span>
        </button>
      </div>

      {/* Full-size view: the screenshot at its real resolution, scrollable on small screens. */}
      <dialog
        ref={zoomRef}
        aria-label={item.alt}
        onClick={(e) => { if (e.target === e.currentTarget) zoomRef.current?.close(); }}
        className="m-auto max-h-[95vh] max-w-[95vw] overflow-auto rounded-md border border-ax-border bg-ax-section p-0 shadow-panel backdrop:bg-black/70"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ax-border bg-ax-raised px-4 py-2.5">
          <span className="font-code text-xs text-ax-body">{item.label}</span>
          <button
            type="button"
            onClick={() => zoomRef.current?.close()}
            className={`rounded-[4px] border border-ax-border px-2.5 py-1 font-code text-[11px] text-ax-body hover:border-ax-body hover:text-ax-heading ${focusRing}`}
          >
            Close
          </button>
        </div>
        <Image src={item.src} alt="" quality={90} sizes="1920px" className="block h-auto w-[1200px] max-w-none lg:w-[min(1920px,95vw)]" />
      </dialog>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b border-ax-subtle">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className={`group flex w-full items-baseline justify-between gap-6 py-5 text-left ${focusRing}`}
        >
          <span className="text-[17px] font-medium text-ax-heading">{q}</span>
          <span className="font-code text-sm text-ax-secondary group-hover:text-ax-body" aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h3>
      <div id={id} hidden={!open}>
        <p className="max-w-2xl pb-6 leading-relaxed text-ax-body">{a}</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [lastLogin, setLastLogin] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // If we just came back from Twitch, capture any login/avatar params
    const params = new URLSearchParams(window.location.search);
    const loginFromQuery = params.get("login");
    const avatarFromQuery = params.get("avatar");
    const loginCodeFromQuery = params.get("login_code");
    if (loginFromQuery) {
      window.localStorage.setItem("axyra.login", loginFromQuery);
    }
    if (loginCodeFromQuery) {
      exchangeLoginCode(loginCodeFromQuery).then((ok) => {
        if (!ok) {
          window.localStorage.removeItem("axyra.login");
          window.localStorage.removeItem("axyra.avatar");
          setIsLoggedIn(false);
        }
      });
    }
    if (avatarFromQuery) {
      window.localStorage.setItem("axyra.avatar", avatarFromQuery);
    }

    // Strip login/avatar/login_code from the URL after first use so a refresh
    // doesn't immediately log the user back in after they log out.
    if (loginFromQuery || avatarFromQuery || loginCodeFromQuery) {
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
    setLastLogin(window.localStorage.getItem("axyra.lastLogin") ?? "");

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

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      const _prevLogin = window.localStorage.getItem("axyra.login") ?? "";
      if (_prevLogin) window.localStorage.setItem("axyra.lastLogin", _prevLogin);
      window.localStorage.removeItem("axyra.login");
      revokeSession();
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
  const connectUrl = redirectTarget
    ? `${backendUrl}/auth/start?redirect=${encodeURIComponent(redirectTarget)}${lastLogin ? `&hint=${encodeURIComponent(lastLogin)}` : ""}`
    : `${backendUrl}/auth/start${lastLogin ? `?hint=${encodeURIComponent(lastLogin)}` : ""}`;

  const twitchHref = isLoggedIn ? "/dashboard" : connectUrl;
  const twitchLabel = isLoggedIn ? "Open dashboard" : "Connect with Twitch";
  const discordHref = isDiscordConnected ? "/discord/settings" : supportUrl;
  const discordLabel = isDiscordConnected ? "Discord settings" : "Add to Discord";

  const primaryButton = `inline-flex h-11 shrink-0 items-center whitespace-nowrap justify-center gap-2 rounded-md bg-ax-accent px-5 text-sm font-semibold text-ax-btn-text transition hover:bg-ax-btn-hover active:bg-ax-btn-pressed ${focusRing}`;
  const secondaryButton = `inline-flex h-11 shrink-0 items-center whitespace-nowrap justify-center gap-2 rounded-md border border-ax-border px-5 text-sm font-semibold text-ax-heading transition hover:border-ax-body hover:bg-ax-raised active:bg-ax-section ${focusRing}`;

  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} min-h-screen bg-ax-bg font-landing text-ax-body antialiased`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ax-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ax-btn-text">
        Skip to content
      </a>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 border-b border-ax-subtle bg-ax-bg/95 backdrop-blur-sm">
        <div className={`${container} flex h-14 items-center gap-8`}>
          <a href="/" className={`flex shrink-0 items-center gap-2 rounded ${focusRing}`}>
            <Image src={AxyraBotPFP} alt="" width={24} height={24} />
            <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ax-heading">AxyraBot</span>
          </a>
          <nav aria-label="Main" className="hidden flex-1 gap-5 whitespace-nowrap md:flex lg:gap-6">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className={`text-sm text-ax-secondary transition hover:text-ax-heading ${focusRing}`}>
                {l.label}
              </a>
            ))}
          </nav>
          <div ref={menuRef} className="relative ml-auto flex shrink-0 items-center gap-4 md:ml-0">
            <a href="/docs" className={`hidden text-sm text-ax-secondary transition hover:text-ax-heading lg:inline ${focusRing}`}>Docs</a>
            {isLoggedIn ? (
              <>
                <a href="/dashboard" className={`hidden text-sm font-medium text-ax-heading sm:inline ${focusRing}`}>Dashboard</a>
                {avatarUrl && (
                  <button type="button" aria-label="Account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className={`rounded-md ${focusRing}`}>
                    <Image src={avatarUrl} alt="" width={30} height={30} className="rounded-md" />
                  </button>
                )}
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-40 rounded-md border border-ax-border bg-ax-section py-1 shadow-card">
                    <a href="/dashboard" className="block px-3 py-2 text-sm text-ax-body hover:bg-ax-raised sm:hidden">Dashboard</a>
                    <button type="button" onClick={handleLogout} className="w-full px-3 py-2 text-left text-sm text-ax-body hover:bg-ax-raised">Log out</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <a href={connectUrl} className={`hidden text-sm text-ax-body transition hover:text-ax-heading lg:inline ${focusRing}`}>Log in</a>
                <a href={connectUrl} className={`inline-flex h-9 items-center gap-2 rounded-md bg-ax-accent px-3.5 text-sm font-semibold text-ax-btn-text transition hover:bg-ax-btn-hover active:bg-ax-btn-pressed ${focusRing}`}>
                  <TwitchIcon className="h-3.5 w-3.5" />
                  Connect
                </a>
              </>
            )}
            <button
              type="button"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileNavOpen((o) => !o)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border border-ax-subtle text-ax-body md:hidden ${focusRing}`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                {mobileNavOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 7h14M3 13h14" />}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-ax-subtle md:hidden">
            <div className={container}>
              {[...navLinks, { href: "/docs", label: "Docs" }, { href: supportUrl, label: "Support" }].map((l) => (
                <a key={l.href} href={l.href} {...externalProps(l.href)} onClick={() => setMobileNavOpen(false)} className="block border-b border-ax-subtle py-3.5 text-[15px] text-ax-body last:border-0">
                  {l.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main">
        {/* ── HERO ── */}
        <section aria-labelledby="hero-title" className={`${container} pb-14 pt-12 lg:pb-20 lg:pt-20`}>
          <div className="flex items-center justify-between font-code text-xs text-ax-secondary">
            <span>Moderation bot for Twitch &amp; Discord</span>
            <span className="hidden sm:inline">Free · Beta</span>
          </div>

          <div className="mt-10 grid items-end gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-x-8">
            <h1 id="hero-title" className="font-display text-[3.4rem] font-semibold leading-[0.92] tracking-[-0.045em] text-ax-heading sm:text-[5.5rem] lg:col-span-6 lg:text-[6.25rem] xl:col-span-7 xl:text-[7.5rem]">
              Keep chat
              <br />
              simple
            </h1>
            <div className="lg:col-span-6 lg:pb-3 xl:col-span-5">
              <p className="max-w-md text-lg leading-relaxed text-ax-body">
                AxyraBot moderates your Twitch chat and Discord server, runs your commands, and keeps a record of every action — so your mods can actually watch the stream.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href={twitchHref} className={primaryButton}>
                  <TwitchIcon />
                  {twitchLabel}
                </a>
                <a href={discordHref} {...externalProps(discordHref)} className={secondaryButton}>
                  <DiscordIcon />
                  {discordLabel}
                </a>
              </div>
              {channelCount !== null && channelCount > 0 && (
                <p className="mt-5 font-code text-xs text-ax-secondary">
                  Moderating {channelCount.toLocaleString()} {channelCount === 1 ? "channel" : "channels"} right now
                </p>
              )}
            </div>
          </div>

          <div id="console" className="mt-14 scroll-mt-20 lg:mt-20">
            <ModConsole />
            <p className="mt-3 font-code text-[11px] text-ax-secondary">
              Interactive example — flip a filter and watch what happens to the next message.
            </p>
          </div>
        </section>

        {/* ── 01 DASHBOARD ── */}
        <Section
          id="dashboard"
          index="01"
          label="Dashboard"
          title="Every setting your mods touch, on one screen."
          intro="These are real screenshots of the AxyraBot dashboard — pick a page, then click a screenshot to see it full size."
          wide
        >
          <DashboardViewer />
        </Section>

        {/* ── 02 COMMANDS ── */}
        <Section
          id="commands"
          index="02"
          label="Commands"
          title="Your chat already knows how to use it."
          intro={
            <>
              Familiar <code className="font-code text-[0.9em] text-ax-body">!commands</code>, with permissions per role. Add them from chat or the dashboard.
            </>
          }
        >
          <ol className="border-t border-ax-subtle">
            {commandExamples.map((c) => (
              <li key={c.input} className="grid gap-3 border-b border-ax-subtle py-6 sm:grid-cols-[1fr_1fr] sm:gap-8">
                <div>
                  <div className="flex items-center gap-2 text-xs text-ax-secondary">
                    <span className="font-medium text-ax-body">{c.who}</span>
                    <span className="rounded-[3px] border border-ax-border px-1.5 py-px font-code text-[10px] uppercase tracking-wider">{c.role}</span>
                  </div>
                  <p className="mt-2 break-words font-code text-[13.5px] text-ax-heading">{c.input}</p>
                </div>
                <div className="border-l-2 border-ax-accent pl-4">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ax-heading">
                    <Image src={AxyraBotPFP} alt="" width={14} height={14} />
                    AxyraBot
                  </p>
                  <p className="mt-2 break-words text-[14px] leading-relaxed text-ax-body">{c.reply}</p>
                </div>
              </li>
            ))}
          </ol>
          <a href="/commands" className={`mt-6 inline-flex items-center gap-2 text-sm font-medium text-ax-heading underline decoration-ax-border underline-offset-[6px] transition hover:decoration-ax-accent ${focusRing}`}>
            See every built-in command <span aria-hidden="true" className="font-code no-underline">→</span>
          </a>
        </Section>

        {/* ── 03 PLATFORMS ── */}
        <Section
          id="platforms"
          index="03"
          label="Twitch & Discord"
          title="One bot. Both communities."
          intro="The same dashboard runs your stream chat and your server, so rules and records stay in one place."
        >
          <div className="overflow-hidden rounded-md border border-ax-border bg-ax-section shadow-card">
            <div className="hidden grid-cols-[140px_1fr_1fr] border-b border-ax-border bg-ax-raised sm:grid">
              <span />
              <span className="flex items-center gap-2 border-l border-ax-subtle px-5 py-3.5 text-sm font-semibold text-ax-heading">
                <TwitchIcon className="h-4 w-4 text-[#a970ff]" /> Twitch
              </span>
              <span className="flex items-center gap-2 border-l border-ax-subtle px-5 py-3.5 text-sm font-semibold text-ax-heading">
                <DiscordIcon /> Discord
              </span>
            </div>
            <dl>
              {platformRows.map((row) => (
                <div key={row.area} className="grid border-b border-ax-subtle last:border-0 sm:grid-cols-[140px_1fr_1fr]">
                  <dt className="px-5 pb-1 pt-5 font-code text-xs uppercase tracking-[0.08em] text-ax-muted sm:py-5">{row.area}</dt>
                  <dd className="px-5 py-2 text-[15px] leading-relaxed text-ax-body sm:border-l sm:border-ax-subtle sm:py-5">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ax-secondary sm:hidden"><TwitchIcon className="h-3 w-3 text-[#a970ff]" /> Twitch</span>
                    {row.twitch}
                  </dd>
                  <dd className="px-5 pb-5 pt-2 text-[15px] leading-relaxed text-ax-body sm:border-l sm:border-ax-subtle sm:py-5">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ax-secondary sm:hidden"><DiscordIcon className="h-3 w-3" /> Discord</span>
                    {row.discord}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        {/* ── 04 IMPORT ── */}
        <section aria-labelledby="import-title" className="border-t border-ax-subtle bg-ax-section">
          <div className={`${container} grid gap-8 py-14 lg:grid-cols-12 lg:items-center lg:gap-x-8`}>
            <div className="lg:col-span-4">
              <p className="font-code text-xs text-ax-muted"><Tally className="mr-2 align-middle" /><span className="text-ax-heading">04</span> — Moving over</p>
              <h2 id="import-title" className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ax-heading">
                Bring your commands with you.
              </h2>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-md border border-ax-border bg-ax-border sm:grid-cols-3 lg:col-span-8">
              {importSources.map((bot) => (
                <li key={bot.provider} className="bg-ax-raised">
                  <a href={`/import?provider=${bot.provider}`} className={`group block ${focusRing}`}>
                    <div className="relative aspect-[3/1] opacity-80 transition group-hover:opacity-100">
                      <Image src={bot.image} alt={bot.name} fill sizes="(min-width: 640px) 260px, 90vw" className={bot.fit} />
                    </div>
                    <span className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="font-medium text-ax-heading">{bot.name}</span>
                      <span className="shrink-0 whitespace-nowrap font-code text-xs text-ax-body transition group-hover:text-ax-heading">
                        Import <span aria-hidden="true">→</span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 05 FAQ ── */}
        <Section id="faq" index="05" label="Questions" title="Before you connect.">
          <div className="border-t border-ax-subtle">
            {faqs.map((f) => (
              <FAQItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
          <p className="mt-6 text-sm text-ax-secondary">
            Something else?{" "}
            <a href={supportUrl} {...externalProps(supportUrl)} className={`text-ax-body underline decoration-ax-border underline-offset-4 hover:decoration-ax-accent ${focusRing}`}>
              Ask in the support Discord
            </a>
            .
          </p>
        </Section>

        {/* ── SIGN-OFF ── */}
        <section aria-labelledby="signoff-title" className="border-t border-ax-subtle">
          <div className={`${container} grid gap-10 py-20 lg:grid-cols-12 lg:items-end lg:gap-x-8 lg:py-28`}>
            <p id="signoff-title" className="font-display text-[3rem] font-semibold leading-[0.95] tracking-[-0.04em] text-ax-heading sm:text-[4.5rem] lg:col-span-6 lg:text-[3.6rem] xl:col-span-7 xl:text-[4.5rem]">
              Your mods
              <br />
              deserve a break
            </p>
            <div className="lg:col-span-6 lg:pb-2 xl:col-span-5">
              <p className="text-ax-body">Free, with no paid tiers. Most channels are set up in about five minutes.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href={twitchHref} className={primaryButton}>
                  <TwitchIcon />
                  {twitchLabel}
                </a>
                <a href={discordHref} {...externalProps(discordHref)} className={secondaryButton}>
                  <DiscordIcon />
                  {discordLabel}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-ax-subtle bg-ax-section">
        <div className={`${container} grid gap-10 py-12 md:grid-cols-12`}>
          <div className="md:col-span-6">
            <div className="flex items-center gap-2">
              <Image src={AxyraBotPFP} alt="" width={22} height={22} />
              <span className="font-display font-semibold text-ax-heading">AxyraBot</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ax-muted">Moderation and automation for Twitch and Discord communities.</p>
          </div>
          {[
            { title: "Product", links: [["Dashboard", "/dashboard"], ["Commands", "/commands"], ["Moderation", "/moderation"], ["Modules", "/modules"]] },
            { title: "Resources", links: [["Docs", "/docs"], ["Import commands", "/import"], ["Support Discord", supportUrl]] },
            { title: "Legal", links: [["Terms of Service", "/terms"], ["Privacy Policy", "/privacy"]] },
          ].map((col) => (
            <div key={col.title} className="md:col-span-2">
              <h3 className="font-code text-[11px] uppercase tracking-[0.08em] text-ax-muted">{col.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} {...externalProps(href)} className={`text-ax-muted transition hover:text-ax-heading ${focusRing}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={`${container} flex flex-col gap-2 border-t border-ax-subtle py-5 font-code text-[11px] text-ax-muted sm:flex-row sm:justify-between`}>
          <p>© {new Date().getFullYear()} AxyraBot</p>
          <p>Not affiliated with Twitch Interactive, Inc. or Discord Inc.</p>
        </div>
      </footer>
    </div>
  );
}
