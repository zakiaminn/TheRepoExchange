"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* fades a below-the-fold section in the first time it scrolls into view, and
   never again. server output is fully visible; the section is only hidden
   after mount, and only if it's actually off-screen at that moment, so there
   is no flash and nothing is lost without JS. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "waiting" | "shown">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState((s) => (s === "waiting" ? "shown" : s));
          io.disconnect();
        } else {
          setState((s) => (s === "idle" ? "waiting" : s));
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-state={state} className={`reveal-scroll ${className ?? ""}`}>
      {children}
    </div>
  );
}
