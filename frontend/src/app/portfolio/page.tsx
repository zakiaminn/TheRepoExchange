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

// net worth summary page - shows total value, overall p&l, and a breakdown of every
// position the user is holding
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const fetchOptions = {
          headers: { Authorization: `Bearer ${session.access_token}` }
        };

        // fire both requests off at the same time instead of one after the other,
        // cuts the load time roughly in half
        const [balanceRes, portfolioRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${userId}`, fetchOptions),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${userId}`, fetchOptions)
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
  }, [userId, supabase.auth]);

  // derive the portfolio summary numbers from what we fetched. all of this is just math
  // on data we already have, no extra api calls needed
  const cash = balance || 0;

  // sum up what every position is currently worth (shares * live price)
  const totalAssetValue = portfolio.reduce((acc, holding) => {
    return acc + (holding.shares * Number(holding.current_price));
  }, 0);

  const netWorth = cash + totalAssetValue;

  // total profit/loss across everything - current value minus what they paid for it
  const totalPnL = portfolio.reduce((acc, holding) => {
    return acc + ((Number(holding.current_price) - Number(holding.average_price)) * holding.shares);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  };

  const pnlSign = totalPnL >= 0 ? "+" : "";
  const pnlColor = totalPnL > 0 ? "text-green-600 dark:text-green-400" : totalPnL < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400";

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center font-mono text-sm text-gray-500 dark:text-gray-400">
        LOADING PORTFOLIO...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans relative selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 pb-20 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* hero section - big net worth number front and center */}
          <div className="mb-16 pb-12 text-center relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.02] dark:opacity-[0.04]">
              <span className="text-[16rem] font-mono font-bold tracking-tighter leading-none">$</span>
            </div>
            <div className="relative">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">Total Net Worth</p>
              <h1 className="text-7xl font-light tracking-tighter text-gray-900 dark:text-gray-100 font-mono mb-6">
                {formatCurrency(netWorth)}
              </h1>
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] shadow-sm">
                <div className={`h-2 w-2 rounded-full ${totalPnL >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">P&L</p>
                <p className={`text-sm font-mono tracking-tighter font-medium ${pnlColor}`}>
                  {pnlSign}{formatCurrency(totalPnL)}
                </p>
              </div>
            </div>
            <div className="mt-12 border-b border-gray-200 dark:border-gray-800"></div>
          </div>

          {/* cash breakdown */}
          <div className="mb-12 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] p-6 shadow-sm flex justify-between items-center">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400 font-bold">Available Cash</span>
            <span className="text-xl font-mono tracking-tighter text-gray-900 dark:text-gray-100">
              {formatCurrency(cash)}
            </span>
          </div>

          {/* holdings ledger - one row per position, with its own p&l calc'd inline */}
          <div>
            <h2 className="text-[11px] tracking-[0.25em] font-bold uppercase text-gray-500 dark:text-gray-400 mb-6">Holdings Ledger</h2>

            {portfolio.length === 0 ? (
              <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] p-12 text-center text-sm font-mono text-gray-500 dark:text-gray-400 shadow-sm">
                NO ASSETS HELD
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] shadow-sm font-mono">
                {portfolio.map((holding, index) => {
                  const currentPrice = Number(holding.current_price);
                  const averagePrice = Number(holding.average_price);
                  const totalValue = currentPrice * holding.shares;
                  const holdingPnL = (currentPrice - averagePrice) * holding.shares;
                  const holdingPnLPercent = ((currentPrice - averagePrice) / averagePrice) * 100;

                  const sign = holdingPnL >= 0 ? "+" : "";
                  const colorClass = holdingPnL > 0 ? "text-green-600 dark:text-green-400" : holdingPnL < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400";

                  const [owner, repoName] = holding.ticker.split('/');

                  return (
                    <div
                      key={holding.ticker}
                      className={`flex justify-between items-center px-6 py-6 group hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors duration-200 border-l-2 ${
                        holdingPnL >= 0 ? 'border-l-green-500/40 hover:border-l-green-500' : 'border-l-red-500/40 hover:border-l-red-500'
                      } ${
                        index !== portfolio.length - 1 ? 'border-b border-b-gray-200 dark:border-b-gray-800' : ''
                      }`}
                    >
                      <div className="flex flex-col">
                        <Link
                          href={`/asset/${owner.toLowerCase()}/${repoName.toLowerCase()}`}
                          className="text-lg font-bold tracking-tighter text-gray-900 dark:text-gray-100 hover:text-accent transition-colors mb-1"
                        >
                          {holding.ticker}
                        </Link>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">
                          {holding.shares} Shares @ {formatCurrency(averagePrice)}
                        </p>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <p className="text-xl tracking-tighter text-gray-900 dark:text-gray-100 mb-1">
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
