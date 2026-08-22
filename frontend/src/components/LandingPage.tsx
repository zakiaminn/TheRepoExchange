"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Mark, Wordmark } from "@/components/Logo";
import { MiniSparkline } from "@/components/MiniSparkline";
import { TickerTape, type TapeItem } from "@/components/TickerTape";
import { SectionRule, DocRef, Notice, LiveDot } from "@/components/ui";
import { usd, pct, count, countCompact, change, toneClass, tickerParts } from "@/lib/format";
import { BRAND, HERO, MECHANICS, CLAUSES, NOTICE, CTA, SECTIONS, COLUMNS, AUTH, NAV, FOOTER, LABELS } from "@/lib/copy";

type Listing = {
  ticker: string;
  current_price: number;
  raw_stars: number;
  sparkline: number[];
  category: string;
};

// Shown only if the discovery API can't be reached. Real listings are
// fetched below — a marketing page for an exchange that shows invented
// quotes when live ones are one fetch away is just a screenshot.
const FALLBACK: Listing[] = [
  { ticker: "facebook/react",   current_price: 2335.23, raw_stars: 233523, sparkline: [2294.1, 2301.4, 2288.9, 2310.2, 2305.6, 2318.0, 2325.7, 2320.4, 2331.1, 2335.23], category: "frontend" },
  { ticker: "vercel/next.js",   current_price: 1271.50, raw_stars: 127150, sparkline: [1232.0, 1238.6, 1229.4, 1244.8, 1251.2, 1247.9, 1258.3, 1263.0, 1267.4, 1271.50], category: "frontend" },
  { ticker: "rust-lang/rust",   current_price:  992.10, raw_stars:  99210, sparkline: [996.0, 997.8, 995.1, 993.4, 996.2, 994.7, 991.8, 993.0, 992.6, 992.10],       category: "systems"  },
  { ticker: "oven-sh/bun",      current_price:  536.78, raw_stars:  53678, sparkline: [501.2, 505.9, 511.3, 509.8, 516.4, 521.0, 526.7, 530.1, 534.2, 536.78],       category: "runtimes" },
  { ticker: "ollama/ollama",    current_price: 1489.40, raw_stars: 148940, sparkline: [1454.0, 1461.2, 1457.8, 1466.5, 1472.1, 1469.3, 1477.0, 1481.6, 1486.2, 1489.40], category: "ai"    },
  { ticker: "denoland/deno",    current_price: 1043.60, raw_stars: 104360, sparkline: [1056.3, 1054.1, 1051.8, 1052.9, 1049.4, 1047.2, 1048.0, 1045.5, 1044.8, 1043.60], category: "runtimes" },
];

/* the logged-out home page. page.tsx shows this when there's no session, so
   it's basically its own little site with its own nav.

   laid out like a newspaper front page, not a typical SaaS landing: masthead,
   tape, a lead headline, the board, then the boring-on-purpose stuff (clauses,
   mechanics, the notice). everything on it is literally true, disclaimer
   included — which is the actual joke, since it's played completely straight. */
export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [listings, setListings] = useState<Listing[]>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => setMounted(true), []);

  // discovery is public, so the front page can show the actual board
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) return;
        const data = await res.json();
        const flat: Listing[] = Object.entries(data).flatMap(([category, repos]: [string, any]) =>
          (repos as any[]).map((r) => ({
            ticker: r.ticker,
            current_price: Number(r.current_price),
            raw_stars: Number(r.raw_stars),
            sparkline: Array.isArray(r.sparkline) ? r.sparkline : [],
            category,
          }))
        );
        if (flat.length > 0) {
          setListings(flat);
          setLive(true);
        }
      } catch {
        // fallback stays; the page is still honest, just not current
      }
    };
    load();
  }, []);

  const withChange = listings.map((l) => ({
    ...l,
    delta: l.sparkline.length > 1 ? change(l.sparkline[0], l.sparkline[l.sparkline.length - 1]) : null,
  }));

  const tape: TapeItem[] = withChange
    .slice(0, 18)
    .map((l) => ({ ticker: l.ticker, price: l.current_price, change: l.delta }));

  // the front page shows the ten most valuable listings — a board is a
  // summary of a market, not a directory of it
  const board = [...withChange].sort((a, b) => b.current_price - a.current_price).slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── masthead ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-rule bg-[var(--paper)]/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[76rem] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label={BRAND.full}>
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label={NAV.theme}
                className="flex h-9 w-9 items-center justify-center border border-rule text-ink-2 transition-colors hover:border-rule-2 hover:text-brand-ink"
              >
                <span className={`h-3 w-3 border border-current ${resolvedTheme === "dark" ? "bg-current" : ""}`} aria-hidden="true" />
              </button>
            )}
            <Link href="/login" className="hidden px-3 py-2 text-[13px] text-ink-2 transition-colors hover:text-brand-ink sm:block">
              {AUTH.signIn}
            </Link>
            <Link href="/login" className="ctl ctl-primary ctl-sm">
              {AUTH.signUp}
            </Link>
          </div>
        </div>
        <TickerTape items={tape} />
      </header>

      <main className="mx-auto w-full max-w-[76rem] flex-1 px-5 sm:px-8">
        {/* ── lead ───────────────────────────────────────────────────── */}
        <section className="pb-16 pt-14 sm:pb-24 sm:pt-20">
          <SectionRule
            label={HERO.kicker}
            meta={<DocRef code="TRX-MKT-0001" />}
            className="mb-12"
          />

          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-8">
              {/* the italic is doing real work — it's the one place on the
                  page the serif is allowed to be expressive, and it lands on
                  the two words that carry the whole premise */}
              <h1 className="display reveal text-[clamp(2.75rem,8vw,5.75rem)] text-ink">
                A market in
                <br />
                <span className="swipe">open source.</span>
              </h1>

              <p className="reveal prose-measure mt-8 text-base leading-relaxed text-ink-2 sm:text-lg" style={{ "--i": 1 } as React.CSSProperties}>
                {HERO.dek}
              </p>

              <div className="reveal mt-10 flex flex-wrap items-center gap-3" style={{ "--i": 2 } as React.CSSProperties}>
                <Link href="/login" className="ctl ctl-primary">
                  {HERO.primary}
                </Link>
                <a href="#mechanics" className="ctl">
                  {HERO.secondary}
                </a>
              </div>
            </div>

            {/* right rail — the session block. Real figures, stated flatly,
                the way a masthead states its edition and price. */}
            <aside className="reveal lg:col-span-4 lg:pl-8" style={{ "--i": 3 } as React.CSSProperties}>
              <dl className="border-t border-rule-2">
                {[
                  { term: LABELS.session, value: <span className="inline-flex items-center gap-2"><LiveDot />Continuous</span> },
                  { term: "Listings", value: count(listings.length) },
                  { term: "Opening capital", value: usd(100000) },
                  { term: "Settlement", value: "T+0" },
                ].map((row) => (
                  <div key={row.term} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <dt className="label">{row.term}</dt>
                    <dd className="figure text-[13px] text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="ref mt-3 block leading-relaxed">
                {live ? "Quotes live from the data engine." : "Quotes unavailable. Showing last known board."}
              </p>
            </aside>
          </div>
        </section>

        {/* ── the board ──────────────────────────────────────────────── */}
        <section className="pb-20 sm:pb-28">
          <SectionRule
            label={SECTIONS.board}
            meta={`${count(board.length)} of ${count(listings.length)} listings`}
            className="mb-6"
          />

          <div className="overflow-x-auto no-bar">
            <table className="board min-w-[36rem]">
              <thead>
                <tr>
                  <th>{COLUMNS.listing}</th>
                  <th className="text-right">{COLUMNS.mark}</th>
                  <th className="text-right">{COLUMNS.change}</th>
                  <th className="hidden text-right sm:table-cell">{COLUMNS.stars}</th>
                  <th className="w-[76px]" />
                </tr>
              </thead>
              <tbody>
                {board.map((l, i) => {
                  const { owner, repo } = tickerParts(l.ticker);
                  return (
                    <tr key={l.ticker} className="reveal" style={{ "--i": i } as React.CSSProperties}>
                      <td>
                        {/* links to /login rather than the asset page: that
                            route has no logged-out state and hard-redirects,
                            so pointing at it would flash a page and bounce */}
                        <Link href="/login" className="group block">
                          <span className="figure block text-[13px] font-medium uppercase text-ink transition-colors group-hover:text-brand-ink">
                            {repo}
                          </span>
                          <span className="figure block text-[11px] text-ink-3">{owner}</span>
                        </Link>
                      </td>
                      <td className="num text-[13px] text-ink">{usd(l.current_price)}</td>
                      <td className={`num text-[13px] ${toneClass(l.delta)}`}>
                        {l.delta === null ? "—" : pct(l.delta)}
                      </td>
                      <td className="num hidden text-[13px] text-ink-2 sm:table-cell">
                        {countCompact(l.raw_stars)}
                      </td>
                      <td className="pr-3 text-right">
                        <MiniSparkline
                          data={l.sparkline}
                          positive={(l.delta ?? 0) >= 0}
                          className="inline-block align-middle"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── procedure ──────────────────────────────────────────────── */}
        <section className="pb-20 sm:pb-28">
          <SectionRule label={SECTIONS.clauses} className="mb-10" />
          <div className="grid gap-10 md:grid-cols-3 md:gap-12">
            {CLAUSES.map((c) => (
              <article key={c.n}>
                {/* § and the number set in mono, the way a statute numbers
                    itself — this is the cheapest, most legible way to make
                    three paragraphs read as a procedure rather than as
                    three feature blurbs */}
                <div className="mb-4 flex items-baseline gap-2 border-b border-rule pb-3">
                  <span className="figure text-[13px] text-brand-ink">§</span>
                  <span className="figure text-[13px] text-ink-3">{c.n}</span>
                  <span className="label label-ink ml-1">{c.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-ink-2">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── mechanics ──────────────────────────────────────────────── */}
        <section id="mechanics" className="scroll-mt-24 pb-20 sm:pb-28">
          <SectionRule label={SECTIONS.mechanics} className="mb-6" />
          <dl className="border-t border-rule-2">
            {MECHANICS.map((m) => (
              <div
                key={m.term}
                className="grid grid-cols-1 gap-1 border-b border-rule py-4 sm:grid-cols-12 sm:gap-6 sm:py-3.5"
              >
                <dt className="label sm:col-span-3 sm:pt-0.5">{m.term}</dt>
                <dd className="text-sm leading-relaxed text-ink sm:col-span-9">{m.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── admission ──────────────────────────────────────────────── */}
        <section className="pb-20 sm:pb-28">
          <div className="relative border border-rule-2 bg-paper-2 px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* the seal, oversized and nearly invisible, sitting behind the
                block — a watermark, which is what an institution puts on a
                document it wants to look official */}
            <Mark className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 text-brand-ink opacity-[0.055]" />
            <div className="relative">
              <p className="label mb-5">{CTA.kicker}</p>
              <h2 className="display mx-auto max-w-xl text-[clamp(1.85rem,4.5vw,3rem)] text-ink">
                {CTA.headline}
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-ink-2">{CTA.body}</p>
              <Link href="/login" className="ctl ctl-primary mt-9">
                {CTA.action}
              </Link>
            </div>
          </div>
        </section>

        {/* ── notice ─────────────────────────────────────────────────── */}
        <section className="pb-20 sm:pb-24">
          <Notice label={NOTICE.label} tone="brand">
            {NOTICE.body}
          </Notice>
        </section>
      </main>

      {/* ── colophon ─────────────────────────────────────────────────── */}
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div>
            <Wordmark size="sm" />
            <p className="ref mt-3 max-w-sm leading-relaxed">{FOOTER.colophon}</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:items-end">
            <DocRef code="TRX-MKT-0001" />
            <span className="ref">{FOOTER.rights(new Date().getFullYear())}</span>
            <span className="ref">{BRAND.est}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
