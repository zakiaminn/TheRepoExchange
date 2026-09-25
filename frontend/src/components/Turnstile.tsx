"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// loads cloudflare's script once per page
let script: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!script) {
    script = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        script = null;
        reject(new Error("turnstile didn't load"));
      };
      document.head.appendChild(s);
    });
  }
  return script;
}

// cloudflare's bot check for the sign-in forms. it stays invisible unless cloudflare wants a
// click, and passes each token to onToken (null when one expires or the check fails). a token
// works once, so bumping `resetKey` asks for a new one. renders nothing without a site key
export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const handler = useRef(onToken);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    handler.current = onToken;
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let alive = true;
    loadTurnstile()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          theme: "auto",
          size: "flexible",
          callback: (token: string) => handler.current(token),
          "expired-callback": () => handler.current(null),
          "error-callback": () => handler.current(null),
          "before-interactive-callback": () => setInteractive(true),
          "after-interactive-callback": () => setInteractive(false),
        });
      })
      .catch(() => handler.current(null));
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  // no margin until cloudflare actually shows something, so the form doesn't shift
  return <div ref={box} className={interactive ? "mb-3" : undefined} />;
}
