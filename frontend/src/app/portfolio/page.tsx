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
  const pnlColor = totalPnL > 0 ? "text-bull" : totalPnL < 0 ? "text-bear" : "text-ink-muted";

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center text-sm text-ink-muted">
        LOADING PORTFOLIO...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-ink font-sans relative selection:bg-accent selection:text-accent-foreground pb-20 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* hero section - big net worth number front and center */}
          <div className="mb-16 pb-12 text-center relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.02] dark:opacity-[0.04]">
              <span className="text-[16rem] font-display font-bold tracking-tighter leading-none">$</span>
            </div>
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-4">Total Net Worth</p>
              <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-ink mb-6 tabular-nums break-all sm:break-normal">
                {formatCurrency(netWorth)}
              </h1>
              <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-edge bg-card shadow-brutal-sm">
                <div className={`h-2 w-2 rounded-full ${totalPnL >= 0 ? 'bg-bull' : 'bg-bear'}`}></div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">P&L</p>
                <p className={`text-sm tracking-tighter font-medium tabular-nums ${pnlColor}`}>
                  {pnlSign}{formatCurrency(totalPnL)}
                </p>
              </div>
            </div>
            <div className="mt-12 border-b-2 border-edge"></div>
          </div>

          {/* cash breakdown */}
          <div className="mb-12 border-2 border-edge bg-card p-6 shadow-brutal-sm flex justify-between items-center">
            <span className="text-[11px] uppercase tracking-[0.25em] text-ink-muted font-bold">Available Cash</span>
            <span className="font-display text-xl font-bold tracking-tighter text-ink tabular-nums">
              {formatCurrency(cash)}
            </span>
          </div>

          {/* holdings ledger - one row per position, with its own p&l calc'd inline */}
          <div>
            <h2 className="text-[11px] tracking-[0.25em] font-bold uppercase text-ink-muted mb-6">Holdings Ledger</h2>

            {portfolio.length === 0 ? (
              <div className="border-2 border-edge bg-card p-12 text-center text-sm text-ink-muted shadow-brutal-sm">
                NO ASSETS HELD
              </div>
            ) : (
              <div className="border-2 border-edge bg-card shadow-brutal-sm">
                {portfolio.map((holding, index) => {
                  const currentPrice = Number(holding.current_price);
                  const averagePrice = Number(holding.average_price);
                  const totalValue = currentPrice * holding.shares;
                  const holdingPnL = (currentPrice - averagePrice) * holding.shares;
                  const holdingPnLPercent = ((currentPrice - averagePrice) / averagePrice) * 100;

                  const sign = holdingPnL >= 0 ? "+" : "";
                  const colorClass = holdingPnL > 0 ? "text-bull" : holdingPnL < 0 ? "text-bear" : "text-ink-muted";

                  const [owner, repoName] = holding.ticker.split('/');

                  return (
                    <div
                      key={holding.ticker}
                      className={`flex justify-between items-center px-6 py-6 group hover:bg-card-alt transition-colors duration-200 border-l-4 ${
                        holdingPnL >= 0 ? 'border-l-bull/40 hover:border-l-bull' : 'border-l-bear/40 hover:border-l-bear'
                      } ${
                        index !== portfolio.length - 1 ? 'border-b-2 border-edge' : ''
                      }`}
                    >
                      <div className="flex flex-col">
                        <Link
                          href={`/asset/${owner.toLowerCase()}/${repoName.toLowerCase()}`}
                          className="font-display text-lg font-bold tracking-tighter text-ink hover:text-accent transition-colors mb-1"
                        >
                          {holding.ticker}
                        </Link>
                        <p className="text-[10px] text-ink-muted uppercase tracking-[0.1em]">
                          {holding.shares} Shares @ {formatCurrency(averagePrice)}
                        </p>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <p className="font-display text-xl tracking-tighter text-ink mb-1 tabular-nums">
                          {formatCurrency(totalValue)}
                        </p>
                        <p className={`text-[10px] uppercase tracking-[0.1em] tabular-nums ${colorClass}`}>
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
