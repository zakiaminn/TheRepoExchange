"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { pct, toneClass } from "@/lib/format";

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

/* the only box we have. one hairline, no rounded corners, no shadow. */
export function Panel({
  tint,
  className,
  children,
}: {
  tint?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("panel", tint && "panel-2", className)}>
      {children}
    </div>
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
    return showFlat ? <span className={cx("figure text-ink-3", className)}>-</span> : null;
  }
  return <span className={cx("figure", toneClass(value), className)}>{pct(value)}</span>;
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
   ("No positions yet.") not a nudge at the user. */
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
      <span className="inline-block h-3 w-[7px] bg-brand-ink caret" aria-hidden="true" />
    </div>
  );
}

/* skeleton loader block — hard-edged, brand-toned, subtle sweep. size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("skeleton block", className)} aria-hidden="true" />;
}

/* placeholder for the board while quotes load — ruled rows that echo the real table
   so the layout doesn't jump when the data lands. */
export function SkeletonBoard({ rows = 8 }: { rows?: number }) {
  return (
    <div className="panel" role="status" aria-label="Loading listings">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cx("flex items-center gap-4 px-4 py-3 sm:px-6", i > 0 && "border-t border-rule")}
        >
          <Skeleton className="h-3 w-40 max-w-[45%]" />
          <span className="ml-auto flex items-center gap-4 sm:gap-6">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="hidden h-3 w-12 sm:block" />
            <Skeleton className="hidden h-3 w-10 md:block" />
            <Skeleton className="h-6 w-14" />
          </span>
        </div>
      ))}
    </div>
  );
}

/* a row of mutually exclusive options sharing hairlines (the chart range).
   the selected state is a second copy of the row in the active colours,
   clipped down to the chosen segment. changing the value slides the clip, so
   the colour moves across as one piece instead of one segment fading out
   while another fades in. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly K[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState<string | null>(null);
  // the first measurement places the highlight without animating it; the
  // transition only switches on a frame later, for real changes
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!clip || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [clip, ready]);

  // measure the chosen segment against the row and turn it into an inset
  useLayoutEffect(() => {
    const row = rowRef.current;
    const btn = row?.querySelector<HTMLElement>(`[data-key="${value}"]`);
    if (!row || !btn) return;
    const right = row.offsetWidth - btn.offsetLeft - btn.offsetWidth;
    setClip(`inset(0 ${right}px 0 ${btn.offsetLeft}px)`);
  }, [value, options]);

  const seg = "border-r border-rule px-2.5 py-1.5 text-[11px] last:border-r-0";

  return (
    <div className="relative flex shrink-0 border border-rule" role="group" aria-label={label}>
      <div ref={rowRef} className="flex">
        {options.map((k) => (
          <button
            key={k}
            data-key={k}
            onClick={() => onChange(k)}
            aria-pressed={value === k}
            className={cx(seg, "text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink")}
          >
            {k}
          </button>
        ))}
      </div>
      <div
        aria-hidden="true"
        data-ready={ready || undefined}
        className="segmented-active pointer-events-none absolute inset-0 flex bg-brand"
        style={{ clipPath: clip ?? "inset(0 100% 0 0)" }}
      >
        {options.map((k) => (
          <span key={k} className={cx(seg, "border-transparent text-brand-fg")}>
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
