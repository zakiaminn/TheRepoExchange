"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { SectionRule, DocRef, Panel, Empty, Pending, Delta } from "@/components/ui";
import { usd, signedUsd, count, change, toneClass, tickerParts } from "@/lib/format";
import { SECTIONS, COLUMNS, LABELS, STATE, ERROR } from "@/lib/copy";

type Holding = {
  ticker: string;
  shares: number;
  average_price: string | number;
  current_price: string | number;
};

/* the portfolio page. net worth, what it's made of, and the holdings. laid out
   like a brokerage statement: one big number up top, the cash/positions
   breakdown under it, then every position listed out row by row. */
export default function PortfolioPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) window.location.href = "/login";
      else setUserId(user.id);
    };
    check();
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const opts = { headers: { Authorization: `Bearer ${session.access_token}` } };

        // both in flight at once rather than in sequence — halves the wait
        const [balanceRes, portfolioRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${userId}`, opts),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${userId}`, opts),
        ]);

        if (balanceRes.ok) setBalance(Number((await balanceRes.json()).balance));
        if (portfolioRes.ok) setPortfolio((await portfolioRes.json()).portfolio || []);
      } catch {
        console.error(ERROR.ledger);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, supabase.auth]);

  // everything below is arithmetic on data already fetched — no extra calls
  const cash = balance ?? 0;
  const positionsValue = portfolio.reduce(
    (sum, h) => sum + h.shares * Number(h.current_price),
    0
  );
  const netWorth = cash + positionsValue;
  const costBasis = portfolio.reduce(
    (sum, h) => sum + h.shares * Number(h.average_price),
    0
  );
  const unrealised = positionsValue - costBasis;
  const unrealisedPct = costBasis > 0 ? (unrealised / costBasis) * 100 : null;
  const investedShare = netWorth > 0 ? (positionsValue / netWorth) * 100 : 0;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Pending>{STATE.portfolio}</Pending>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-20">
      <main className="mx-auto w-full max-w-[64rem] px-5 py-10 sm:px-8 sm:py-12">
        <SectionRule
          label={SECTIONS.summary}
          meta={<DocRef code="TRX-ACC-0001" />}
          className="mb-10"
        />

        {/* ── net asset value ────────────────────────────────────────── */}
        <div className="border-b border-rule-2 pb-10">
          <div className="label mb-3">{LABELS.netWorth}</div>
          {/* the one place the serif carries a figure. At this size
              Newsreader's lining numerals are the most expensive-looking
              thing on the site, and it costs nothing to use them */}
          <div className="display text-[clamp(2.75rem,11vw,5.5rem)] leading-none text-ink">
            {usd(netWorth)}
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`figure text-base ${toneClass(unrealised)}`}>
              {signedUsd(unrealised)}
            </span>
            <Delta value={unrealisedPct} className="text-base" />
            <span className="label">{LABELS.unrealised}</span>
          </div>
        </div>

        {/* ── composition ────────────────────────────────────────────── */}
        <section className="mt-10">
          <SectionRule label={SECTIONS.allocation} className="mb-5" />

          {/* Two segments, one chroma. A colour per holding would look like
              a pie chart and mean nothing — the only split that matters here
              is deployed against undeployed. */}
          <div className="flex h-2 w-full overflow-hidden border border-rule">
            <div
              className="bg-brand transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, investedShare))}%` }}
              aria-hidden="true"
            />
            <div className="flex-1 bg-paper-3" aria-hidden="true" />
          </div>

          <dl className="mt-px grid grid-cols-1 border-x border-b border-rule sm:grid-cols-3">
            {[
              { term: LABELS.cash, value: usd(cash), note: `${(100 - investedShare).toFixed(1)}% undeployed` },
              { term: LABELS.positionsValue, value: usd(positionsValue), note: `${investedShare.toFixed(1)}% deployed` },
              { term: "Cost basis", value: usd(costBasis), note: `${count(portfolio.length)} listings` },
            ].map((row, i) => (
              <div
                key={row.term}
                className={`px-4 py-4 ${i < 2 ? "border-b border-rule sm:border-b-0 sm:border-r" : ""}`}
              >
                <dt className="label mb-1.5">{row.term}</dt>
                <dd className="figure text-lg text-ink">{row.value}</dd>
                <dd className="ref mt-1 block">{row.note}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── the book ───────────────────────────────────────────────── */}
        <section className="mt-12">
          <SectionRule
            label={SECTIONS.holdings}
            meta={`${count(portfolio.length)} of record`}
            className="mb-5"
          />

          <Panel>
            {portfolio.length === 0 ? (
              <Empty>
                {STATE.noPositions}{" "}
                <Link href="/" className="link">
                  View the board
                </Link>
                .
              </Empty>
            ) : (
              <div className="overflow-x-auto no-bar">
                <table className="board min-w-[44rem]">
                  <thead>
                    <tr>
                      <th>{COLUMNS.listing}</th>
                      <th className="text-right">{COLUMNS.qty}</th>
                      <th className="text-right">{COLUMNS.avg}</th>
                      <th className="text-right">{COLUMNS.mark}</th>
                      <th className="text-right">{COLUMNS.value}</th>
                      <th className="text-right">{COLUMNS.pnl}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((h) => {
                      const mark = Number(h.current_price);
                      const avg = Number(h.average_price);
                      const value = mark * h.shares;
                      const pnl = (mark - avg) * h.shares;
                      const pnlPct = change(avg, mark);
                      const { owner, repo } = tickerParts(h.ticker);

                      return (
                        <tr key={h.ticker}>
                          <td className="max-w-0">
                            <Link
                              href={`/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`}
                              className="group block"
                            >
                              <span className="figure block truncate text-[13px] font-medium uppercase text-ink transition-colors group-hover:text-brand-ink">
                                {repo}
                              </span>
                              <span className="figure block truncate text-[11px] text-ink-3">
                                {owner}
                              </span>
                            </Link>
                          </td>
                          <td className="num text-[13px] text-ink">{count(h.shares)}</td>
                          <td className="num text-[13px] text-ink-2">{usd(avg)}</td>
                          <td className="num text-[13px] text-ink">{usd(mark)}</td>
                          <td className="num text-[13px] text-ink">{usd(value)}</td>
                          <td className="num pr-3">
                            <div className={`text-[13px] ${toneClass(pnl)}`}>{signedUsd(pnl)}</div>
                            <Delta value={pnlPct} className="text-[11px]" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
}
