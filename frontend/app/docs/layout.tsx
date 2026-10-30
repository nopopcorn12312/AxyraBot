import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — AxyraBot",
  description:
    "How to use AxyraBot: chat commands, custom commands and their variables, moderation, timers, birthdays, giveaways and Discord.",
  alternates: { canonical: "/docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
