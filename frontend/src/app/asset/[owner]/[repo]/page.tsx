"use client";

import { useEffect, useRef, useState, use } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries, Time } from "lightweight-charts";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "next-themes";
import { Toast, ToastMessage } from "@/components/Toast";
import { ConfirmTradeModal } from "@/components/ConfirmTradeModal";

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

type ChartData = {
  time: Time;
  value: number;
};

// a trade waiting on confirmation - ticker/price come from page state, this just needs
// to remember which action and how many shares
type PendingTrade = {
  action: "BUY" | "SELL";
  quantity: number;
} | null;

// per-asset page - the price chart plus the actual buy/sell trade panel. this is the
// only place in the app you can sell shares or buy a specific quantity (the home page
// buy button is always just 1 share)
export default function AssetChartPage(props: PageProps) {
  // next.js 15 made params a promise, so we need to unwrap it
  const params = use(props.params);
  const { owner, repo } = params;
  const ticker = `${owner}/${repo}`.toUpperCase();

  // refs for the chart instance itself, so we can tear it down / resize it without
  // triggering a react re-render every time
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [history, setHistory] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetExists, setAssetExists] = useState<boolean | null>(null); // null = still checking, true/false once we know

  // everything related to the buy/sell panel
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ownedShares, setOwnedShares] = useState<number>(0);
  const [tradeQuantity, setTradeQuantity] = useState<number | "">(1);
  const [message, setMessage] = useState<ToastMessage>(null);
  const [pendingTrade, setPendingTrade] = useState<PendingTrade>(null);
  const [processingAction, setProcessingAction] = useState<"BUY" | "SELL" | null>(null);

  const { resolvedTheme } = useTheme();
  const supabase = createClient();

  // this page requires login, unlike the home page which just falls back to the landing
  // page - here we hard redirect instead since there's no logged-out version of this page
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
      } else {
        setUserId(user.id);
      }
    };
    checkAuth();
  }, [supabase]);

  const fetchBalance = async (uid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${uid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch (err) {
      console.error("Ledger offline");
    }
  };

  const fetchPortfolio = async (uid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${uid}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const portfolio = data.portfolio || [];
        // we only actually care about this one ticker's position, not the whole portfolio,
        // so just find the matching row and pull the share count out of it
        const holding = portfolio.find((h: any) => h.ticker.toLowerCase() === ticker.toLowerCase());
        setOwnedShares(holding ? holding.shares : 0);
      }
    } catch (err) {
      console.error("Ledger offline");
    }
  };

  useEffect(() => {
    if (userId) {
      fetchBalance(userId);
      fetchPortfolio(userId);
    }
  }, [userId, ticker]);

  // fetches the price history for the chart. this also doubles as the "does this asset
  // even exist" check - if the ledger 404s or comes back empty we treat it as not found
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/history/${owner}/${repo}`);
        if (!res.ok) {
          setAssetExists(false);
          throw new Error("Failed to fetch historical data");
        }

        const data = await res.json();

        if (data.history && data.history.length > 0) {
          // dedupe by unix timestamp just in case the backend ever sends two points for
          // the same day, then sort so the chart draws left to right correctly
          const dataMap = new Map<number, number>();
          data.history.forEach((item: any) => {
            const unixTime = Math.floor(new Date(item.time).getTime() / 1000);
            dataMap.set(unixTime, item.value);
          });

          const sortedArray = Array.from(dataMap.entries())
            .map(([time, value]) => ({ time, value }))
            .sort((a, b) => a.time - b.time);

          const formattedHistory = sortedArray.map(item => ({
            time: item.time as Time,
            value: item.value
          }));

          setHistory(formattedHistory);
          setCurrentPrice(formattedHistory[formattedHistory.length - 1].value); // latest point in history = current price
          setAssetExists(true);
        } else {
          setAssetExists(false);
          setError("NO HISTORICAL DATA");
        }
      } catch (err) {
        setAssetExists(false);
        setError("DATA ENGINE OFFLINE");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [owner, repo]);

  // this is the actual chart setup, runs once we've got history data and a theme to
  // draw it in. rebuilds the whole chart from scratch on theme change since
  // lightweight-charts doesn't really support live-restyling an existing instance well
  useEffect(() => {
    if (!chartContainerRef.current || history.length === 0 || assetExists === false) return;

    const isDark = resolvedTheme === "dark";
    // pulled straight from the css tokens in globals.css - keeps the chart line the same
    // accent blue as the rest of the ui instead of a plain black/white line
    const textColor = isDark ? "#7d8590" : "#656d76"; // ink-muted
    const lineColor = isDark ? "#58a6ff" : "#0969da"; // accent
    const crosshairColor = isDark ? "#e6edf3" : "#1f2328"; // ink
    const areaTopColor = isDark ? "rgba(88, 166, 255, 0.15)" : "rgba(9, 105, 218, 0.12)"; // accent, faded
    const areaBottomColor = isDark ? "rgba(88, 166, 255, 0.0)" : "rgba(9, 105, 218, 0.0)";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: textColor,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: {
          color: crosshairColor,
          width: 1,
          style: 3, // dotted
          labelBackgroundColor: crosshairColor,
        },
        horzLine: {
          color: crosshairColor,
          width: 1,
          style: 3,
          labelBackgroundColor: crosshairColor,
        },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    // area chart with a gradient fill under the line, matches the "terminal" look of
    // the rest of the app
    const newSeries = chart.addSeries(AreaSeries, {
      lineColor: lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
    });

    newSeries.setData(history);
    chart.timeScale().fitContent(); // zoom to fit all the data instead of some default range

    chartRef.current = chart;
    seriesRef.current = newSeries;

    // lightweight-charts doesn't auto-resize with its container, so we have to do it
    // manually on window resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    // cleanup - remove the listener and destroy the chart instance so we don't leak
    // memory every time this effect re-runs (theme toggle, new history, etc)
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [history, resolvedTheme, assetExists]);

  // step 1 - validate, then just open the confirm modal instead of firing the trade
  // straight away like it used to
  const handleTradeRequest = (action: "BUY" | "SELL") => {
    if (currentPrice === null) return;
    if (!userId || assetExists !== true) return;
    if (tradeQuantity === "" || tradeQuantity <= 0) return;
    if (action === "SELL" && ownedShares < tradeQuantity) return;

    setPendingTrade({ action, quantity: tradeQuantity });
  };

  // step 2 - only runs once the user actually hits confirm in the modal. same
  // slippage/quantity checks happen again server-side, this is just to avoid firing off
  // obviously-bad requests
  const handleConfirmTrade = async () => {
    if (!pendingTrade || currentPrice === null) return;
    const { action, quantity } = pendingTrade;

    setProcessingAction(action);
    setMessage(null);

    try {
      const endpoint = action === "BUY" ? "/api/buy" : "/api/sell";
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ticker: ticker,
          shares: quantity,
          expectedPrice: currentPrice,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: `Filled: ${action} ${quantity} QTY of ${ticker} @ Market`, type: "success" });
        fetchBalance(userId!);
        fetchPortfolio(userId!);
        setTradeQuantity(1); // reset qty back to 1 after a fill
      } else {
        setMessage({ text: `Rejected: ${result.error}`, type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Connection refused by Ledger.", type: "error" });
    } finally {
      setProcessingAction(null);
      setPendingTrade(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink font-sans relative selection:bg-accent selection:text-accent-foreground pb-20 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* breadcrumb back to the terminal - the shared Header (rendered once, globally,
              in layout.tsx) already covers logo/search/nav, so this page doesn't need its
              own header bar on top of that */}
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-ink-muted hover:text-accent transition-colors mb-6"
          >
            ← Back to Terminal
          </Link>

          <div className="mb-12 border-b-2 border-edge pb-8 flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">Ticker</p>
              <h1 className="font-display text-4xl font-bold tracking-tighter text-ink mb-1">{repo.toUpperCase()}</h1>
              <p className="text-sm text-ink-muted">{owner}</p>
            </div>

            {/* current price - shows n/a if the asset doesn't exist, --- while still loading */}
            <div className="sm:text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">Current Mark</p>
              {assetExists === false ? (
                <div className="font-display text-xl font-bold tracking-tighter text-ink-muted">N/A</div>
              ) : currentPrice !== null ? (
                <div className="flex items-baseline sm:justify-end gap-1">
                  <span className="text-xl text-ink-muted">$</span>
                  <span className="font-display text-4xl sm:text-5xl font-bold tracking-tighter text-ink tabular-nums">
                    {currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <div className="font-display text-xl font-bold tracking-tighter text-ink-muted">---</div>
              )}
            </div>
          </div>

          {/* chart card - has three different states: still checking, asset not found,
              and generic error, before it finally shows the actual chart */}
          <div className="border-2 border-edge bg-card p-6 shadow-brutal mb-8">
            {assetExists === null ? (
              <div className="h-[400px] flex items-center justify-center text-sm text-ink-muted">
                VERIFYING ASSET DATA...
              </div>
            ) : assetExists === false ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 bg-card-alt border-2 border-edge">
                <div className="font-display text-2xl font-bold tracking-widest text-ink mb-2">ASSET NOT FOUND</div>
                <div className="text-sm text-ink-muted max-w-md">
                  The repository {owner}/{repo} either does not exist on GitHub or is private. Trading is suspended.
                </div>
              </div>
            ) : error ? (
              <div className="h-[400px] flex items-center justify-center text-sm text-ink-muted">
                {error}
              </div>
            ) : (
              // this empty div is what lightweight-charts actually renders into, see the
              // chart setup effect above
              <div ref={chartContainerRef} className="w-full h-[400px]" />
            )}
          </div>

          {/* trade panel - shows position, available cash, quantity input, and buy/sell
              buttons. dims out and disables everything if the asset doesn't exist */}
          <div className={`border-2 border-edge bg-card p-6 shadow-brutal-sm ${assetExists === false ? "opacity-50" : ""}`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Position</span>
                  <span className="font-display text-xl font-bold tracking-tighter text-ink tabular-nums">
                    {ownedShares} <span className="text-sm font-sans font-normal text-ink-muted">SHRS</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Available Cash</span>
                  <span className="font-display text-xl font-bold tracking-tighter text-ink tabular-nums">
                    {balance !== null
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(balance)
                      : "---"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex flex-col">
                  <label htmlFor="qty" className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Quantity</label>
                  <input
                    id="qty"
                    type="number"
                    min="1"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(e.target.value === "" ? "" : parseInt(e.target.value))}
                    disabled={assetExists === false}
                    className={`w-24 h-10 px-3 border-2 border-edge bg-card text-center text-ink tabular-nums focus:outline-none focus:shadow-brutal-sm transition-shadow ${assetExists === false ? "cursor-not-allowed bg-card-alt" : ""}`}
                  />
                </div>

                <div className="flex gap-2 items-end h-full">
                  {/* buy is disabled while asset is missing or a trade is already in flight */}
                  <button
                    onClick={() => handleTradeRequest("BUY")}
                    disabled={assetExists === false || processingAction !== null || tradeQuantity === ""}
                    className={`h-10 px-8 text-xs font-bold tracking-widest uppercase border-2 transition-all duration-150 ${
                      assetExists === false || processingAction === "BUY" || tradeQuantity === ""
                        ? "bg-card-alt text-ink-muted cursor-not-allowed border-edge"
                        : "bg-accent text-accent-foreground border-edge press-brutal shadow-brutal-sm"
                    }`}
                  >
                    {processingAction === "BUY" ? "Routing" : "Buy"}
                  </button>

                  {/* sell has the extra check that you can't sell more than you own */}
                  <button
                    onClick={() => handleTradeRequest("SELL")}
                    disabled={assetExists === false || processingAction !== null || ownedShares === 0 || tradeQuantity === "" || tradeQuantity > ownedShares}
                    className={`h-10 px-8 text-xs font-bold tracking-widest uppercase border-2 transition-all duration-150 ${
                      assetExists === false || processingAction === "SELL" || ownedShares === 0 || tradeQuantity === "" || tradeQuantity > ownedShares
                        ? "bg-card-alt text-ink-muted cursor-not-allowed border-edge"
                        : "bg-card text-ink border-edge press-brutal shadow-brutal-sm"
                    }`}
                  >
                    {processingAction === "SELL" ? "Routing" : "Sell"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {pendingTrade && currentPrice !== null && (
        <ConfirmTradeModal
          action={pendingTrade.action}
          ticker={ticker}
          quantity={pendingTrade.quantity}
          price={currentPrice}
          processing={processingAction !== null}
          onConfirm={handleConfirmTrade}
          onCancel={() => setPendingTrade(null)}
        />
      )}

      <Toast message={message} />
    </div>
  );
}
