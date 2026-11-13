import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Every color is a CSS variable (see globals.css), so the app follows the phone's light or dark setting.
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: { DEFAULT: "rgb(var(--ink) / <alpha-value>)", soft: "rgb(var(--ink-soft) / <alpha-value>)", mute: "rgb(var(--ink-mute) / <alpha-value>)" },
        navy: { DEFAULT: "rgb(var(--navy) / <alpha-value>)", deep: "rgb(var(--navy-deep) / <alpha-value>)" },
        heading: "rgb(var(--heading) / <alpha-value>)",
        link: "rgb(var(--link) / <alpha-value>)",
        brass: { DEFAULT: "rgb(var(--brass) / <alpha-value>)", soft: "rgb(var(--brass-soft) / <alpha-value>)" },
        sage: { DEFAULT: "rgb(var(--sage) / <alpha-value>)", soft: "rgb(var(--sage-soft) / <alpha-value>)" },
        clay: { DEFAULT: "rgb(var(--clay) / <alpha-value>)", soft: "rgb(var(--clay-soft) / <alpha-value>)" },
        violet: "rgb(var(--violet) / <alpha-value>)",
        // Errors and overdue items. Kept apart from clay, which means Emotionally Anchored.
        alert: { DEFAULT: "rgb(var(--alert) / <alpha-value>)", soft: "rgb(var(--alert-soft) / <alpha-value>)" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
