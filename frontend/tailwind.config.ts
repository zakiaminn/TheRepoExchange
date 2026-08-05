import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--page)",
        card: "var(--card)",
        "card-alt": "var(--card-alt)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        edge: "var(--edge)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        bull: "var(--bull)",
        bear: "var(--bear)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
