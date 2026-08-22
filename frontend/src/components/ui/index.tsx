"use client";

import { useEffect, useState, type ReactNode } from "react";
import { stamp, pct, toneClass } from "@/lib/format";

/* the reusable bits — the half of the system that doesn't know or care that
   it's TRX. it's all structure, so it should drop into the next project as-is. */

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

/* the section rule — a hairline across the column with a little label on the
   left and optional machine text on the right. it's basically the title block
   off a technical drawing. this is the signature device; use it instead of an
   <h2> + margin, the rule IS the heading.
   Used consistently, it's the thing that makes two Bureau pages recognisably
   the same system even when they share no other component.               */
export function SectionRule({
  label,
  meta,
  id,
  className,
}: {
  label: string;
  meta?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cx("flex items-center gap-4", className)}>
      <span className="label label-ink shrink-0">{label}</span>
      <span className="rule-line" aria-hidden="true" />
      {meta ? <span className="ref shrink-0 hidden sm:block">{meta}</span> : null}
    </div>
  );
}

/* the only box we have. one hairline, no rounded corners, no shadow. pass
   `registered` to get the corner crop marks — but only on the one or two
   panels that matter, they stop meaning anything if everything has them. */
export function Panel({
  registered,
  tint,
  className,
  children,
}: {
  registered?: boolean;
  tint?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("panel", tint && "panel-2", registered && "registered", className)}>
      {children}
    </div>
  );
}

/* the little "TRX-MKT-0442 · 21 AUG..." reference line. a live monospace stamp
   that makes it feel like real infrastructure labelling its own output. costs
   nothing, does more for the vibe than any amount of styling.

   hydration-safe on purpose: the server renders just the code, and the
   clock is appended only after mount.                                     */
export function DocRef({ code, className }: { code: string; className?: string }) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(stamp(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className={cx("ref whitespace-nowrap", className)}>
      {code}
      {now ? ` · ${now}` : ""}
    </span>
  );
}

/* label on top, number underneath. the label never gets bigger and the number
   never gets smaller — the size gap does the hierarchy, no colour/weight
   tricks needed. */
export function Stat({
  label,
  value,
  sub,
  size = "md",
  align = "left",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "right";
  className?: string;
}) {
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-5xl sm:text-6xl",
  } as const;

  return (
    <div className={cx(align === "right" && "text-right", className)}>
      <div className="label mb-1.5">{label}</div>
      <div className={cx("figure text-ink leading-none", sizes[size])}>{value}</div>
      {sub ? <div className="mt-1.5 text-xs">{sub}</div> : null}
    </div>
  );
}

/* a +/- percentage in green or red. always two decimals, always the real
   minus, so a column of them stays lined up on the sign. */
export function Delta({
  value,
  className,
  showFlat = true,
}: {
  value: number | null | undefined;
  className?: string;
  showFlat?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return showFlat ? <span className={cx("figure text-ink-3", className)}>—</span> : null;
  }
  return <span className={cx("figure", toneClass(value), className)}>{pct(value)}</span>;
}

/* the little "live" dot. it's a ring that expands and fades, not a dot that
   pulses bigger — nothing in here resizes itself. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cx("relative inline-flex h-1.5 w-1.5 shrink-0", className)}>
      <span className="ping absolute inset-0 rounded-full text-brand-ink" aria-hidden="true" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-ink" />
    </span>
  );
}

/* label on top, input under it, hint after. no floating labels, no
   placeholder-as-label — it's a form pretending to be a paper record, and
   paper records label their fields properly. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label mb-2 flex items-baseline justify-between gap-3">
        <span>{label}</span>
        {hint ? <span className="text-ink-3 normal-case tracking-normal font-normal text-[11px]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

/* a chunk of text that matters, marked with a coloured bar down its left edge.
   the bar is the only colour it gets — a full tinted background would make it
   look like an error, and it's a notice, not an alarm. */
export function Notice({
  label,
  tone = "neutral",
  children,
  className,
}: {
  label?: string;
  tone?: "neutral" | "pos" | "neg" | "brand";
  children: ReactNode;
  className?: string;
}) {
  const edge = {
    neutral: "border-l-rule-2",
    pos: "border-l-pos",
    neg: "border-l-neg",
    brand: "border-l-brand",
  }[tone];

  return (
    <div className={cx("border-l-2 pl-4 py-1", edge, className)}>
      {label ? <div className="label mb-1.5">{label}</div> : null}
      <div className="text-sm leading-relaxed text-ink-2 prose-measure">{children}</div>
    </div>
  );
}

/* every empty state. centred, quiet, and worded as a fact about the record
   ("No positions of record.") not a nudge at the user. */
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("px-6 py-14 text-center text-sm text-ink-3", className)}>{children}</div>
  );
}

/* loading state. no spinner — a blinking caret is what something actually
   waiting looks like; a spinning arc is what something pretending to be busy
   looks like. */
export function Pending({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-2 px-6 py-14 text-sm text-ink-3", className)}>
      <span className="label">{children}</span>
      <span className="inline-block h-3 w-[7px] bg-brand-ink animate-pulse" aria-hidden="true" />
    </div>
  );
}
