import type { Config } from "tailwindcss";

// Tailwind v4 reads the design tokens from the `@theme inline` block in
// globals.css, not from here — this file exists so the token names are
// discoverable by tooling and editors. globals.css is the source of truth;
// if the two ever disagree, globals.css wins.
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
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        "paper-3": "var(--paper-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        rule: "var(--rule)",
        "rule-2": "var(--rule-2)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        "brand-fg": "var(--brand-fg)",
        "brand-wash": "var(--brand-wash)",
        pos: "var(--pos)",
        neg: "var(--neg)",
      },
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
