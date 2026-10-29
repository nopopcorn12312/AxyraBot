import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        surface: "#020617",
        // Light blue accent to match the profile picture
        accent: "#38bdf8",
        accentSoft: "#1e293b",
        // AxyraBot landing page palette (official). Use these tokens rather
        // than raw hex values so the page stays consistent.
        ax: {
          bg: "#545454", // main page background
          section: "#454545", // secondary background: contrasting sections and cards
          raised: "#626262", // elevated surfaces and selected panels
          accent: "#38BDF8", // brand accent blue
          // Accent-colored small text uses the palette's light blue, since
          // #38BDF8 is below 4.5:1 as small text on these greys.
          "accent-text": "#7DD3FC",
          heading: "#FFFFFF", // primary headings
          body: "#E0E0E0", // primary body text
          secondary: "#D0D0D0", // secondary text
          muted: "#BDBDBD", // muted text (only on ax-section for small text)
          border: "#707070", // default borders
          subtle: "#626262", // subtle borders and hairlines
          "btn-text": "#102B3A", // primary button text
          "btn-hover": "#7DD3FC", // primary button hover background
          "btn-pressed": "#0284C7", // primary button pressed background
          focus: "#38BDF8", // keyboard focus indicator
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        landing: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        code: ["var(--font-code)", "ui-monospace", "SFMono-Regular", "monospace"],
        // App-wide monospace is the brand mono (Geist Mono) for data and labels.
        mono: ["var(--font-code)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 80px rgba(56, 189, 248, 0.4)",
        panel: "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.6)",
        card: "0 1px 2px rgba(15,23,42,0.06), 0 12px 32px -16px rgba(15,23,42,0.25)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
