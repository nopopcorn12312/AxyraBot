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
        accent: "#a855f7",
        accentSoft: "#1e293b",
      },
      boxShadow: {
        glow: "0 0 80px rgba(168, 85, 247, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
