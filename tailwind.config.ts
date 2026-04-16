import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        surfaceAlt: "var(--surface-alt)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        accentSoft: "var(--accent-soft)",
        border: "var(--border)"
      },
      boxShadow: {
        panel: "0 16px 40px rgba(15, 23, 42, 0.12)"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
