"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirects unauthenticated users to the landing page.
 * Call this at the top of any page that requires login.
 * Auth is determined by the presence of `axyra.login` in localStorage.
 */
export function useRequireAuth() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const login = window.localStorage.getItem("axyra.login");
    if (!login) {
      router.replace("/");
    }
  }, [router]);
}
