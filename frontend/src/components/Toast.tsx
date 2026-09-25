"use client";

import { useEffect, useState } from "react";

export type ToastMessage = { text: string; type: "success" | "error" } | null;

// how long a notice stays up, and how long its fade-out takes (the same length as the
// exit transition on .toast in globals.css)
const DWELL = 4500;
const EXIT = 160;

// the little pop-up message: a hairline box in the corner with a coloured bar on the
// left. the caller just sets the message and the toast runs its own clock. it stays up
// for DWELL, fades out, and a new message replaces the old one and restarts the clock
export function Toast({ message }: { message: ToastMessage }) {
  const [shown, setShown] = useState<{ msg: NonNullable<ToastMessage>; id: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [prev, setPrev] = useState<ToastMessage>(null);

  // react to the prop during render rather than in an effect. a new message
  // goes up straight away; a cleared one fades whatever is showing instead of
  // dropping it mid-word.
  if (message !== prev) {
    setPrev(message);
    if (message) {
      setShown({ msg: message, id: (shown?.id ?? 0) + 1 });
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
    }
  }

  // the dwell restarts whenever a new message goes up
  useEffect(() => {
    if (!shown || leaving) return;
    const t = window.setTimeout(() => setLeaving(true), DWELL);
    return () => window.clearTimeout(t);
  }, [shown, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setShown(null), EXIT);
    return () => window.clearTimeout(t);
  }, [leaving]);

  if (!shown) return null;

  const tone = shown.msg.type === "success" ? "border-l-pos" : "border-l-neg";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end"
    >
      {/* keyed on the message so a replacement mounts fresh and gets its own
          entrance, rather than swapping text inside a box that's already up */}
      <div
        key={shown.id}
        data-leaving={leaving || undefined}
        className={`toast panel border-l-2 ${tone} max-w-md px-4 py-3`}
        style={{ background: "var(--paper)" }}
      >
        <div className="text-[12px] leading-relaxed text-ink">{shown.msg.text}</div>
      </div>
    </div>
  );
}
