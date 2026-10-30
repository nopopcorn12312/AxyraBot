"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Once accepted, the notice stays hidden for the rest of the browser session.
const storageKey = "axyra.termsAccepted";

function readAccepted() {
  try {
    return window.sessionStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

const linkClass =
  "font-medium text-ax-heading underline decoration-ax-accent underline-offset-2 hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus";

export default function TermsNotice() {
  // Rendered only after mount so the server HTML never disagrees with
  // what sessionStorage says.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readAccepted());
  }, []);

  if (!visible) return null;

  const accept = () => {
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage blocked: hiding it for this page view is the best we can do.
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Terms notice"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 motion-safe:animate-fade-up"
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-md border border-ax-border bg-ax-raised px-4 py-3 shadow-panel sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm leading-snug text-ax-heading">
          By using this site you agree to the{" "}
          <Link href="/terms" className={linkClass}>
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-md bg-ax-accent px-4 py-2 text-sm font-semibold text-ax-btn-text transition hover:bg-ax-btn-hover active:bg-ax-btn-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
