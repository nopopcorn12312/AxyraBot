"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useResponsiveSidebar() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setSidebarOpen((open) => !open);
      return;
    }
    setMobileSidebarOpen(true);
  };

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return { sidebarOpen, mobileSidebarOpen, toggleSidebar, closeMobileSidebar };
}

export function responsiveSidebarClassName(sidebarOpen: boolean, mobileSidebarOpen: boolean): string {
  return `${mobileSidebarOpen ? "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] overflow-y-auto rounded-none shadow-2xl" : "hidden"} ${
    sidebarOpen ? "md:w-60" : "md:w-16"
  } flex-col border border-slate-800 bg-slate-900/95 p-3 transition-all duration-200 md:relative md:inset-auto md:z-auto md:flex md:max-w-none md:rounded-2xl md:bg-slate-900/80 md:shadow-none`;
}
