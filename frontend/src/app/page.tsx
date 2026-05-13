"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

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

export default function TradingTerminal() {
  const [discoveryData, setDiscoveryData] = useState<Record<string, Repository[]>>({});
  const [message, setMessage] = useState<SystemMessage>(null);
  const [processingTicker, setProcessingTicker] = useState<string | null>(null);
  
  // dynamic states
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);

  const supabase = createClient();

  useEffect(() => {
    // check auth user
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // no user -> redirect to login
        window.location.href = "/login";
      } else {
        // if correct, store on database and fetch balance/portfolio
        setUserId(user.id);
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, []);

  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://localhost:8080/api/balance/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
      }
    } catch (error) {
      console.error("Ledger offline");
    }
  };

  const fetchPortfolio = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://localhost:8080/api/portfolio/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data.portfolio || []);
      }
    } catch (error) {
      console.error("Ledger offline");
    }
  };

  useEffect(() => {
    if (userId) {
      fetchPortfolio();
      fetchBalance();
    }

    const fetchDiscovery = async () => {
      try {
        const res = await fetch("http://localhost:8080/api/discovery");
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
    return () => clearInterval(interval);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = async (ticker: string) => {
    if (!userId) return;
    
    setProcessingTicker(ticker);
    setMessage(null);
    
    try {
      const response = await fetch("http://localhost:8080/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId, // use real-ids for trading
          ticker: ticker,
          shares: 1,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage({ text: `Filled: 1 QTY of ${ticker} @ Market`, type: "success" });
        fetchBalance();
        fetchPortfolio();
      } else {
        setMessage({ text: `Rejected: ${result.error}`, type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Connection refused by Ledger.", type: "error" });
    } finally {
      setProcessingTicker(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // prevent flashing of terminal before auth check
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-mono text-sm text-neutral-400">
        SECURING CONNECTION...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-black font-sans relative selection:bg-black selection:text-white">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-mono text-sm font-bold tracking-tight">TRX.EXCHANGE</span>
              <div className="h-4 w-[1px] bg-neutral-300"></div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-black"></span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-500">System Live</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-neutral-400 mr-3">Session</span>
                <span className="text-xs font-mono bg-neutral-100 px-2 py-1 text-neutral-600 border border-neutral-200">
                  {userId?.split('-')[0]}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
              >
                End
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tighter mb-1">The Repo Exchange</h1>
              <p className="text-sm text-neutral-500 font-mono">B2C Quantitative Repository Pricing</p>
            </div>
            
            <div className="text-right">
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-neutral-400 mb-1">Purchasing Power</p>
              <p className="text-xl font-mono tracking-tighter text-black">
                {balance !== null 
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(balance)
                  : "Awaiting Ledger..."}
              </p>
            </div>
          </div>

          <div className="space-y-12">
            {Object.keys(discoveryData).length === 0 ? (
              <div className="p-12 text-center text-sm font-mono text-neutral-400 border border-neutral-200 bg-white shadow-sm">
                INITIALIZING DISCOVERY...
              </div>
            ) : (
              Object.entries(discoveryData).map(([category, repos]) => (
                <div key={category}>
                  <h2 className="text-[11px] tracking-[0.25em] font-bold uppercase text-neutral-500 mb-4">{category}</h2>
                  <div className="flex overflow-x-auto gap-4 pb-4 snap-x [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                    {repos.map((repo) => (
                      <div key={repo.ticker} className="flex-none w-72 snap-center border border-neutral-200 bg-white p-5 flex flex-col justify-between hover:bg-neutral-50 transition-colors duration-200">
                        <div className="mb-8">
                          <Link 
                            href={`/asset/${repo.ticker.split('/')[0].toLowerCase()}/${repo.ticker.split('/')[1].toLowerCase()}`}
                            className="block hover:text-neutral-500 transition-colors cursor-pointer mb-3"
                          >
                            <h3 className="text-lg font-bold tracking-tighter text-black inherit truncate">
                              {repo.ticker.split('/')[1].toUpperCase()}
                            </h3>
                            <p className="text-[10px] text-neutral-500 mt-0.5 inherit truncate">
                              {repo.ticker.split('/')[0]}
                            </p>
                          </Link>
                          <p className="text-[10px] text-neutral-400 font-mono line-clamp-2 h-7 leading-tight overflow-hidden">
                            {repo.description || "No description available."}
                          </p>
                        </div>
                        
                        <div className="flex justify-between items-end mt-auto">
                          <div>
                            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-neutral-400 mb-1">Mark Price</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm text-neutral-400 font-mono">$</span>
                              <span className="text-2xl font-light tracking-tighter text-black font-mono">
                                {Number(repo.current_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => handleBuy(repo.ticker)}
                            disabled={processingTicker === repo.ticker}
                            className={`h-8 px-4 text-[10px] font-bold tracking-widest uppercase transition-all duration-150 ${
                              processingTicker === repo.ticker 
                                ? "bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200" 
                                : "bg-black text-white hover:bg-neutral-800 active:scale-[0.98]"
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

          <div className="mt-16">
            <h2 className="text-xl font-semibold tracking-tighter mb-4 text-black">Current Holdings</h2>
            <div className="border border-neutral-200 bg-white">
              {portfolio.length === 0 ? (
                <div className="p-12 text-center text-sm font-mono text-neutral-400">
                  NO ASSETS HELD
                </div>
              ) : (
                <div className="w-full text-left font-mono">
                  <div className="grid grid-cols-3 border-b border-neutral-200 bg-neutral-50 px-6 py-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Ticker</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 text-right">Total Shares</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 text-right">Avg Entry Price</div>
                  </div>
                  {portfolio.map((holding, index) => (
                    <div 
                      key={holding.ticker} 
                      className={`grid grid-cols-3 px-6 py-4 items-center group hover:bg-neutral-50 transition-colors duration-200 ${
                        index !== portfolio.length - 1 ? 'border-b border-neutral-200' : ''
                      }`}
                    >
                      <div className="font-bold tracking-tighter text-sm text-black">
                        {holding.ticker}
                      </div>
                      <div className="text-sm tracking-tighter text-black text-right">
                        {holding.shares.toLocaleString()}
                      </div>
                      <div className="text-sm tracking-tighter text-black text-right">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(holding.average_price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {message && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-4 py-3 border text-sm font-mono shadow-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-white border-black text-black' 
              : 'bg-black border-black text-white'
          }`}>
            <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-black' : 'bg-red-500'}`}></div>
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}