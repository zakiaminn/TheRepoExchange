"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/* the theme switch. a knob that slides between a sun and a moon — same idea as
   every dark-mode toggle, but hard-edged (no pill) and in Sulfur so it belongs
   to this brand instead of looking bolted on. the sun/moon sit faint at each
   end; the bright knob parks over whichever one is active and carries its icon.

   mounted-guarded so the server render doesn't guess the wrong side and flash. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle light or dark theme"
      aria-pressed={mounted ? isDark : undefined}
      className={`relative inline-flex h-7 w-14 shrink-0 items-center border border-rule-2 bg-paper-2 p-1 transition-colors ${className}`}
    >
      {/* faint markers at the ends — the knob covers the active one */}
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-ink-3"
        aria-hidden="true"
      >
        <Sun className="h-3 w-3" strokeWidth={1.75} />
        <Moon className="h-3 w-3" strokeWidth={1.75} />
      </span>
      {/* the sliding knob */}
      <span
        className="relative z-10 flex h-[18px] w-[18px] items-center justify-center bg-brand text-brand-fg"
        style={{
          transform: isDark ? "translateX(1.75rem)" : "translateX(0)",
          transition: "transform 220ms var(--ease)",
        }}
      >
        {mounted ? (
          isDark ? <Moon className="h-3 w-3" strokeWidth={2} /> : <Sun className="h-3 w-3" strokeWidth={2} />
        ) : null}
      </span>
    </button>
  );
}
