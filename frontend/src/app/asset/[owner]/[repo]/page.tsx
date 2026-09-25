"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries, Time } from "lightweight-charts";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { usePrefersDark } from "@/lib/usePrefersDark";
import { Toast, ToastMessage } from "@/components/Toast";
import { ConfirmTradeModal } from "@/components/ConfirmTradeModal";
import { SectionRule, Panel, Notice, Skeleton, Delta, Segmented } from "@/components/ui";
import { ListingMorph } from "@/components/ListingMorph";
import { usd, count, countCompact, change, toneClass } from "@/lib/format";
import { SECTIONS, LABELS, ERROR, ORDER, NAV, LISTING } from "@/lib/copy";
import { deriveValuation, type AssetMetrics } from "@/lib/pricing";
import type { HoldingRow, HistoryPoint } from "@/lib/api";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

type ChartData = { time: Time; value: number };
type PendingTrade = { action: "BUY" | "SELL"; quantity: number } | null;

// chart ranges, filtered client-side from the history already in memory
const RANGES = [
  { key: "7D", days: 7 },
  { key: "30D", days: 30 },
  { key: "90D", days: 90 },
  { key: "ALL", days: Infinity },
] as const;
const RANGE_KEYS = RANGES.map((r) => r.key);

// the single-repo page: price and its move up top, then the chart and period stats, the
// valuation breakdown, and the buy/sell ticket
export default function ListingPage(props: PageProps) {
  const params = use(props.params);
  const { owner, repo } = params;
  const ticker = `${owner}/${repo}`.toUpperCase();

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [history, setHistory] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [asset, setAsset] = useState<AssetMetrics | null>(null);
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
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  const isDark = usePrefersDark();
  const supabase = createClient();

  // unlike the home page, there's no logged-out version of this route. sign-in brings you
  // back to this listing
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) window.location.href = `/login?next=${encodeURIComponent(`/asset/${owner}/${repo}`)}`;
      else setUserId(user.id);
    };
    check();
  }, [supabase, owner, repo]);

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
        (h: HoldingRow) => h.ticker.toLowerCase() === ticker.toLowerCase()
      );
      setOwnedShares(holding ? holding.shares : 0);
      setAvgPrice(holding ? Number(holding.average_price) : null);
    } catch {
      console.error(ERROR.ledger);
    }
  };

  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      await Promise.all([fetchBalance(userId), fetchPosition(userId)]);
    };
    run();
  }, [userId, ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  // price history and the current price, which doubles as the listing check. a 404 means
  // the repository isn't listed, anything else is the ledger being down. refetched after
  // every trade so the price on the page is the one the ledger will fill at
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${owner}/${repo}`);
        if (res.status === 404) {
          setUnavailable(false);
          setListed(false);
          return;
        }
        if (!res.ok) {
          setUnavailable(true);
          return;
        }
        const data = await res.json();
        setUnavailable(false);
        setError(null);
        setAsset(data.asset);
        setCurrentPrice(Number(data.asset.current_price));
        setListed(true);

        if (data.history && data.history.length > 0) {
          // dedupe on the unix timestamp in case the engine ever emits two
          // points for one day, then sort so the series draws left to right
          const byTime = new Map<number, number>();
          data.history.forEach((item: HistoryPoint) => {
            byTime.set(Math.floor(new Date(item.time).getTime() / 1000), item.value);
          });
          const series = Array.from(byTime.entries())
            .map(([time, value]) => ({ time: time as Time, value }))
            .sort((a, b) => (a.time as number) - (b.time as number));

          setHistory(series);
        } else {
          setHistory([]);
        }
      } catch {
        setUnavailable(true);
      }
    };
    fetchHistory();
  }, [owner, repo, historyVersion]);

  const refreshPrice = () => setHistoryVersion((v) => v + 1);

  // adds this repository to your own listings. github's name for it can differ from the
  // url (a rename or different casing), so it moves to the canonical page when it does
  const addListing = async () => {
    setAdding(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ticker: `${owner}/${repo}` }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? ERROR.unexpected);
      } else if (result.ticker && result.ticker.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) {
        window.location.href = `/asset/${result.ticker.toLowerCase()}`;
      } else {
        refreshPrice();
      }
    } catch {
      setError(ERROR.ledgerRefused);
    } finally {
      setAdding(false);
    }
  };

  // the visible window, plus everything derived from it. ranges count back from the
  // latest price
  const view = useMemo(() => {
    const spec = RANGES.find((r) => r.key === range)!;
    const end = history.length ? (history[history.length - 1].time as number) : 0;
    const windowed =
      spec.days === Infinity
        ? history
        : history.filter((p) => (p.time as number) >= end - spec.days * 86400);
    // falls back to the full history when the window has fewer than two points
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

  // the chart gets rebuilt from scratch when the theme changes, since lightweight-charts
  // doesn't restyle an existing instance cleanly
  useEffect(() => {
    if (!chartContainerRef.current || view.data.length === 0 || listed !== true) return;

    const dark = isDark;
    // literal colours from the theme tokens, since lightweight-charts can't read css
    // variables. the line is bright sulfur on dark and a darker olive on light
    const ink3 = dark ? "#86846F" : "#78766A";
    const ink = dark ? "#EDEDE0" : "#16160E";
    const rule = dark ? "#29291C" : "#E5E5E1";
    const brand = dark ? "#DCEC3A" : "#6F7A00";
    const wash = dark ? "rgba(220,236,58,0.20)" : "rgba(220,236,58,0.22)";
    const fade = dark ? "rgba(220,236,58,0)" : "rgba(220,236,58,0)";

    // a canvas can't resolve css variables, so the mono's real family names get read off
    // the page
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-spline").trim() || "monospace";

    const chart = createChart(chartContainerRef.current, {
      // the page keeps the scroll wheel and vertical swipes. drag and pinch still move
      // and zoom the chart
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: ink3,
        // axis figures in the same mono as every other number in the product
        fontFamily: mono,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        // horizontal gridlines only
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
      chart.remove(); // otherwise every theme change leaks an instance
    };
  }, [view.data, isDark, listed]);

  const openTicket = (action: "BUY" | "SELL") => {
    if (currentPrice === null || !userId || listed !== true) return;
    if (action === "SELL" && ownedShares === 0) return;
    setTicketNotice(null);
    setPending({ action, quantity: 1 });
  };

  const confirmTrade = async () => {
    if (!pending || currentPrice === null) return;
    const { action, quantity } = pending;

    setProcessing(action);
    setMessage(null);
    setTicketNotice(null);
    let keepOpen = false;

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
          text: ORDER.filled(action, quantity, result.ticker ?? ticker, usd(result.price ?? currentPrice)),
          type: "success",
        });
        fetchBalance(userId!);
        fetchPosition(userId!);
      } else if (res.status === 409 && typeof result.price === "number") {
        // the price moved: the ticket stays open at the new price with the reason in it
        keepOpen = true;
        setCurrentPrice(result.price);
        setTicketNotice(result.error);
      } else {
        setMessage({ text: ORDER.rejected(result.error), type: "error" });
      }
      refreshPrice();
    } catch {
      setMessage({ text: ERROR.ledgerRefused, type: "error" });
    } finally {
      setProcessing(null);
      if (!keepOpen) setPending(null);
    }
  };

  const positionValue = currentPrice !== null ? ownedShares * currentPrice : null;
  const positionPnl =
    currentPrice !== null && avgPrice !== null ? (currentPrice - avgPrice) * ownedShares : null;

  // rebuilds the mark from the stored public metrics for the valuation panel: base plus
  // each metric's contribution, less capped issue drag, times recency
  const valuation = asset ? deriveValuation(asset, currentPrice) : null;

  return (
    <div className="flex-1 pb-20">
      <main className="mx-auto w-full max-w-[64rem] px-5 py-8 sm:px-8 sm:py-10">
        <Link href="/" className="label inline-block sig">
          ← {NAV.back}
        </Link>

        {/* quote header: the listing's name and its mark, full width */}
        <div className="mt-6 border-b border-rule-2 pb-8">
          <SectionRule label="Listing" className="mb-6" />

          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <ListingMorph ticker={ticker}>
                <h1 className="display truncate text-[clamp(2.25rem,6vw,4rem)] uppercase text-ink">
                  {repo}
                </h1>
              </ListingMorph>
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-3">
                <span className="truncate">{owner}</span>
                {asset && Number(asset.raw_stars) > 0 ? (
                  <>
                    <span className="text-rule-2" aria-hidden="true">·</span>
                    <span className="whitespace-nowrap"><span className="figure">{countCompact(Number(asset.raw_stars))}</span> stars</span>
                  </>
                ) : null}
              </p>
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

        {/* chart and valuation on the left, the order ticket on a sticky rail on the
            right. on a phone it stacks in that order */}
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.7fr_1fr] lg:gap-10">
          {/* left: history and valuation */}
          <div className="min-w-0">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <SectionRule label={SECTIONS.history} className="min-w-0 flex-1" />
                <Segmented
                  options={RANGE_KEYS}
                  value={range}
                  onChange={setRange}
                  label={LABELS.range}
                />
              </div>

              <Panel className="p-4 sm:p-6">
                {unavailable && listed === null ? (
                  <div className="flex h-[380px] items-center justify-center px-6 text-center">
                    <p className="text-sm text-ink-2">{ERROR.engine}</p>
                  </div>
                ) : listed === null ? (
                  <Skeleton className="h-[380px] w-full" />
                ) : listed === false ? (
                  <div className="flex h-[380px] flex-col items-center justify-center px-6 text-center">
                    <div className="label label-ink mb-3">{LISTING.notListed}</div>
                    <p className="prose-measure text-sm leading-relaxed text-ink-2">
                      {LISTING.addBody(`${owner}/${repo}`)}
                    </p>
                    {userId ? (
                      <button onClick={addListing} disabled={adding} className="ctl ctl-primary mt-5">
                        {adding ? LISTING.adding : LISTING.add}
                      </button>
                    ) : (
                      <p className="ref mt-4">{LISTING.signIn}</p>
                    )}
                    {error && <p role="alert" className="ref mt-4">{error}</p>}
                  </div>
                ) : view.data.length === 0 ? (
                  <div className="flex h-[380px] items-center justify-center px-6 text-center">
                    <p className="text-sm text-ink-2">{LISTING.chartPending}</p>
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

            {/* valuation breakdown: the mark, rebuilt from public numbers */}
            {listed === true && valuation && (
              <section className="mt-12">
                <SectionRule label={SECTIONS.valuation} className="mb-5" />
                <Panel>
                  {/* base listing */}
                  <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-6">
                    <span className="label label-ink">Base listing</span>
                    <span className="figure text-[13px] text-pos">+{usd(valuation.base)}</span>
                  </div>

                  {/* each metric's contribution */}
                  {valuation.lines.map((l) => (
                    <div
                      key={l.key}
                      className="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 sm:px-6"
                    >
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="label label-ink">{l.label}</span>
                        <span className="figure text-[12px] text-ink-3">{countCompact(l.count)}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="ref hidden sm:block">
                          {l.log ? "ln(1 + n) " : ""}× ${l.unit < 1 ? l.unit.toFixed(3) : l.unit.toFixed(2)}
                        </span>
                        <span className="figure text-[13px] text-pos">+{usd(l.contrib)}</span>
                      </div>
                    </div>
                  ))}

                  {/* gross subtotal */}
                  <div className="flex items-baseline justify-between gap-4 border-t border-rule-2 px-4 py-3 sm:px-6">
                    <span className="label label-ink">Gross</span>
                    <span className="figure text-[13px] text-ink">{usd(valuation.gross)}</span>
                  </div>

                  {/* issue drag, capped at 60% of gross */}
                  <div className="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 sm:px-6">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="label label-ink">Open issues</span>
                      <span className="figure text-[12px] text-ink-3">{countCompact(valuation.drag.count)}</span>
                      {valuation.drag.capped && (
                        <span className="ref hidden sm:block">drag capped at 60% of gross</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="ref hidden sm:block">
                        {valuation.drag.log ? "ln(1 + n) " : ""}× ${valuation.drag.unit.toFixed(2)}
                      </span>
                      <span className="figure text-[13px] text-neg">−{usd(valuation.drag.applied)}</span>
                    </div>
                  </div>

                  {/* recency multiplier */}
                  {valuation.recency && (
                    <div className="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 sm:px-6">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="label label-ink">Recency</span>
                        <span className="ref hidden sm:block">
                          {valuation.recency.implied
                            ? "implied — push time not yet stored"
                            : `pushed ${valuation.recency.days} days before pricing`}
                        </span>
                      </div>
                      <span className="figure text-[13px] text-ink">
                        × {valuation.recency.factor.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {/* mark */}
                  <div className="flex items-baseline justify-between gap-4 border-t border-rule-2 px-4 py-3 sm:px-6">
                    <span className="label label-ink">Mark</span>
                    <span className="figure text-base text-ink">
                      {currentPrice !== null ? usd(currentPrice) : "-"}
                    </span>
                  </div>
                </Panel>
                <p className="ref mt-3 block leading-relaxed">
                  {valuation.reconciles === false
                    ? "This reconstruction does not reconcile to the mark — the mark was struck under a different formula version."
                    : valuation.recency?.implied
                    ? "Base, plus each metric’s contribution, less capped issue drag, aged by recency — every line rebuilt from the repository’s public numbers. The recency factor is backed out of the mark until push time is stored; once it is, this line shows the exact age. Reconciles to the mark."
                    : "Base, plus each metric’s contribution, less capped issue drag, then aged by how recently the repo was pushed — every line rebuilt from the repository’s public numbers, reconciling exactly to the mark."}
                </p>
              </section>
            )}
          </div>

          {/* right: the order ticket, sticky */}
          <aside className="lg:sticky lg:top-28">
            <SectionRule label={SECTIONS.ticket} className="mb-5" />

            <Panel className={listed === false ? "opacity-50" : ""}>
              {/* position stats stacked as rows, since the rail is narrow */}
              <dl>
                <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
                  <dt className="label">{LABELS.position}</dt>
                  <dd className="figure text-[13px] text-ink">
                    {count(ownedShares)} <span className="text-[11px] text-ink-3">{LABELS.shares}</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
                  <dt className="label">Avg entry</dt>
                  <dd className="figure text-[13px] text-ink">{avgPrice !== null ? usd(avgPrice) : "-"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
                  <dt className="label">{LABELS.unrealised}</dt>
                  <dd className={`figure text-[13px] ${toneClass(positionPnl)}`}>
                    {positionPnl !== null && ownedShares > 0 ? usd(positionPnl) : "-"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <dt className="label">{LABELS.purchasingPower}</dt>
                  <dd className="figure text-[13px] text-ink">{balance !== null ? usd(balance) : "-"}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 gap-2 border-t border-rule p-4">
                <button
                  onClick={() => openTicket("BUY")}
                  disabled={listed !== true || processing !== null}
                  className="ctl ctl-primary"
                >
                  {processing === "BUY" ? ORDER.routing : ORDER.buy}
                </button>
                <button
                  onClick={() => openTicket("SELL")}
                  disabled={listed !== true || processing !== null || ownedShares === 0}
                  className="ctl ctl-neg"
                >
                  {processing === "SELL" ? ORDER.routing : ORDER.sell}
                </button>
                <p className="col-span-2 mt-1 text-[12px] leading-relaxed text-ink-3">
                  Market orders only. Size is set on the ticket.
                </p>
              </div>
            </Panel>

            {ownedShares === 0 && listed === true && (
              <Notice className="mt-5">{ORDER.noPosition} Buy to open one.</Notice>
            )}
            {positionValue !== null && ownedShares > 0 && (
              <p className="ref mt-4 block leading-relaxed">
                Position marked at {usd(positionValue)} against a cost basis of{" "}
                {avgPrice !== null ? usd(avgPrice * ownedShares) : "-"}.
              </p>
            )}
          </aside>
        </div>
      </main>

      <ConfirmTradeModal
        trade={pending && currentPrice !== null ? { ...pending, ticker, price: currentPrice } : null}
        onQuantityChange={(q) => setPending((p) => p && { ...p, quantity: q })}
        balance={balance}
        ownedShares={ownedShares}
        processing={processing !== null}
        notice={ticketNotice}
        onConfirm={confirmTrade}
        onCancel={() => setPending(null)}
      />

      <Toast message={message} />
    </div>
  );
}
