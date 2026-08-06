import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0F1320",
          surface: "#171B2C",
          surface2: "#1E2337",
          border: "#2A3049",
        },
        text: {
          primary: "#F5F3EE",
          muted: "#8B92AB",
        },
        gold: {
          DEFAULT: "#E8B75B",
          soft: "#F2D190",
          deep: "#B8863B",
        },
        success: "#34D399",
        danger: "#F0654B",
        info: "#5B9BE8",
        warning: "#F0A84B",
      },
      fontFamily: {
        display: ["var(--font-almarai)", "sans-serif"],
        body: ["var(--font-tajawal)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -8px rgba(0,0,0,0.5)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
