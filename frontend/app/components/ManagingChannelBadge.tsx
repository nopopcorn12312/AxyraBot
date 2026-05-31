"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type ChannelOption = {
  login: string;
  avatarUrl: string | null;
};

export default function ManagingChannelBadge() {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  const [show, setShow] = useState(false);
  const [active, setActive] = useState<ChannelOption>({ login: "", avatarUrl: null });
  const [options, setOptions] = useState<ChannelOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ownLogin = window.localStorage.getItem("axyra.login");
    const activeChannel = window.localStorage.getItem("axyra.activeChannel");
    if (!ownLogin) return;

    const currentChannel = activeChannel || ownLogin;

    // Fetch editor channels to build the full options list
    fetch(`${backendUrl}/roles/editor-channels?login=${encodeURIComponent(ownLogin)}`)
      .then((res) => (res.ok ? res.json() : { channels: [] }))
      .then(async (data: { channels?: string[] }) => {
        const editorChannels: string[] = data.channels ?? [];
        const allLogins = [ownLogin, ...editorChannels];

        // Only show the badge if there's more than one manageable channel
        if (allLogins.length < 2) return;
        setShow(true);

        // Fetch avatars for all channels in parallel
        const settled = await Promise.allSettled(
          allLogins.map((login) =>
            fetch(`${backendUrl}/user/avatar?login=${encodeURIComponent(login)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d: { avatar_url?: string } | null) => ({
                login,
                avatarUrl: d?.avatar_url ?? null,
              }))
          )
        );

        const opts: ChannelOption[] = settled.map((r) =>
          r.status === "fulfilled" ? r.value : { login: "", avatarUrl: null }
        );

        setOptions(opts);
        const current = opts.find((o) => o.login === currentChannel) ?? opts[0];
        setActive(current);
      })
      .catch(() => {});
  }, [backendUrl]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSwitch = (opt: ChannelOption) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("axyra.activeChannel", opt.login);
    }
    setActive(opt);
    setOpen(false);
    window.location.reload();
  };

  if (!show) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 hover:bg-slate-800 hover:border-slate-500 transition"
      >
        {active.avatarUrl ? (
          <Image
            src={active.avatarUrl}
            alt={`${active.login} profile picture`}
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0" />
        )}
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Managing Channel
          </span>
          <span className="text-sm font-bold text-white">{active.login}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl py-1.5 z-50">
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Switch channel
          </p>
          {options.map((opt) => (
            <button
              key={opt.login}
              type="button"
              onClick={() => handleSwitch(opt)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-800 ${
                opt.login === active.login ? "bg-slate-800/60" : ""
              }`}
            >
              {opt.avatarUrl ? (
                <Image
                  src={opt.avatarUrl}
                  alt={opt.login}
                  width={28}
                  height={28}
                  className="rounded-full flex-shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0" />
              )}
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-slate-100">{opt.login}</span>
                {opt.login === active.login && (
                  <span className="text-[10px] text-accent font-semibold">Active</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
