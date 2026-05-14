"use client";

import { useEffect, useRef, useState, use } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries } from "lightweight-charts";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useTheme } from "next-themes";

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

type ChartData = {
  time: string;
  value: number;
};

type SystemMessage = {
  text: string;
  type: "success" | "error";
} | null;

export default function AssetChartPage(props: PageProps) {
  // Unwrap the Promise-based params in Next.js 15+
  const params = use(props.params);
  const { owner, repo } = params;
  const ticker = `${owner}/${repo}`.toUpperCase();
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  
  const [history, setHistory] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Trade state
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ownedShares, setOwnedShares] = useState<number>(0);
  const [tradeQuantity, setTradeQuantity] = useState<number>(1);
  const [message, setMessage] = useState<SystemMessage>(null);
  const [processingAction, setProcessingAction] = useState<"BUY" | "SELL" | null>(null);

  const { resolvedTheme } = useTheme();
  const supabase = createClient();

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
      const res = await fetch(`http://localhost:8080/api/balance/${uid}`);
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
      const res = await fetch(`http://localhost:8080/api/portfolio/${uid}`);
      if (res.ok) {
        const data = await res.json();
        const portfolio = data.portfolio || [];
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

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/history/${owner}/${repo}`);
        if (!res.ok) throw new Error("Failed to fetch historical data");
        const data = await res.json();
        
        if (data.history && data.history.length > 0) {
          setHistory(data.history);
          setCurrentPrice(data.history[data.history.length - 1].value);
        } else {
          setError("NO HISTORICAL DATA");
        }
      } catch (err) {
        setError("DATA ENGINE OFFLINE");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [owner, repo]);

  useEffect(() => {
    if (!chartContainerRef.current || history.length === 0) return;

    const isDark = resolvedTheme === "dark";
    const textColor = isDark ? "#9ca3af" : "#6b7280";
    const lineColor = isDark ? "#ffffff" : "#000000";
    const crosshairColor = isDark ? "#ffffff" : "#000000";
    const areaTopColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const areaBottomColor = isDark ? "rgba(255, 255, 255, 0.0)" : "rgba(0, 0, 0, 0.0)";

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
          style: 3, // Dotted
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

    const newSeries = chart.addSeries(AreaSeries, {
      lineColor: lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      lineWidth: 2,
    });

    newSeries.setData(history);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = newSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [history, resolvedTheme]);

  const handleTrade = async (action: "BUY" | "SELL") => {
    if (!userId) return;
    if (tradeQuantity <= 0) return;
    if (action === "SELL" && ownedShares < tradeQuantity) return;

    setProcessingAction(action);
    setMessage(null);

    try {
      const endpoint = action === "BUY" ? "/api/buy" : "/api/sell";
      const response = await fetch(`http://localhost:8080${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          ticker: ticker,
          shares: tradeQuantity,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: `Filled: ${action} ${tradeQuantity} QTY of ${ticker} @ Market`, type: "success" });
        fetchBalance(userId);
        fetchPortfolio(userId);
        setTradeQuantity(1); // reset after successful trade
      } else {
        setMessage({ text: `Rejected: ${result.error}`, type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Connection refused by Ledger.", type: "error" });
    } finally {
      setProcessingAction(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans relative selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 pb-20 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-mono text-sm font-bold tracking-tight hover:text-gray-500 dark:hover:text-gray-400 transition-colors">
                TRX.EXCHANGE
              </Link>
              <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Asset View</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mr-3">Cash</span>
                <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  {balance !== null 
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(balance)
                    : "---"}
                </span>
              </div>
              <Link 
                href="/"
                className="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Back to Terminal
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-12 border-b border-gray-200 dark:border-gray-800 pb-8 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-2">Ticker</p>
              <h1 className="text-4xl font-bold tracking-tighter text-gray-900 dark:text-gray-100 mb-1">{repo.toUpperCase()}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{owner}</p>
            </div>
            
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-2">Current Mark</p>
              {currentPrice !== null ? (
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-xl text-gray-500 dark:text-gray-400 font-mono">$</span>
                  <span className="text-5xl font-light tracking-tighter text-gray-900 dark:text-gray-100 font-mono">
                    {currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <div className="text-xl font-mono tracking-tighter text-gray-500 dark:text-gray-400">---</div>
              )}
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-6 shadow-sm mb-8">
            {loading ? (
              <div className="h-[400px] flex items-center justify-center font-mono text-sm text-gray-500 dark:text-gray-400">
                INITIALIZING DATA STREAM...
              </div>
            ) : error ? (
              <div className="h-[400px] flex items-center justify-center font-mono text-sm text-gray-500 dark:text-gray-400">
                {error}
              </div>
            ) : (
              <div ref={chartContainerRef} className="w-full h-[400px]" />
            )}
          </div>

          {/* Trade Panel */}
          <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1">Position</span>
              <span className="text-xl font-mono tracking-tighter text-gray-900 dark:text-gray-100">
                {ownedShares} <span className="text-sm text-gray-500 dark:text-gray-400">SHRS</span>
              </span>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex flex-col">
                <label htmlFor="qty" className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                <input 
                  id="qty"
                  type="number"
                  min="1"
                  value={tradeQuantity}
                  onChange={(e) => setTradeQuantity(parseInt(e.target.value) || 0)}
                  className="w-24 h-10 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] font-mono text-center text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-900 dark:focus:border-gray-100"
                />
              </div>

              <div className="flex gap-2 items-end h-full">
                <button 
                  onClick={() => handleTrade("BUY")}
                  disabled={processingAction !== null}
                  className={`h-10 px-8 text-xs font-bold tracking-widest uppercase transition-all duration-150 ${
                    processingAction === "BUY"
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-800"
                      : "bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 active:scale-[0.98] border border-gray-900 dark:border-white"
                  }`}
                >
                  {processingAction === "BUY" ? "Routing" : "Buy"}
                </button>
                
                <button 
                  onClick={() => handleTrade("SELL")}
                  disabled={processingAction !== null || ownedShares === 0 || tradeQuantity > ownedShares}
                  className={`h-10 px-8 text-xs font-bold tracking-widest uppercase transition-all duration-150 ${
                    processingAction === "SELL" || ownedShares === 0 || tradeQuantity > ownedShares
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-200 dark:border-gray-800"
                      : "bg-white text-gray-900 dark:bg-[#121212] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.98] border border-gray-900 dark:border-gray-100"
                  }`}
                >
                  {processingAction === "SELL" ? "Routing" : "Sell"}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {message && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-4 py-3 border text-sm font-mono shadow-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-white dark:bg-[#121212] border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100' 
              : 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900'
          }`}>
            <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-gray-900 dark:bg-white' : 'bg-red-500'}`}></div>
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}