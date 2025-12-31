"use client";

import { useEffect } from "react";

export default function DashboardPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    if (login) {
      window.localStorage.setItem("axyra.login", "1");
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <h1 className="text-3xl font-semibold text-slate-50">dashboard</h1>
    </main>
  );
}
