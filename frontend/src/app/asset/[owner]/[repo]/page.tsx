"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries, Time } from "lightweight-charts";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "next-themes";
import { Toast, ToastMessage } from "@/components/Toast";
import { ConfirmTradeModal } from "@/components/ConfirmTradeModal";
import { SectionRule, DocRef, Panel, Notice, Skeleton, Delta } from "@/components/ui";
import { usd, count, countCompact, change, toneClass } from "@/lib/format";
import { SECTIONS, LABELS, STATE, ERROR, ORDER, NAV } from "@/lib/copy";

// what each metric is worth per unit — same weights as the pricing formula, shown so
// people can see WHY a repo is priced what it is. issues are the only negative term.
const VALUATION = [
  { key: "raw_stars", label: "Stars", unit: 0.001, neg: false },
  { key: "raw_forks", label: "Forks", unit: 0.01, neg: false },
  { key: "raw_watchers", label: "Watchers", unit: 0.05, neg: false },
  { key: "raw_open_prs", label: "Open PRs", unit: 1.0, neg: false },
  { key: "raw_open_issues", label: "Open issues", unit: 1.0, neg: true },
] as const;

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

type ChartData = { time: Time; value: number };
type PendingTrade = { action: "BUY" | "SELL"; quantity: number } | null;

// Client-side windows over the history we already hold. No extra requests —
// the data is in memory, and an exchange that makes you wait on the network
// to look at last week is not much of an exchange.
const RANGES = [
  { key: "7D", days: 7 },
  { key: "30D", days: 30 },
  { key: "90D", days: 90 },
  { key: "ALL", days: Infinity },
] as const;

/* the single-repo page, treated like a stock: price + its move up top, period
   stats next to it, the chart below, buy/sell ticket last. that order is on
   purpose — you read price, then range, then chart, then decide. leading with
   the buy button is what a casino would do. */
export default function ListingPage(props: PageProps) {
  const params = use(props.params);
  const { owner, repo } = params;
  const ticker = `${owner}/${repo}`.toUpperCase();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [history, setHistory] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [asset, setAsset] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listed, setListed] = useState<boolean | null>(null); // null while unknown
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30D");

  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ownedShares, setOwnedShares] = useState(0);
  const [avgPrice, setAvgPrice] = useState<number | null>(null);
  const [message, setMessage] = useState<ToastMessage>(null);
  const [pending, setPending] = useState<PendingTrade>(null);
  const [processing, setProcessing] = useState<"BUY" | "SELL" | null>(null);

  const { resolvedTheme } = useTheme();
  const supabase = createClient();

  // unlike the home page, there's no logged-out version of this route
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) window.location.href = "/login";
      else setUserId(user.id);
    };
    check();
  }, [supabase]);

  const fetchBalance = async (uid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${uid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setBalance(Number((await res.json()).balance));
    } catch {
      console.error(ERROR.ledger);
    }
  };

  const fetchPosition = async (uid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${uid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // only this listing matters here, not the whole book
      const holding = (data.portfolio || []).find(
        (h: any) => h.ticker.toLowerCase() === ticker.toLowerCase()
      );
      setOwnedShares(holding ? holding.shares : 0);
      setAvgPrice(holding ? Number(holding.average_price) : null);
    } catch {
      console.error(ERROR.ledger);
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetchBalance(userId);
    fetchPosition(userId);
  }, [userId, ticker]);

  // price history, which doubles as the admission check — if the ledger has
  // nothing on file, the repository isn't listed
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${owner}/${repo}`);
        if (!res.ok) {
          setListed(false);
          return;
        }
        const data = await res.json();
        if (data.asset) setAsset(data.asset);

        if (data.history && data.history.length > 0) {
          // dedupe on the unix timestamp in case the engine ever emits two
          // points for one day, then sort so the series draws left to right
          const byTime = new Map<number, number>();
          data.history.forEach((item: any) => {
            byTime.set(Math.floor(new Date(item.time).getTime() / 1000), item.value);
          });
          const series = Array.from(byTime.entries())
            .map(([time, value]) => ({ time: time as Time, value }))
            .sort((a, b) => (a.time as number) - (b.time as number));

          setHistory(series);
          setCurrentPrice(series[series.length - 1].value);
          setListed(true);
        } else {
          setListed(false);
          setError(STATE.noHistory);
        }
      } catch {
        setListed(false);
        setError(ERROR.engine);
      }
    };
    fetchHistory();
  }, [owner, repo]);

  // the visible window, plus everything derived from it
  const view = useMemo(() => {
    const spec = RANGES.find((r) => r.key === range)!;
    const windowed =
      spec.days === Infinity
        ? history
        : history.filter(
            (p) => (p.time as number) >= Date.now() / 1000 - spec.days * 86400
          );
    // never render an empty chart just because the window outran the data
    const data = windowed.length > 1 ? windowed : history;
    const values = data.map((d) => d.value);
    return {
      data,
      high: values.length ? Math.max(...values) : null,
      low: values.length ? Math.min(...values) : null,
      delta: values.length > 1 ? change(values[0], values[values.length - 1]) : null,
      observations: data.length,
    };
  }, [history, range]);

  // The chart is rebuilt from scratch on theme change — lightweight-charts
  // doesn't restyle an existing instance cleanly, and a chart carrying the
  // previous theme's colours is worse than a brief remount.
  useEffect(() => {
    if (!chartContainerRef.current || view.data.length === 0 || listed === false) return;

    const dark = resolvedTheme === "dark";
    // pulled from the Bureau tokens; lightweight-charts needs literal values
    const ink3 = dark ? "#85818C" : "#6E6A75";
    const ink = dark ? "#EDEAE3" : "#16151A";
    const rule = dark ? "#2A2A33" : "#DCD7CC";
    const brand = dark ? "#F5A623" : "#C77A0A";
    const wash = dark ? "rgba(245,166,35,0.16)" : "rgba(199,122,10,0.14)";
    const fade = dark ? "rgba(245,166,35,0)" : "rgba(199,122,10,0)";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: ink3,
        // axis figures in the same mono as every other number in the product
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        // horizontal rules only. Vertical gridlines add a second axis of
        // linework that competes with the series for no informational gain.
        vertLines: { visible: false },
        horzLines: { color: rule },
      },
      crosshair: {
        vertLine: { color: ink, width: 1, style: 3, labelBackgroundColor: ink },
        horzLine: { color: ink, width: 1, style: 3, labelBackgroundColor: ink },
      },
      rightPriceScale: { borderVisible: true, borderColor: rule },
      timeScale: { borderVisible: true, borderColor: rule, timeVisible: false },
      width: chartContainerRef.current.clientWidth,
      height: 380,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: brand,
      topColor: wash,
      bottomColor: fade,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(view.data);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    // the library doesn't track its container's width on its own
    const onResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove(); // otherwise every theme toggle leaks an instance
    };
  }, [view.data, resolvedTheme, listed]);

  const openTicket = (action: "BUY" | "SELL") => {
    if (currentPrice === null || !userId || listed !== true) return;
    if (action === "SELL" && ownedShares === 0) return;
    setPending({ action, quantity: 1 });
  };

  const confirmTrade = async () => {
    if (!pending || currentPrice === null) return;
    const { action, quantity } = pending;

    setProcessing(action);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${action === "BUY" ? "/api/buy" : "/api/sell"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ticker, shares: quantity, expectedPrice: currentPrice }),
        }
      );
      const result = await res.json();

      if (res.ok) {
        setMessage({
          text: ORDER.filled(action, quantity, ticker, usd(currentPrice)),
          type: "success",
        });
        fetchBalance(userId!);
        fetchPosition(userId!);
      } else {
        setMessage({ text: ORDER.rejected(result.error), type: "error" });
      }
    } catch {
      setMessage({ text: ERROR.ledgerRefused, type: "error" });
    } finally {
      setProcessing(null);
      setPending(null);
      setTimeout(() => setMessage(null), 4500);
    }
  };

  const positionValue = currentPrice !== null ? ownedShares * currentPrice : null;
  const positionPnl =
    currentPrice !== null && avgPrice !== null ? (currentPrice - avgPrice) * ownedShares : null;

  return (
    <div className="flex-1 pb-20">
      <main className="mx-auto w-full max-w-[64rem] px-5 py-8 sm:px-8 sm:py-10">
        <Link href="/" className="label inline-block transition-colors hover:text-brand-ink">
          ← {NAV.back}
        </Link>

        {/* ── listing header ─────────────────────────────────────────── */}
        <div className="mt-6 border-b border-rule-2 pb-8">
          <SectionRule
            label="Listing"
            meta={<DocRef code={`TRX-SEC-${repo.slice(0, 6).toUpperCase()}`} />}
            className="mb-6"
          />

          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="display truncate text-[clamp(2.25rem,6vw,4rem)] uppercase text-ink">
                {repo}
              </h1>
              <p className="figure mt-1 text-sm text-ink-3">{owner}</p>
            </div>

            <div className="sm:text-right">
              <div className="label mb-2">{LABELS.mark}</div>
              {listed === false ? (
                <div className="figure text-2xl text-ink-3">-</div>
              ) : currentPrice !== null ? (
                <>
                  <div className="figure text-[clamp(2rem,7vw,3.25rem)] leading-none text-ink">
                    {usd(currentPrice)}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 sm:justify-end">
                    <Delta value={view.delta} className="text-sm" />
                    <span className="label">over {range.toLowerCase()}</span>
                  </div>
                </>
              ) : (
                <div className="figure text-2xl text-ink-3">-</div>
              )}
            </div>
          </div>
        </div>

        {/* ── history ────────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <SectionRule label={SECTIONS.history} className="min-w-0 flex-1" />
            {/* range control: a single bordered group of segments sharing
                hairlines, not four separate buttons floating apart */}
            <div className="flex shrink-0 border border-rule" role="group" aria-label={LABELS.range}>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  aria-pressed={range === r.key}
                  className={`figure border-r border-rule px-2.5 py-1.5 text-[11px] last:border-r-0 transition-colors ${
                    range === r.key
                      ? "bg-brand text-brand-fg"
                      : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {r.key}
                </button>
              ))}
            </div>
          </div>

          <Panel registered className="p-4 sm:p-6">
            {listed === null ? (
              <Skeleton className="h-[380px] w-full" />
            ) : listed === false ? (
              <div className="flex h-[380px] flex-col items-center justify-center px-6 text-center">
                <div className="label label-ink mb-3">{ERROR.suspended}</div>
                <p className="prose-measure text-sm leading-relaxed text-ink-2">
                  {ERROR.notListed(`${owner}/${repo}`)}
                </p>
                {error && <p className="ref mt-4">{error}</p>}
              </div>
            ) : (
              <div ref={chartContainerRef} className="h-[380px] w-full" />
            )}
          </Panel>

          {/* period statistics, read straight off the visible window */}
          {listed === true && (
            <dl className="mt-px grid grid-cols-2 border-x border-b border-rule sm:grid-cols-4">
              {[
                { term: LABELS.high, value: view.high !== null ? usd(view.high) : "-" },
                { term: LABELS.low, value: view.low !== null ? usd(view.low) : "-" },
                { term: LABELS.observations, value: count(view.observations) },
                { term: LABELS.range, value: range },
              ].map((s, i) => (
                <div
                  key={s.term}
                  className={`px-4 py-3 ${i < 3 ? "sm:border-r sm:border-rule" : ""} ${
                    i % 2 === 0 ? "border-r border-rule sm:border-r" : ""
                  } ${i < 2 ? "border-b border-rule sm:border-b-0" : ""}`}
                >
                  <dt className="label mb-1">{s.term}</dt>
                  <dd className="figure text-[13px] text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* ── valuation breakdown — why the mark is what it is ─────────── */}
        {listed === true && asset && (
          <section className="mt-12">
            <SectionRule label={SECTIONS.valuation} className="mb-5" />
            <Panel>
              {VALUATION.map((v, i) => {
                const n = Number(asset[v.key] ?? 0);
                const contrib = n * v.unit;
                return (
                  <div
                    key={v.key}
                    className={`flex items-baseline justify-between gap-4 px-4 py-3 sm:px-6 ${
                      i > 0 ? "border-t border-rule" : ""
                    }`}
                  >
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="label label-ink">{v.label}</span>
                      <span className="figure text-[12px] text-ink-3">{countCompact(n)}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="ref hidden sm:block">
                        × ${v.unit < 1 ? v.unit.toFixed(3) : v.unit.toFixed(2)}
                      </span>
                      <span className={`figure text-[13px] ${v.neg ? "text-neg" : "text-pos"}`}>
                        {v.neg ? "−" : "+"}
                        {usd(Math.abs(contrib))}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-baseline justify-between gap-4 border-t border-rule-2 px-4 py-3 sm:px-6">
                <span className="label label-ink">Mark</span>
                <span className="figure text-base text-ink">
                  {currentPrice !== null ? usd(currentPrice) : "-"}
                </span>
              </div>
            </Panel>
            <p className="ref mt-3 block leading-relaxed">
              Popularity plus contribution, minus issue drag, aged by how recently the repo
              was pushed. Not a plain sum — the issue drag is capped and stale repos decay.
            </p>
          </section>
        )}

        {/* ── ticket ─────────────────────────────────────────────────── */}
        <section className="mt-12">
          <SectionRule label={SECTIONS.ticket} className="mb-5" />

          <Panel className={listed === false ? "opacity-50" : ""}>
            <div className="grid grid-cols-2 border-b border-rule sm:grid-cols-4">
              <div className="border-b border-r border-rule px-4 py-4 sm:border-b-0">
                <div className="label mb-1.5">{LABELS.position}</div>
                <div className="figure text-lg text-ink">
                  {count(ownedShares)}{" "}
                  <span className="text-[11px] text-ink-3">{LABELS.shares}</span>
                </div>
              </div>
              <div className="border-b border-rule px-4 py-4 sm:border-b-0 sm:border-r">
                <div className="label mb-1.5">Avg entry</div>
                <div className="figure text-lg text-ink">
                  {avgPrice !== null ? usd(avgPrice) : "-"}
                </div>
              </div>
              <div className="border-r border-rule px-4 py-4">
                <div className="label mb-1.5">{LABELS.unrealised}</div>
                <div className={`figure text-lg ${toneClass(positionPnl)}`}>
                  {positionPnl !== null && ownedShares > 0 ? usd(positionPnl) : "-"}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="label mb-1.5">{LABELS.purchasingPower}</div>
                <div className="figure text-lg text-ink">
                  {balance !== null ? usd(balance) : "-"}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] leading-relaxed text-ink-3">
                Market orders only. Size is set on the ticket.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2">
                <button
                  onClick={() => openTicket("BUY")}
                  disabled={listed !== true || processing !== null}
                  className="ctl ctl-primary px-8"
                >
                  {processing === "BUY" ? ORDER.routing : ORDER.buy}
                </button>
                <button
                  onClick={() => openTicket("SELL")}
                  disabled={listed !== true || processing !== null || ownedShares === 0}
                  className="ctl ctl-neg px-8"
                >
                  {processing === "SELL" ? ORDER.routing : ORDER.sell}
                </button>
              </div>
            </div>
          </Panel>

          {ownedShares === 0 && listed === true && (
            <Notice className="mt-5">{ORDER.noPosition} Buy to open one.</Notice>
          )}
          {positionValue !== null && ownedShares > 0 && (
            <p className="ref mt-4 block">
              Position marked at {usd(positionValue)} against a cost basis of{" "}
              {avgPrice !== null ? usd(avgPrice * ownedShares) : "-"}.
            </p>
          )}
        </section>
      </main>

      {pending && currentPrice !== null && (
        <ConfirmTradeModal
          action={pending.action}
          ticker={ticker}
          quantity={pending.quantity}
          onQuantityChange={(q) => setPending({ ...pending, quantity: q })}
          price={currentPrice}
          balance={balance}
          ownedShares={ownedShares}
          processing={processing !== null}
          onConfirm={confirmTrade}
          onCancel={() => setPending(null)}
        />
      )}

      <Toast message={message} />
    </div>
  );
}
