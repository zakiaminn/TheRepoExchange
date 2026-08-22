"use client";

import { useEffect, useState } from "react";

export type ToastMessage = { text: string; type: "success" | "error" } | null;

/* the little pop-up message. styled like a notice pinned to the corner, not a
   confetti moment: hairline box, coloured bar on the left, mono text, no icon,
   no rounded pill.

   it's dumb on purpose — whoever uses it owns the message + the timer that
   clears it. the only thing it handles itself is fading out, so it doesn't
   just vanish mid-word. */
export function Toast({ message }: { message: ToastMessage }) {
  const [shown, setShown] = useState<ToastMessage>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (message) {
      setShown(message);
      setLeaving(false);
      return;
    }
    // hold the last message on screen through its fade instead of dropping it
    if (shown) {
      setLeaving(true);
      const t = window.setTimeout(() => setShown(null), 200);
      return () => window.clearTimeout(t);
    }
  }, [message]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown) return null;

  const tone = shown.type === "success" ? "border-l-pos" : "border-l-neg";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end"
    >
      <div
        className={`panel border-l-2 ${tone} max-w-md px-4 py-3 transition-all duration-200 ${
          leaving ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{ background: "var(--paper)" }}
      >
        <div className="figure text-[12px] leading-relaxed text-ink">{shown.text}</div>
      </div>
    </div>
  );
}
