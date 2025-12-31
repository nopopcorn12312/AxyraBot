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
      },
      boxShadow: {
        glow: "0 0 80px rgba(56, 189, 248, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
