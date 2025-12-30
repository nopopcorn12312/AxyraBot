import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AxyraBot",
  description: "AxyraBot – Smart Twitch bot for your channel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
