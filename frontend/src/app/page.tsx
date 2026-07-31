"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { LandingPage } from "@/components/LandingPage";

type Repository = {
  ticker: string;
  current_price: number;
  description: string;
  category: string;
  raw_stars: number;
};

type SystemMessage = {
  text: string;
  type: "success" | "error";
} | null;

type Holding = {
  ticker: string;
  shares: number;
  average_price: number;
};

// this is the home page, but it's really two totally different pages depending on
// whether you're logged in: the marketing LandingPage if not, or the actual "trading
// terminal" (discovery feed + holdings) if you are
export default function TradingTerminal() {
  const [discoveryData, setDiscoveryData] = useState<Record<string, Repository[]>>({});
  const [message, setMessage] = useState<SystemMessage>(null);
  const [processingTicker, setProcessingTicker] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);

  const supabase = createClient();

  // check if anyone's logged in as soon as the page mounts. this decides whether we
  // render the trading terminal or just fall back to the landing page below
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsInitializing(false);
      } else {
        setUserId(user.id);
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, [supabase.auth]);

  const fetchBalance = async () => { // grab the user's balance so we can show their purchasing power
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
      // if res isn't ok we just leave balance as whatever it already was, no retry logic here
    } catch (error) {
      console.error("Ledger offline");
    }
  };

  const fetchPortfolio = async () => { // pull the user's current holdings
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data.portfolio || []);
      }
    } catch (error) {
      console.error("Ledger offline");
    }
  };

  useEffect(() => { // once we know who the user is, load their stuff
    if (userId) {
      fetchPortfolio();
      fetchBalance();
    }

    // discovery feed doesn't need auth, it's the same for everyone, so this runs
    // regardless of login state
    const fetchDiscovery = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (res.ok) {
          const data = await res.json();
          setDiscoveryData(data);
        }
      } catch (error) {
        console.error("Discovery offline");
      }
    };

    fetchDiscovery();
    const interval = setInterval(fetchDiscovery, 5000);
    return () => clearInterval(interval); // clean up the interval when the component unmounts, otherwise it just keeps polling forever in the background
  }, [userId]); // poll every 5 seconds to keep prices fresh

  // buy button on the discovery cards is hardcoded to 1 share, there's no quantity
  // selector here - that only exists on the individual asset page
  const handleBuy = async (ticker: string, currentPrice: number) => {
    if (!userId) return;

    setProcessingTicker(ticker); // disables just this one card's button while the request is in flight
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ticker: ticker,
          shares: 1, // hardcoded to 1 for now, might let users pick quantity later
          expectedPrice: Number(currentPrice) // ledger uses this to check for slippage before filling
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: `Filled: 1 QTY of ${ticker} @ Market`, type: "success" });
        // refetch so the balance and holdings table reflect the trade immediately
        fetchBalance();
        fetchPortfolio();
      } else {
        setMessage({ text: `Rejected: ${result.error}`, type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Connection refused by Ledger.", type: "error" });
    } finally {
      setProcessingTicker(null);
      setTimeout(() => setMessage(null), 4000); // clear the message after a bit so it doesn't just sit there
    }
  };

  // still checking auth, show a blank loading state instead of flashing the landing
  // page and then immediately swapping to the terminal
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        SECURING CONNECTION...
      </div>
    );
  }

  // nobody's logged in, just show the marketing page instead
  if (!userId) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans relative selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tighter mb-1">The Repo Exchange</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                The Stock Market for Code
              </p>
            </div>

            {/* purchasing power / cash balance readout */}
            <div className="text-right border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] px-5 py-3 shadow-sm">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-1">Purchasing Power</p>
              <p className="text-xl font-mono tracking-tighter text-gray-900 dark:text-gray-100">
                {balance !== null
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(balance)
                  : "Awaiting Ledger..."}
              </p>
            </div>
          </div>

          {/* discovery feed - one horizontally scrolling row per category from the api */}
          <div className="space-y-12">
            {Object.keys(discoveryData).length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] shadow-sm">
                INITIALIZING DISCOVERY...
              </div>
            ) : (
              Object.entries(discoveryData).map(([category, repos]) => (
                <div key={category}>
                  <h2 className="text-[11px] tracking-[0.25em] font-bold uppercase text-gray-500 dark:text-gray-400 mb-4">{category}</h2>
                  <div className="flex overflow-x-auto gap-4 pb-4 snap-x [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                    {repos.map((repo) => (
                      <div key={repo.ticker} className="flex-none w-72 snap-center border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] p-5 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200">
                        <div className="mb-8">
                          <Link
                            href={`/asset/${repo.ticker.split('/')[0].toLowerCase()}/${repo.ticker.split('/')[1].toLowerCase()}`}
                            className="block hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer mb-3"
                          >
                            <h3 className="text-lg font-bold tracking-tighter text-gray-900 dark:text-gray-100 inherit truncate">
                              {repo.ticker.split('/')[1].toUpperCase()}
                            </h3>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 inherit truncate">
                              {repo.ticker.split('/')[0]}
                            </p>
                          </Link>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 h-7 leading-tight overflow-hidden">
                            {repo.description || "No description available."}
                          </p>
                        </div>

                        <div className="flex justify-between items-end mt-auto">
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-1">Mark Price</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">$</span>
                              <span className="text-2xl font-light tracking-tighter text-gray-900 dark:text-gray-100 font-mono">
                                {Number(repo.current_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleBuy(repo.ticker, repo.current_price)}
                            disabled={processingTicker === repo.ticker}
                            className={`h-8 px-4 text-[10px] font-bold tracking-widest uppercase transition-all duration-150 ${
                              processingTicker === repo.ticker
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-800"
                                : "bg-black text-white dark:bg-white dark:text-black hover:opacity-90 active:scale-[0.98]"
                            }`}
                          >
                            {processingTicker === repo.ticker ? "Routing..." : "Buy"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* current holdings table, separate from the /portfolio page - this is just a
              quick glance, /portfolio has the full breakdown with p&l */}
          <div className="mt-16">
            <h2 className="text-xl font-semibold tracking-tighter mb-4 text-gray-900 dark:text-gray-100">Current Holdings</h2>
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] shadow-sm">
              {portfolio.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  NO ASSETS HELD
                </div>
              ) : (
                <div className="w-full text-left">
                  <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1a] px-6 py-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Ticker</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 text-right">Total Shares</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 text-right">Avg Entry Price</div>
                  </div>
                  {portfolio.map((holding, index) => {
                    const [owner, repo] = holding.ticker.split('/');
                    return (
                    <div
                      key={holding.ticker}
                      className={`grid grid-cols-3 px-6 py-4 items-center group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 ${
                        index !== portfolio.length - 1 ? 'border-b border-gray-200 dark:border-gray-800' : ''
                      }`}
                    >
                      <div className="font-bold tracking-tighter text-sm text-gray-900 dark:text-gray-100">
                        <Link
                          href={`/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`}
                          className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {holding.ticker}
                        </Link>
                      </div>
                      <div className="text-sm tracking-tighter text-gray-900 dark:text-gray-100 text-right font-mono">
                        {holding.shares.toLocaleString()}
                      </div>
                      <div className="text-sm tracking-tighter text-gray-900 dark:text-gray-100 text-right font-mono">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(holding.average_price)}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* little toast notification bottom-right for trade fills/rejections */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-4 py-3 text-sm shadow-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-white dark:bg-[#161616] border border-green-200 dark:border-green-900/50 text-gray-900 dark:text-gray-100'
              : 'bg-white dark:bg-[#161616] border border-red-200 dark:border-red-900/50 text-gray-900 dark:text-gray-100'
          }`}>
            <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}
