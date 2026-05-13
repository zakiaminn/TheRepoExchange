"use client";

import { useEffect, useRef, useState, use } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, AreaSeries } from "lightweight-charts";
import Link from "next/link";

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

export default function AssetChartPage(props: PageProps) {
  // Unwrap the Promise-based params in Next.js 15+
  const params = use(props.params);
  const { owner, repo } = params;
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  
  const [history, setHistory] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ticker = `${owner}/${repo}`.toUpperCase();

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

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#000000",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        vertLine: {
          color: "#000000",
          width: 1,
          style: 3, // Dotted
          labelBackgroundColor: "#000000",
        },
        horzLine: {
          color: "#000000",
          width: 1,
          style: 3,
          labelBackgroundColor: "#000000",
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
      lineColor: "#000000",
      topColor: "rgba(0, 0, 0, 0.05)",
      bottomColor: "rgba(0, 0, 0, 0.0)",
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
  }, [history]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-black font-sans relative selection:bg-black selection:text-white">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-mono text-sm font-bold tracking-tight hover:text-neutral-500 transition-colors">
                TRX.EXCHANGE
              </Link>
              <div className="h-4 w-[1px] bg-neutral-300"></div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">Asset View</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-right">
              <Link 
                href="/"
                className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
              >
                Back to Terminal
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-12 border-b border-neutral-200 pb-8 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mb-2">Ticker</p>
              <h1 className="text-4xl font-bold tracking-tighter text-black mb-1">{repo.toUpperCase()}</h1>
              <p className="text-sm text-neutral-500 font-mono">{owner}</p>
            </div>
            
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mb-2">Current Mark</p>
              {currentPrice !== null ? (
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-xl text-neutral-400 font-mono">$</span>
                  <span className="text-5xl font-light tracking-tighter text-black font-mono">
                    {currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <div className="text-xl font-mono tracking-tighter text-neutral-400">---</div>
              )}
            </div>
          </div>

          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            {loading ? (
              <div className="h-[400px] flex items-center justify-center font-mono text-sm text-neutral-400">
                INITIALIZING DATA STREAM...
              </div>
            ) : error ? (
              <div className="h-[400px] flex items-center justify-center font-mono text-sm text-neutral-400">
                {error}
              </div>
            ) : (
              <div ref={chartContainerRef} className="w-full h-[400px]" />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}