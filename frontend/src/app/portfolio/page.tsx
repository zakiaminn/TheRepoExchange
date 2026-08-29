"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { SectionRule, DocRef, Panel, Empty, Skeleton, SkeletonBoard, Delta, LiveDot, LiveClock } from "@/components/ui";
import { usd, signedUsd, count, change, toneClass, tickerParts, plural } from "@/lib/format";
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
      <div className="flex-1 pb-20">
        <main className="mx-auto w-full max-w-[64rem] px-5 py-10 sm:px-8 sm:py-12">
          <Skeleton className="h-3 w-24" />
          <div className="mt-8 border-b border-rule-2 pb-10">
            <Skeleton className="h-14 w-80 max-w-full" />
            <Skeleton className="mt-4 h-4 w-48" />
          </div>
          <div className="mt-10">
            <SkeletonBoard rows={5} />
          </div>
        </main>
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

        {/* ── the statement head ─────────────────────────────────────────
            A statement reconciles to one number and shows its work. Left:
            the net asset value, marked live against the same quotes as the
            board. Right: the reconciliation — cash plus positions is the
            value; cost basis against the mark is the unrealised. Every line
            is arithmetic on figures you can check on the board. */}
        <div className="grid gap-x-12 gap-y-9 border-b border-rule-2 pb-10 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <div className="label mb-3">{LABELS.netWorth}</div>
            <div className="display text-[clamp(2.5rem,9vw,4.75rem)] leading-none text-ink">
              {usd(netWorth)}
            </div>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`figure text-base ${toneClass(unrealised)}`}>
                {signedUsd(unrealised)}
              </span>
              <Delta value={unrealisedPct} className="text-base" />
              <span className="label">{LABELS.unrealised}</span>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-2">
              <LiveDot />
              Marked continuously
              <span className="text-rule-2" aria-hidden="true">·</span>
              <LiveClock className="text-[12px]" />
            </p>
          </div>

          {/* reconciliation ledger — cash + positions rule up to the value,
              then cost basis and the unrealised sit below the line */}
          <dl className="border-t border-rule-2">
            <div className="flex items-baseline justify-between border-b border-rule py-2.5">
              <dt className="text-[13px] text-ink-2">{LABELS.cash}</dt>
              <dd className="figure text-[13px] text-ink">{usd(cash)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-rule py-2.5">
              <dt className="text-[13px] text-ink-2">
                {LABELS.positionsValue}
                <span className="ref ml-2">{plural(portfolio.length, "listing")}</span>
              </dt>
              <dd className="figure text-[13px] text-ink">{usd(positionsValue)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b-2 border-rule-2 py-2.5">
              <dt className="label label-ink">{LABELS.netWorth}</dt>
              <dd className="figure text-sm text-ink">{usd(netWorth)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-rule py-2.5">
              <dt className="text-[13px] text-ink-2">Cost basis</dt>
              <dd className="figure text-[13px] text-ink-2">{usd(costBasis)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-2.5">
              <dt className="text-[13px] text-ink-2">{LABELS.unrealised}</dt>
              <dd className={`figure text-[13px] ${toneClass(unrealised)}`}>{signedUsd(unrealised)}</dd>
            </div>
          </dl>
        </div>

        {/* ── allocation ─────────────────────────────────────────────────
            The one split that means anything here: deployed against cash.
            A colour per holding would look like a pie and say nothing. */}
        <section className="mt-10">
          <SectionRule label={SECTIONS.allocation} meta={`${investedShare.toFixed(1)}% deployed`} className="mb-4" />
          <div className="flex h-2 w-full overflow-hidden border border-rule">
            <div
              className="bg-brand transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(0, investedShare))}%` }}
              aria-hidden="true"
            />
            <div className="flex-1 bg-paper-3" aria-hidden="true" />
          </div>
          <div className="mt-2 flex justify-between">
            <span className="ref">{LABELS.positionsValue} · {usd(positionsValue)}</span>
            <span className="ref">{LABELS.cash} · {usd(cash)}</span>
          </div>
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
                <table className="board min-w-[52rem]">
                  <thead>
                    <tr>
                      <th>{COLUMNS.listing}</th>
                      <th className="text-right">{COLUMNS.qty}</th>
                      <th className="text-right">{COLUMNS.avg}</th>
                      <th className="text-right">{COLUMNS.mark}</th>
                      <th className="text-right">{COLUMNS.value}</th>
                      <th className="hidden text-right sm:table-cell">{COLUMNS.weight}</th>
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
                      const weight = positionsValue > 0 ? (value / positionsValue) * 100 : 0;
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
                          <td className="hidden pr-3 align-middle sm:table-cell">
                            {/* weight = this position's share of the book. the
                                bar makes concentration legible at a glance */}
                            <div className="flex items-center justify-end gap-2">
                              <span className="figure text-[12px] text-ink-2">{weight.toFixed(1)}%</span>
                              <span className="inline-block h-1 w-12 bg-paper-3" aria-hidden="true">
                                <span
                                  className="block h-full bg-brand"
                                  style={{ width: `${Math.min(100, weight)}%` }}
                                />
                              </span>
                            </div>
                          </td>
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
