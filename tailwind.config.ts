import type { Config } from "tailwindcss";

// Colors are CSS variables (space-separated RGB) so the same classes work in
// both light and dark themes. Values are defined in globals.css.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        border: v("border"),
        "border-soft": v("border-soft"),
        muted: v("muted"),
        text: v("text"),
        accent: v("accent"),
        "accent-2": v("accent-2"),
        good: v("good"),
        bad: v("bad"),
        warn: v("warn"),
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 1px 2px rgb(0 0 0 / 0.2), 0 12px 40px -16px rgb(0 0 0 / 0.55)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.3), 0 12px 40px -10px rgb(var(--accent) / 0.4)",
        lift: "0 1px 0 0 rgb(255 255 255 / 0.05) inset, 0 18px 50px -20px rgb(0 0 0 / 0.7)",
      },
      borderRadius: {
        "2xl": "1.1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.6s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
