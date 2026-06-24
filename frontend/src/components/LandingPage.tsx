"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

const mockRepos = [
  { name: "NEXT.JS", owner: "vercel", price: 1271.50, change: +3.2, sparkline: [40, 42, 38, 44, 43, 47, 50, 48, 52, 55] },
  { name: "REACT", owner: "facebook", price: 2335.23, change: +1.8, sparkline: [60, 58, 62, 61, 64, 63, 66, 65, 68, 67] },
  { name: "RUST", owner: "rust-lang", price: 992.10, change: -0.4, sparkline: [45, 47, 46, 44, 48, 46, 43, 45, 44, 43] },
  { name: "BUN", owner: "oven-sh", price: 536.78, change: +7.1, sparkline: [20, 22, 25, 24, 28, 30, 32, 35, 38, 42] },
];

const steps = [
  { num: "01", title: "Discover", desc: "Browse curated categories of trending GitHub repositories — from frontend frameworks and systems languages to AI tools and hot new projects." },
  { num: "02", title: "Trade", desc: "Buy and sell shares with real-time pricing derived from GitHub stars. Every star moves the market — one star equals one cent." },
  { num: "03", title: "Track", desc: "Monitor your portfolio value, view interactive price charts, and track your profit and loss as the open-source landscape evolves." },
];

const features = [
  { title: "Real-Time GitHub Data", desc: "Prices update continuously from live GitHub star counts. The market reflects the real pulse of open source — no artificial data.", icon: "◉" },
  { title: "Simulated Brokerage", desc: "Start with $100,000 in simulated capital. Place market orders with slippage protection, manage positions, and compete on returns.", icon: "◈" },
  { title: "Portfolio Analytics", desc: "Track your holdings, average entry prices, and unrealized P&L. View historical price charts powered by real star data over time.", icon: "◇" },
];

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 48;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans relative selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-sm transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100">
              TRX.EXCHANGE
            </Link>
            <div className="flex items-center gap-4 sm:gap-6 text-sm">
              {mounted && (
                <button
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Toggle Theme"
                >
                  {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
              <Link href="/login" className="hidden sm:inline font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                href="/login"
                className="h-8 px-4 flex items-center bg-black text-white dark:bg-white dark:text-black text-xs font-bold tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 pt-24 pb-16 md:pt-32 md:pb-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] dark:opacity-[0.04]">
            <span className="text-[20rem] md:text-[28rem] font-mono font-bold tracking-tighter leading-none">$</span>
          </div>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">The Repo Exchange</p>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter mb-6 text-gray-900 dark:text-gray-100">
              The Stock Market<br />for <em className="not-italic font-light italic">Code</em>
            </h1>
            <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-10 leading-relaxed">
              Trade shares in open-source repositories. Prices move with real GitHub stars. Build your portfolio of the world&apos;s best code.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center h-10 px-6 bg-black text-white dark:bg-white dark:text-black text-xs font-bold tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Start Trading
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center h-10 px-6 border border-gray-300 dark:border-gray-700 text-xs font-bold tracking-widest uppercase text-gray-600 dark:text-gray-400 hover:border-gray-900 dark:hover:border-gray-100 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        {/* Product Preview */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="relative">
            <div className="absolute -inset-px bg-gradient-to-b from-gray-200 via-gray-200/50 to-transparent dark:from-gray-700 dark:via-gray-700/50 rounded-sm pointer-events-none" />
            <div className="relative border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] shadow-lg p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Market Open</span>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-1">Purchasing Power</p>
                  <p className="text-lg font-mono tracking-tighter text-gray-900 dark:text-gray-100">$100,000.00</p>
                </div>
              </div>

              <h3 className="text-[11px] tracking-[0.25em] font-bold uppercase text-gray-500 dark:text-gray-400 mb-4">Trending</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockRepos.map((repo) => (
                  <div key={repo.name} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-5 flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">
                    <div className="mb-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold tracking-tighter text-gray-900 dark:text-gray-100 truncate">{repo.name}</h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{repo.owner}</p>
                        </div>
                        <MiniSparkline data={repo.sparkline} positive={repo.change >= 0} />
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-auto">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-1">Mark Price</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">$</span>
                          <span className="text-2xl font-light tracking-tighter text-gray-900 dark:text-gray-100 font-mono">
                            {repo.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-medium ${repo.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {repo.change >= 0 ? "+" : ""}{repo.change.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-8 px-4 flex items-center text-[10px] font-bold tracking-widest uppercase bg-black text-white dark:bg-white dark:text-black">
                        Buy
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200 dark:border-gray-800">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">How It Works</p>
          <h2 className="text-3xl font-semibold tracking-tighter mb-16 text-gray-900 dark:text-gray-100">Three steps to your first trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {steps.map((step) => (
              <div key={step.num}>
                <span className="text-5xl font-bold tracking-tighter text-gray-200 dark:text-gray-800 font-mono block mb-4">{step.num}</span>
                <h3 className="text-xl font-semibold tracking-tighter mb-3 text-gray-900 dark:text-gray-100">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-2xl mb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">Features</p>
            <h2 className="text-3xl font-semibold tracking-tighter mb-4 text-gray-900 dark:text-gray-100">Built for the open-source era</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              A full trading simulation powered by real data. No artificial prices, no fake metrics — just GitHub stars driving the market.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-800">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white dark:bg-[#121212] p-8">
                <span className="text-2xl mb-4 block opacity-20">{feature.icon}</span>
                <h3 className="text-lg font-semibold tracking-tighter mb-2 text-gray-900 dark:text-gray-100">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="bg-gray-900 dark:bg-white p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.05]">
              <span className="text-[16rem] font-mono font-bold tracking-tighter leading-none text-white dark:text-gray-900">TRX</span>
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter mb-4 text-white dark:text-gray-900">
                Start Building Your Portfolio
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto mb-8">
                Join the exchange and trade shares in the world&apos;s most popular open-source projects. No real money required.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center h-10 px-6 bg-white text-black dark:bg-gray-900 dark:text-white text-xs font-bold tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Get Started
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-semibold text-sm tracking-tight text-gray-900 dark:text-gray-100">TRX.EXCHANGE</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} TRX Exchange. All rights reserved.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
