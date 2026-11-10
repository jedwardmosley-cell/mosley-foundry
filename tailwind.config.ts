import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F2EA",
        card: "#FFFDF8",
        line: "#E4DDD0",
        ink: { DEFAULT: "#1F2733", soft: "#4A5463", mute: "#7A8291" },
        navy: { DEFAULT: "#1E2F4A", deep: "#15223A" },
        brass: { DEFAULT: "#A77B3B", soft: "#EFE2CC" },
        sage: { DEFAULT: "#5E7A64", soft: "#E3EBE3" },
        clay: { DEFAULT: "#A85C45", soft: "#F3E2DB" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
