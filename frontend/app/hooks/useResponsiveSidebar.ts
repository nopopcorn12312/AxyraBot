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
    sidebarOpen ? "md:w-60" : "md:invisible md:w-0 md:-mr-6 md:-translate-x-4 md:overflow-hidden md:!border-0 md:!p-0 md:opacity-0"
  } flex-col border border-ax-subtle bg-ax-section p-3 transition-all duration-200 whitespace-nowrap motion-reduce:transition-none md:relative md:inset-auto md:z-auto md:flex md:max-w-none md:rounded-2xl md:bg-ax-section md:shadow-none`;
}
