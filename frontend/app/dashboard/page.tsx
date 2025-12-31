"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function DashboardPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const login = searchParams.get("login");
    if (typeof window !== "undefined" && login) {
      window.localStorage.setItem("axyra.login", "1");
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#1e293b,_#020617)]">
      <h1 className="text-3xl font-semibold text-slate-50">dashboard</h1>
    </main>
  );
}
