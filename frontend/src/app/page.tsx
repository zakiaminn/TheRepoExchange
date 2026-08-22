"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { LandingPage } from "@/components/LandingPage";
import { Toast, ToastMessage } from "@/components/Toast";
import { ConfirmTradeModal } from "@/components/ConfirmTradeModal";
import { MiniSparkline } from "@/components/MiniSparkline";
import { SectionRule, DocRef, Empty, Pending, LiveDot } from "@/components/ui";
import { usd, pct, count, countCompact, change, toneClass, tickerParts } from "@/lib/format";
import { SECTIONS, COLUMNS, LABELS, STATE, ERROR, ORDER } from "@/lib/copy";

type Repository = {
  ticker: string;
  current_price: number;
  description: string;
  category: string;
  raw_stars: number;
  sparkline: number[];
};

type Holding = { ticker: string; shares: number; average_price: number };

type PendingTrade = { ticker: string; quantity: number; price: number } | null;

/* the logged-in home page. two real structural changes from the old version,
   both about showing more info rather than looking nicer:

   1. the discovery feed used to be a side-scrolling row of cards. now it's a
      board — one ruled table per category. tables put every listing on the
      same baseline so you can actually compare prices, fit four columns where
      a card fit one, and don't hide half the market off the right edge.

   2. each row has one button. quantity gets set in the order ticket (where you
      can see the maths) instead of a giant number box on every card. */
export default function Terminal() {
  const [discovery, setDiscovery] = useState<Record<string, Repository[]>>({});
  const [message, setMessage] = useState<ToastMessage>(null);
  const [pending, setPending] = useState<PendingTrade>(null);
  const [processing, setProcessing] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);

  // the tick: last seen mark per listing, so a poll can tell which figures
  // actually moved and flash only those
  const lastMarks = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, "pos" | "neg">>({});

  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setInitializing(false);
    };
    check();
  }, [supabase.auth]);

  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setBalance(Number((await res.json()).balance));
    } catch {
      console.error(ERROR.ledger);
    }
  };

  const fetchPortfolio = async () => {
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setPortfolio((await res.json()).portfolio || []);
    } catch {
      console.error(ERROR.ledger);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchPortfolio();
      fetchBalance();
    }

    // discovery is the same for everyone and needs no auth, so it runs
    // regardless of session state
    const fetchDiscovery = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) return;
        const data = await res.json();
        setDiscovery(data);

        // work out which marks moved on this poll and flash just those.
        // The number itself changes instantly — only the surface animates,
        // which is exactly how a real quote board behaves.
        const moved: Record<string, "pos" | "neg"> = {};
        (Object.values(data).flat() as Repository[]).forEach((r) => {
          const prev = lastMarks.current[r.ticker];
          const now = Number(r.current_price);
          if (prev !== undefined && now !== prev) moved[r.ticker] = now > prev ? "pos" : "neg";
          lastMarks.current[r.ticker] = now;
        });
        if (Object.keys(moved).length > 0) {
          setFlash(moved);
          window.setTimeout(() => setFlash({}), 900);
        }
      } catch {
        console.error(ERROR.engine);
      }
    };

    fetchDiscovery();
    const interval = setInterval(fetchDiscovery, 5000);
    return () => clearInterval(interval); // otherwise it polls forever after unmount
  }, [userId]);

  const confirmTrade = async () => {
    if (!pending || !userId) return;
    const { ticker, quantity, price } = pending;

    setProcessing(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticker, shares: quantity, expectedPrice: Number(price) }),
      });
      const result = await res.json();

      if (res.ok) {
        setMessage({ text: ORDER.filled("BUY", quantity, ticker, usd(price)), type: "success" });
        fetchBalance();
        fetchPortfolio();
      } else {
        setMessage({ text: ORDER.rejected(result.error), type: "error" });
      }
    } catch {
      setMessage({ text: ERROR.ledgerRefused, type: "error" });
    } finally {
      setProcessing(false);
      setPending(null);
      setTimeout(() => setMessage(null), 4500);
    }
  };

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Pending>{STATE.session}</Pending>
      </div>
    );
  }

  if (!userId) return <LandingPage />;

  const categories = Object.entries(discovery);
  const totalListings = categories.reduce((n, [, repos]) => n + repos.length, 0);

  return (
    <div className="flex-1">
      <main className="mx-auto w-full max-w-[76rem] px-5 py-10 sm:px-8 sm:py-12">
        {/* ── account strip ────────────────────────────────────────────
            One ruled row: who you are to the exchange, and what you can
            spend. Everything else about the account lives on /portfolio. */}
        <div className="mb-12 border-b border-rule-2 pb-6">
          <SectionRule
            label={SECTIONS.board}
            meta={<DocRef code="TRX-MKT-0442" />}
            className="mb-6"
          />
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display text-[clamp(2rem,5vw,3.25rem)] text-ink">
                The board
              </h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <LiveDot />
                {totalListings > 0
                  ? `${count(totalListings)} listings, marked continuously`
                  : STATE.quotes}
              </p>
            </div>

            <div className="text-right">
              <div className="label mb-1.5">{LABELS.purchasingPower}</div>
              <div className="figure text-2xl text-ink sm:text-3xl">
                {balance !== null ? usd(balance) : <span className="text-ink-3">{STATE.session}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── the boards, one per category ────────────────────────────── */}
        {categories.length === 0 ? (
          <div className="panel">
            <Pending>{STATE.quotes}</Pending>
          </div>
        ) : (
          <div className="space-y-14">
            {categories.map(([category, repos]) => (
              <section key={category}>
                <SectionRule label={category} meta={`${count(repos.length)} listings`} className="mb-5" />
                <div className="overflow-x-auto no-bar">
                  <table className="board min-w-[40rem]">
                    <thead>
                      <tr>
                        <th>{COLUMNS.listing}</th>
                        <th className="text-right">{COLUMNS.mark}</th>
                        <th className="text-right">{COLUMNS.change}</th>
                        <th className="hidden text-right md:table-cell">{COLUMNS.stars}</th>
                        <th className="hidden w-[76px] sm:table-cell" />
                        <th className="w-[92px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {repos.map((repo) => {
                        const { owner, repo: name } = tickerParts(repo.ticker);
                        const delta =
                          repo.sparkline.length > 1
                            ? change(repo.sparkline[0], repo.sparkline[repo.sparkline.length - 1])
                            : null;
                        const tick = flash[repo.ticker];

                        return (
                          <tr key={repo.ticker}>
                            <td className="max-w-0">
                              <Link
                                href={`/asset/${owner.toLowerCase()}/${name.toLowerCase()}`}
                                className="group block"
                              >
                                <span className="figure block truncate text-[13px] font-medium uppercase text-ink transition-colors group-hover:text-brand-ink">
                                  {name}
                                </span>
                                <span className="block truncate text-[11px] text-ink-3">
                                  {repo.description || owner}
                                </span>
                              </Link>
                            </td>
                            <td className={`num text-[13px] text-ink ${tick ? `tick-${tick}` : ""}`}>
                              {usd(repo.current_price)}
                            </td>
                            <td className={`num text-[13px] ${toneClass(delta)}`}>
                              {delta === null ? "—" : pct(delta)}
                            </td>
                            <td className="num hidden text-[13px] text-ink-2 md:table-cell">
                              {countCompact(repo.raw_stars)}
                            </td>
                            <td className="hidden pr-3 text-right sm:table-cell">
                              <MiniSparkline
                                data={repo.sparkline}
                                positive={(delta ?? 0) >= 0}
                                className="inline-block align-middle"
                              />
                            </td>
                            <td className="pr-3 text-right">
                              <button
                                onClick={() =>
                                  setPending({
                                    ticker: repo.ticker,
                                    quantity: 1,
                                    price: Number(repo.current_price),
                                  })
                                }
                                className="ctl ctl-sm ctl-primary"
                                aria-label={`Buy ${repo.ticker}`}
                              >
                                {ORDER.buy}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── positions ───────────────────────────────────────────────── */}
        <section className="mt-16">
          <SectionRule
            label={SECTIONS.positions}
            meta={<Link href="/portfolio" className="link">Full statement</Link>}
            className="mb-5"
          />
          <div className="panel">
            {portfolio.length === 0 ? (
              <Empty>{STATE.noPositions}</Empty>
            ) : (
              <div className="overflow-x-auto no-bar">
                <table className="board min-w-[28rem]">
                  <thead>
                    <tr>
                      <th>{COLUMNS.listing}</th>
                      <th className="text-right">{COLUMNS.qty}</th>
                      <th className="text-right">{COLUMNS.avg}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((h) => {
                      const { owner, repo } = tickerParts(h.ticker);
                      return (
                        <tr key={h.ticker}>
                          <td>
                            <Link
                              href={`/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`}
                              className="figure text-[13px] text-ink transition-colors hover:text-brand-ink"
                            >
                              {h.ticker}
                            </Link>
                          </td>
                          <td className="num text-[13px] text-ink">{count(h.shares)}</td>
                          <td className="num text-[13px] text-ink-2">{usd(h.average_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {pending && (
        <ConfirmTradeModal
          action="BUY"
          ticker={pending.ticker}
          quantity={pending.quantity}
          onQuantityChange={(q) => setPending({ ...pending, quantity: q })}
          price={pending.price}
          balance={balance}
          processing={processing}
          onConfirm={confirmTrade}
          onCancel={() => setPending(null)}
        />
      )}

      <Toast message={message} />
    </div>
  );
}
