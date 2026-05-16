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
  
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) { //wrong user sends back to login
        window.location.href = "/login";
      } else {
        setUserId(user.id);
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, [supabase.auth]);

  const fetchBalance = async () => { // fetch purchasing power balance from ledger
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
    } catch (error) {
      console.error("Ledger offline");
    }
  };

  const fetchPortfolio = async () => { // fetch holdings from ledger
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

  useEffect(() => { // initial fetch of balance and portfolio on login, and refetch every time userId changes 
    if (userId) {
      fetchPortfolio();
      fetchBalance();
    }

    const fetchDiscovery = async () => { // fetch discovery data from backend every 5 seconds, which in turn fetches from the database every 5 seconds
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
    return () => clearInterval(interval);
  }, [userId]); // only fetch discovery data after confirming user is authenticated and has a userId, then continue to refetch every 5 seconds to keep data fresh

  const handleBuy = async (ticker: string, currentPrice: number) => { // handle buy order for a ticker
    if (!userId) return; // if for some reason userId is not set, do not proceed with buy
    
    setProcessingTicker(ticker); // set the currently processing ticker to disable its buy button and show "Routing..." text
    setMessage(null); // clear any existing system messages
    
    try { // send buy request to ledger
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/buy`, { // standard RESTful API design with POST method for creating a new buy order
        method: "POST", // using POST method to indicate creation of a new buy order
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        }, // setting content type to JSON for the request body
        body: JSON.stringify({ // sending userId and ticker in the request body for the ledger to process the buy order
          ticker: ticker, // passing ticker to specify which asset the user wants to buy
          shares: 1, // hardcoding shares to 1 for simplicity, can be extended to allow user input for number of shares in the future
          expectedPrice: currentPrice // passing the current price as the expected price for the buy order, this can be used by the ledger to check for slippage or price changes before filling the order
        }),
      });

      const result = await response.json(); // parsing the JSON response from the ledger, which should  either a success confirmation or an error message
      
      if (response.ok) { // if the response status is in the 200-299 range, consider it a successful buy order
        setMessage({ text: `Filled: 1 QTY of ${ticker} @ Market`, type: "success" }); // showing a success message with the filled order details, in a real application this could include the actual filled price and timestamp returned from the ledger
        fetchBalance(); // refetch balance to update purchasing power after the buy order
        fetchPortfolio(); // refetch portfolio to update holdings after the buy order
      } else { 
        setMessage({ text: `Rejected: ${result.error}`, type: "error" }); // if the response status indicates an error, 
                                                                          // show the error message returned from the ledger, 
                                                                          // which could be due to insufficient balance, invalid ticker, 
                                                                          // or any other business logic enforced by the ledger
      }
    } catch (err) {
      setMessage({ text: "Connection refused by Ledger.", type: "error" }); // if there is a network error or the ledger is offline shpw mesage
    } finally {
      setProcessingTicker(null); // reset the processing ticker to re-enable the buy button and reset its text, this happens regardless of success or failure of the buy order
      setTimeout(() => setMessage(null), 4000); //clear message after 4 seconds
    }
  };

  if (isInitializing) { // while checking auth stat
    return ( //show this
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        SECURING CONNECTION...
      </div>
    ); //prevents flashing
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans relative selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-7xl mx-auto px-6 py-12"> 
          <div className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tighter mb-1">The Repo Exchange</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">B2C Quantitative Repository Pricing</p>
            </div>
            
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-1">Purchasing Power</p>
              <p className="text-xl font-mono tracking-tighter text-gray-900 dark:text-gray-100">
                {balance !== null 
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(balance)
                  : "Awaiting Ledger..."}
              </p>
            </div>
          </div>

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
                      <div key={repo.ticker} className="flex-none w-72 snap-center border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-5 flex flex-col justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
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

          <div className="mt-16">
            <h2 className="text-xl font-semibold tracking-tighter mb-4 text-gray-900 dark:text-gray-100">Current Holdings</h2>
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212]">
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

      {message && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`px-4 py-3 border text-sm shadow-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-white dark:bg-[#121212] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100' 
              : 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900'
          }`}>
            <div className={`h-2 w-2 rounded-full ${message.type === 'success' ? 'bg-black dark:bg-white' : 'bg-red-500'}`}></div>
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}
