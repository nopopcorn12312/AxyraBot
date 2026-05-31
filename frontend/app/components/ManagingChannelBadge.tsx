"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function ManagingChannelBadge() {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  const [show, setShow] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ownLogin = window.localStorage.getItem("axyra.login");
    const activeChannel = window.localStorage.getItem("axyra.activeChannel");
    if (!ownLogin || !activeChannel) return;
    // Always show the managing badge when there is an active channel set
    setShow(true);
    setChannelName(activeChannel);

    // Fetch the managed channel's Twitch avatar
    fetch(`${backendUrl}/user/avatar?login=${encodeURIComponent(activeChannel)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { avatar_url?: string } | null) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      })
      .catch(() => {});
  }, [backendUrl]);

  if (!show) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`${channelName} profile picture`}
          width={28}
          height={28}
          className="rounded-full flex-shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-slate-700 flex-shrink-0" />
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Managing Channel
        </span>
        <span className="text-xs font-medium text-slate-100">{channelName}</span>
      </div>
    </div>
  );
}
