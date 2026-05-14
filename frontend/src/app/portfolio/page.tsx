"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Holding = {
  ticker: string;
  shares: number;
  average_price: string | number;
  current_price: string | number;
};

export default function PortfolioPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        const [balanceRes, portfolioRes] = await Promise.all([
          fetch(`http://localhost:8080/api/balance/${userId}`),
          fetch(`http://localhost:8080/api/portfolio/${userId}`)
        ]);

        if (balanceRes.ok) {
          const balanceData = await balanceRes.json();
          setBalance(Number(balanceData.balance));
        }

        if (portfolioRes.ok) {
          const portfolioData = await portfolioRes.json();
          setPortfolio(portfolioData.portfolio || []);
        }
      } catch (err) {
        console.error("Ledger offline");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // Calculations
  const cash = balance || 0;
  
  const totalAssetValue = portfolio.reduce((acc, holding) => {
    return acc + (holding.shares * Number(holding.current_price));
  }, 0);
  
  const netWorth = cash + totalAssetValue;

  const totalPnL = portfolio.reduce((acc, holding) => {
    return acc + ((Number(holding.current_price) - Number(holding.average_price)) * holding.shares);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  };

  const pnlSign = totalPnL >= 0 ? "+" : "";
  const pnlColor = totalPnL > 0 ? "text-green-600" : totalPnL < 0 ? "text-red-600" : "text-neutral-500";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-mono text-sm text-neutral-400">
        LOADING PORTFOLIO...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-black font-sans relative selection:bg-black selection:text-white pb-20">
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
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">Portfolio</span>
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
          {/* Hero Section */}
          <div className="mb-16 border-b border-neutral-200 pb-12 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mb-4">Total Net Worth</p>
            <h1 className="text-7xl font-light tracking-tighter text-black font-mono mb-6">
              {formatCurrency(netWorth)}
            </h1>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400">Total Profit / Loss</p>
              <p className={`text-2xl font-mono tracking-tighter ${pnlColor}`}>
                {pnlSign}{formatCurrency(totalPnL)}
              </p>
            </div>
          </div>

          {/* Cash Breakdown */}
          <div className="mb-12 border border-neutral-200 bg-white p-6 shadow-sm flex justify-between items-center">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-500 font-bold">Available Cash</span>
            <span className="text-xl font-mono tracking-tighter text-black">
              {formatCurrency(cash)}
            </span>
          </div>

          {/* Holdings Ledger */}
          <div>
            <h2 className="text-[11px] tracking-[0.25em] font-bold uppercase text-neutral-500 mb-6">Holdings Ledger</h2>
            
            {portfolio.length === 0 ? (
              <div className="border border-neutral-200 bg-white p-12 text-center text-sm font-mono text-neutral-400 shadow-sm">
                NO ASSETS HELD
              </div>
            ) : (
              <div className="border border-neutral-200 bg-white shadow-sm font-mono">
                {portfolio.map((holding, index) => {
                  const currentPrice = Number(holding.current_price);
                  const averagePrice = Number(holding.average_price);
                  const totalValue = currentPrice * holding.shares;
                  const holdingPnL = (currentPrice - averagePrice) * holding.shares;
                  const holdingPnLPercent = ((currentPrice - averagePrice) / averagePrice) * 100;
                  
                  const sign = holdingPnL >= 0 ? "+" : "";
                  const colorClass = holdingPnL > 0 ? "text-green-600" : holdingPnL < 0 ? "text-red-600" : "text-neutral-500";
                  
                  const [owner, repoName] = holding.ticker.split('/');

                  return (
                    <div 
                      key={holding.ticker} 
                      className={`flex justify-between items-center px-6 py-6 group hover:bg-neutral-50 transition-colors duration-200 ${
                        index !== portfolio.length - 1 ? 'border-b border-neutral-200' : ''
                      }`}
                    >
                      <div className="flex flex-col">
                        <Link 
                          href={`/asset/${owner.toLowerCase()}/${repoName.toLowerCase()}`}
                          className="text-lg font-bold tracking-tighter text-black hover:text-neutral-500 transition-colors mb-1"
                        >
                          {holding.ticker}
                        </Link>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-[0.1em]">
                          {holding.shares} Shares @ {formatCurrency(averagePrice)}
                        </p>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <p className="text-xl tracking-tighter text-black mb-1">
                          {formatCurrency(totalValue)}
                        </p>
                        <p className={`text-[10px] uppercase tracking-[0.1em] ${colorClass}`}>
                          {sign}{formatCurrency(holdingPnL)} ({sign}{holdingPnLPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}