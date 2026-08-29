"use client";

import Link from "next/link";
import { usd, pct, toneClass, tickerParts } from "@/lib/format";

export type TapeItem = {
  ticker: string;
  price: number;
  change: number | null;
};

/* the scrolling quote strip under the masthead. it's the one thing allowed to
   move continuously, and it gets a pass because a ticker tape is the single
   oldest piece of UI the whole industry has.

   the loop is seamless because the list is rendered twice and slid by exactly
   -50% — copy #2 lands right where copy #1 started, so there's no jump. hover
   pauses it, because a strip you can't read is just noise. */
export function TickerTape({ items }: { items: TapeItem[] }) {
  if (items.length === 0) return null;

  // two passes over the same data; the second is hidden from assistive tech
  const run = (dup: boolean) =>
    items.map((item) => {
      const { owner, repo } = tickerParts(item.ticker);
      return (
        <Link
          key={`${dup ? "b" : "a"}-${item.ticker}`}
          href={`/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`}
          aria-hidden={dup || undefined}
          tabIndex={dup ? -1 : undefined}
          className="group flex shrink-0 items-baseline gap-2.5 border-r border-rule px-5 py-2 transition-colors hover:bg-paper-3"
        >
          <span className="figure text-[11px] font-medium uppercase text-ink group-hover:text-brand-ink">
            {repo}
          </span>
          <span className="figure text-[11px] text-ink-2">{usd(item.price)}</span>
          <span className={`figure text-[11px] ${toneClass(item.change)}`}>
            {item.change === null ? "-" : pct(item.change)}
          </span>
        </Link>
      );
    });

  return (
    <div className="tape relative overflow-hidden border-b border-rule bg-paper-2">
      <div className="tape-track">
        {run(false)}
        {run(true)}
      </div>
      {/* the tape runs under the page edges rather than stopping at them */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--paper-2)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--paper-2)] to-transparent" />
    </div>
  );
}
