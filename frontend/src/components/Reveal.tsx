"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// fades a below-the-fold section in the first time it scrolls into view. server output
// is fully visible, and the section is only hidden after mount if it's actually
// off-screen at that moment, so there's no flash and nothing is lost without js
export function Reveal({
  children,
  className,
  stagger,
}: {
  children: ReactNode;
  className?: string;
  // children marked .stagger-item (with an --i index) arrive in turn,
  // instead of the whole block fading in at once
  stagger?: boolean;
}) {
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
    <div ref={ref} data-state={state} className={`${stagger ? "reveal-group" : "reveal-scroll"} ${className ?? ""}`}>
      {children}
    </div>
  );
}
