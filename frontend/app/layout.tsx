import type { Metadata } from "next";
import AxyraBotPFP from "./images/AxyraBotPFP.png";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AxyraBot — Free Twitch & Discord Moderation Bot",
  description:
    "AxyraBot is a free all-in-one moderation bot for Twitch and Discord. Protect your community, automate moderation, manage commands, and replace multiple bots with one bot.",
  icons: {
    icon: AxyraBotPFP.src,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
