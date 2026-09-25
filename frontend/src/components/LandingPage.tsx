"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/Logo";
import { MiniSparkline } from "@/components/MiniSparkline";
import { SectionRule, Notice } from "@/components/ui";
import { SecurityPaper } from "@/components/SecurityPaper";
import { Reveal } from "@/components/Reveal";
import { PriceField, type FieldSeries } from "@/components/PriceField";
import { Footage, FootagePause } from "@/components/Footage";
import { usd, pct, count, countCompact, change, toneClass, tickerParts } from "@/lib/format";
import { BRAND, HERO, MECHANICS, CLAUSES, NOTICE, CTA, SECTIONS, COLUMNS, AUTH, FOOTER, LANDING, STATE } from "@/lib/copy";
import type { DiscoveryResponse } from "@/lib/api";

type Listing = {
  ticker: string;
  current_price: number;
  raw_stars: number;
  sparkline: number[];
  category: string;
};

// sample listings, shown only if the discovery api can't be reached
const FALLBACK: Listing[] = [
  { ticker: "facebook/react",   current_price: 2335.23, raw_stars: 233523, sparkline: [2294.1, 2301.4, 2288.9, 2310.2, 2305.6, 2318.0, 2325.7, 2320.4, 2331.1, 2335.23], category: "frontend" },
  { ticker: "vercel/next.js",   current_price: 1271.50, raw_stars: 127150, sparkline: [1232.0, 1238.6, 1229.4, 1244.8, 1251.2, 1247.9, 1258.3, 1263.0, 1267.4, 1271.50], category: "frontend" },
  { ticker: "rust-lang/rust",   current_price:  992.10, raw_stars:  99210, sparkline: [996.0, 997.8, 995.1, 993.4, 996.2, 994.7, 991.8, 993.0, 992.6, 992.10],       category: "systems"  },
  { ticker: "oven-sh/bun",      current_price:  536.78, raw_stars:  53678, sparkline: [501.2, 505.9, 511.3, 509.8, 516.4, 521.0, 526.7, 530.1, 534.2, 536.78],       category: "runtimes" },
  { ticker: "ollama/ollama",    current_price: 1489.40, raw_stars: 148940, sparkline: [1454.0, 1461.2, 1457.8, 1466.5, 1472.1, 1469.3, 1477.0, 1481.6, 1486.2, 1489.40], category: "ai"    },
  { ticker: "denoland/deno",    current_price: 1043.60, raw_stars: 104360, sparkline: [1056.3, 1054.1, 1051.8, 1052.9, 1049.4, 1047.2, 1048.0, 1045.5, 1044.8, 1043.60], category: "runtimes" },
];

// the logged-out home page. page.tsx shows this when there's no session, so it has its
// own nav. it runs in panels alternating dark and light: the market as a field of price
// lines, an index of what you can do, a panel per feature with a screen recording, then
// the listings, how it works, the mechanics and the notice
export function LandingPage() {
  const [listings, setListings] = useState<Listing[]>(FALLBACK);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  // the bar floats clear over the dark hero and turns solid once you're past it
  const [overHero, setOverHero] = useState(true);
  const heroRef = useRef<HTMLElement>(null);

  // discovery is public, so the front page shows the actual market. it polls once a
  // minute while the tab is visible so the hero's lines can flash when a price moves
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const flat: Listing[] = Object.entries(data as DiscoveryResponse).flatMap(([category, repos]) =>
          repos.map((r) => ({
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
        // the sample listings stay up
        setFailed(true);
      }
    };
    load();
    const id = window.setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setOverHero(e.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  const withChange = listings.map((l) => ({
    ...l,
    delta: l.sparkline.length > 1 ? change(l.sparkline[0], l.sparkline[l.sparkline.length - 1]) : null,
  }));

  // the front page shows the ten most valuable listings: a summary of the
  // market, not a directory of it
  const board = [...withChange].sort((a, b) => b.current_price - a.current_price).slice(0, 10);

  // the hero waits for real prices; the sample listings only stand in if the
  // fetch fails, so it never draws six lines and then swaps to a hundred
  const field: FieldSeries[] = useMemo(
    () =>
      live || failed
        ? listings.map((l) => ({ ticker: l.ticker, price: l.current_price, points: l.sparkline }))
        : [],
    [listings, live, failed]
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* masthead */}
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-200 ${
          overHero ? "night border-transparent bg-transparent" : "border-rule bg-[var(--paper)]/92 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-[76rem] items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/" aria-label={BRAND.full}>
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden px-3 py-2 text-[13px] text-ink-2 sig sm:block">
              {AUTH.signIn}
            </Link>
            <Link href="/login?mode=signup" className="ctl ctl-primary ctl-sm">
              {AUTH.signUp}
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section ref={heroRef} className="night relative overflow-hidden">
        <PriceField series={field} />

        {/* the copy layer lets the pointer through to the lines behind it,
            except on the things you can actually click */}
        <div className="pointer-events-none relative z-10 mx-auto flex min-h-[min(100svh,60rem)] max-w-[76rem] flex-col px-5 pt-14 sm:px-8">
          <div className="flex flex-1 flex-col justify-center py-16 sm:py-24 lg:max-w-[42rem]">
            <h1 className="display reveal text-[clamp(2.75rem,8vw,5.75rem)] text-ink">
              A market in
              <br />
              <span className="swipe swipe-in">open source.</span>
            </h1>
            <p className="reveal prose-measure mt-8 text-base leading-relaxed text-ink-2 sm:text-lg" style={{ "--i": 1 } as React.CSSProperties}>
              {HERO.dek}
            </p>
            <div className="reveal pointer-events-auto mt-10 flex flex-wrap items-center gap-3" style={{ "--i": 2 } as React.CSSProperties}>
              <Link href="/login?mode=signup" className="ctl ctl-primary ctl-lg">
                {HERO.primary}
              </Link>
              <a href="#mechanics" className="ctl ctl-lg">
                {HERO.secondary}
              </a>
            </div>
          </div>

          {/* the key facts along the bottom of the panel */}
          <dl className="reveal grid grid-cols-2 border-t border-rule-2 sm:grid-cols-4" style={{ "--i": 3 } as React.CSSProperties}>
            {[
              { term: "Listings", value: <span className="figure">{count(listings.length)}</span> },
              { term: "Opening capital", value: <span className="figure">{usd(100000)}</span> },
              { term: "Settlement", value: "Immediate" },
              { term: "Hours", value: "Continuous" },
            ].map((row, i) => (
              <div key={row.term} className={`py-4 ${i % 2 === 1 ? "pl-4 sm:pl-5" : ""} ${i === 2 ? "sm:pl-5" : ""} ${i >= 2 ? "border-t border-rule sm:border-t-0" : ""} ${i > 0 ? "sm:border-l sm:border-rule" : ""}`}>
                <dt className="label mb-1.5">{row.term}</dt>
                <dd className="text-[15px] text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="pb-5 text-[11px] leading-relaxed text-ink-3">
            {live ? LANDING.fieldNote : failed ? "Prices unavailable. Showing sample listings." : STATE.quotes}
          </p>
        </div>
      </section>

      <main className="flex-1">
        {/* index */}
        <section className="mx-auto max-w-[76rem] px-5 py-24 sm:px-8 sm:py-36">
          <Reveal stagger>
            <nav aria-label="Sections">
              <ul className="flex flex-col items-center">
                {LANDING.index.map((it, i) => (
                  <li key={it.word} className="stagger-item" style={{ "--i": i } as React.CSSProperties}>
                    <a
                      href={it.href}
                      className="display block text-[clamp(3.5rem,11vw,8.5rem)] leading-[1.04] text-ink sig"
                    >
                      {it.word}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
        </section>

        <FeaturePanel
          id="trade"
          {...LANDING.trade}
          href="/login?mode=signup"
          primary
          media={
            <Footage
              label="Buying from the listings table"
              aspect="1400 / 940"
              clip={{ mp4: "/landing/trade.mp4", webm: "/landing/trade.webm", poster: "/landing/trade.jpg" }}
            />
          }
        />

        {/* on a phone */}
        <section className="mx-auto grid max-w-[76rem] items-center gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-6 lg:col-start-2">
            <span className="label">{LANDING.phone.kicker}</span>
            <h2 className="display mt-4 text-[clamp(2.25rem,5vw,3.75rem)] text-ink">{LANDING.phone.title}</h2>
            <p className="prose-measure mt-6 text-base leading-relaxed text-ink-2">{LANDING.phone.body}</p>
          </Reveal>
          <Reveal className="lg:col-span-4">
            <Footage
              phone
              label="Buying on a phone"
              aspect="600 / 1180"
              clip={{ mp4: "/landing/phone.mp4", webm: "/landing/phone.webm", poster: "/landing/phone.jpg" }}
            />
          </Reveal>
        </section>

        <FeaturePanel
          id="call"
          {...LANDING.call}
          href="/faq"
          flip
          media={
            <Footage
              label="The calls page"
              aspect="1240 / 774"
              clip={{ mp4: "/landing/call.mp4", webm: "/landing/call.webm", poster: "/landing/call.jpg" }}
            />
          }
        />

        <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
          {/* statement */}
          <section className="py-24 sm:py-36">
            <Reveal>
              <h2 className="display max-w-[16ch] text-[clamp(2.5rem,6.5vw,5rem)] text-ink">
                {LANDING.statement.title}
              </h2>
              <p className="prose-measure mt-8 text-base leading-relaxed text-ink-2 sm:text-lg">
                {LANDING.statement.body}
              </p>
            </Reveal>
          </section>
        </div>

        <FeaturePanel
          id="verify"
          {...LANDING.verify}
          href="#mechanics"
          media={
            <Footage
              label="A listing's price history"
              aspect="1240 / 774"
              clip={{ mp4: "/landing/verify.mp4", webm: "/landing/verify.webm", poster: "/landing/verify.jpg" }}
            />
          }
        />

        <div className="mx-auto w-full max-w-[76rem] px-5 pt-24 sm:px-8 sm:pt-32">
        {/* the board */}
        <section className="pb-20 sm:pb-28">
          <SectionRule
            label={SECTIONS.board}
            meta={<Link href="/listings" className="link">All {count(listings.length)} listings</Link>}
            className="mb-6"
          />

          <Reveal stagger className="overflow-x-auto no-bar">
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
                    <tr key={l.ticker} className="stagger-item" style={{ "--i": i } as React.CSSProperties}>
                      <td>
                        <Link href={`/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`} className="group block">
                          <span className="block text-[13px] font-medium uppercase text-ink sig">
                            {repo}
                          </span>
                          <span className="block text-[11px] text-ink-3">{owner}</span>
                        </Link>
                      </td>
                      <td className="num text-[13px] text-ink">{usd(l.current_price)}</td>
                      <td className={`num text-[13px] ${toneClass(l.delta)}`}>
                        {l.delta === null ? "-" : pct(l.delta)}
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
          </Reveal>
        </section>

        {/* how it works */}
        <section className="pb-20 sm:pb-28">
          <Reveal>
            <div className="grid gap-10 md:grid-cols-3 md:gap-12">
              {CLAUSES.map((c) => (
                <article key={c.title}>
                  <div className="mb-4 border-b border-rule pb-3">
                    <span className="label label-ink">{c.title}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-2">{c.body}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        {/* mechanics */}
        <section id="mechanics" className="scroll-mt-24 pb-20 sm:pb-28">
          <Reveal>
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
          </Reveal>
        </section>

        {/* sign-up */}
        <section className="pb-20 sm:pb-28">
          <Reveal>
            <div className="relative overflow-hidden border border-rule-2 bg-paper-2">
              {/* the engraved rosette, oversized and nearly invisible, behind
                  the copy side of the block */}
              <SecurityPaper className="veil pointer-events-none absolute -left-24 top-1/2 z-0 h-[30rem] w-[30rem] -translate-y-1/2 text-brand-ink opacity-[0.06] sm:h-[36rem] sm:w-[36rem] dark:opacity-[0.09]" />
              <div className="relative z-10 grid items-center gap-10 px-6 py-14 sm:px-12 sm:py-20 lg:grid-cols-12 lg:gap-14">
                <div className="lg:col-span-5">
                  <h2 className="display max-w-md text-[clamp(1.85rem,4.5vw,3rem)] text-ink">
                    {CTA.headline}
                  </h2>
                  <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-2">{CTA.body}</p>
                  <Link href="/login?mode=signup" className="ctl ctl-primary ctl-lg mt-9">
                    {CTA.action}
                  </Link>
                </div>
                {/* the name morph, zoomed in on the path the name travels and
                    slowed to 40% through the flight so it can be followed */}
                <figure className="lg:col-span-7">
                  <Footage
                    label="A listing name carrying into its page"
                    aspect="800 / 500"
                    clip={{ mp4: "/landing/morph.mp4", webm: "/landing/morph.webm", poster: "/landing/morph.jpg" }}
                  />
                  <figcaption className="mt-3 text-[12px] leading-relaxed text-ink-3">{LANDING.morph}</figcaption>
                </figure>
              </div>
            </div>
          </Reveal>
        </section>

        {/* notice */}
        <section className="pb-20 sm:pb-24">
          <Reveal>
            <Notice tone="brand">
              {NOTICE.body}
            </Notice>
          </Reveal>
        </section>
        </div>
      </main>

      {/* colophon */}
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div>
            <Wordmark size="sm" />
            <p className="ref mt-3 max-w-sm leading-relaxed">{FOOTER.colophon}</p>
            <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Site">
              <Link href="/faq" className="ref sig">FAQ</Link>
              <Link href="/legal/terms" className="ref sig">Terms</Link>
              <Link href="/legal/privacy" className="ref sig">Privacy</Link>
              <Link href="/legal/disclaimer" className="ref sig">Disclaimer</Link>
            </nav>
          </div>
          <div className="flex flex-col gap-1.5 sm:items-end">
            <span className="ref">{FOOTER.rights(new Date().getFullYear())}</span>
          </div>
        </div>
      </footer>

      <FootagePause />
    </div>
  );
}

// one dark panel with the copy on one side and the recording on the other. `flip` swaps
// the sides on wide screens so consecutive panels alternate
function FeaturePanel({
  id,
  kicker,
  title,
  body,
  link,
  href,
  media,
  flip,
  primary,
}: {
  id: string;
  kicker: string;
  title: string;
  body: string;
  link: string;
  href: string;
  media: React.ReactNode;
  flip?: boolean;
  primary?: boolean;
}) {
  const cls = `ctl ${primary ? "ctl-primary" : ""} mt-9`;
  const label = (
    <>
      {link}
      <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
    </>
  );
  return (
    <section id={id} className="night scroll-mt-14">
      <div className="mx-auto grid max-w-[76rem] items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:gap-16">
        <Reveal className={`lg:col-span-5 ${flip ? "lg:order-2" : ""}`}>
          <span className="label">{kicker}</span>
          <h2 className="display mt-4 text-[clamp(2.25rem,5vw,3.75rem)] text-ink">{title}</h2>
          <p className="prose-measure mt-6 text-base leading-relaxed text-ink-2">{body}</p>
          {href.startsWith("#") ? (
            <a href={href} className={cls}>{label}</a>
          ) : (
            <Link href={href} className={cls}>{label}</Link>
          )}
        </Reveal>
        <Reveal className="lg:col-span-7">{media}</Reveal>
      </div>
    </section>
  );
}
