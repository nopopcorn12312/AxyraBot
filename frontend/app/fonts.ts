import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

// Landing page type system:
// - Bricolage Grotesque: display face with character, used for headlines.
// - Geist: neutral body text.
// - Geist Mono: data — timestamps, commands, labels, section indexes.
// Exposed as CSS variables for Tailwind's font-display / font-landing / font-code.
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const bodyFont = Geist({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
});
