"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

const mockRepos = [
  { name: "NEXT.JS", owner: "vercel", price: 1271.50 },
  { name: "REACT", owner: "facebook", price: 2335.23 },
  { name: "RUST", owner: "rust-lang", price: 992.10 },
  { name: "BUN", owner: "oven-sh", price: 536.78 },
];

const steps = [
  { num: "01", title: "Discover", desc: "Browse curated categories of trending GitHub repositories, from frontend frameworks and systems languages to AI tools and hot new projects." },
  { num: "02", title: "Trade", desc: "Buy and sell shares with real-time pricing derived from GitHub stars. Every star moves the market — one star equals one cent." },
  { num: "03", title: "Track", desc: "Monitor your portfolio value, view interactive price charts, and track your profit and loss as the open-source landscape evolves." },
];

const features = [
  { title: "Real-Time GitHub Data", desc: "Prices update continuously from live GitHub star counts. The market reflects the real pulse of open source — no artificial data." },
  { title: "Simulated Brokerage", desc: "Start with $100,000 in simulated capital. Place market orders with slippage protection, manage positions, and compete on returns." },
  { title: "Portfolio Analytics", desc: "Track your holdings, average entry prices, and unrealized P&L. View historical price charts powered by real star data over time." },
];

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
        <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100">
              TRX.EXCHANGE
            </Link>
            <div className="flex items-center gap-6 text-sm">
              {mounted && (
                <button
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Toggle Theme"
                >
                  {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
              <Link href="/login" className="font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
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
        <section className="max-w-7xl mx-auto px-6 py-24 md:py-32 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">The Repo Exchange</p>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter mb-6 text-gray-900 dark:text-gray-100">
            The Stock Market<br />for Code
          </h1>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-10">
            Trade shares in open-source repositories. Prices move with real GitHub stars. Build your portfolio of the world&apos;s best code.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center h-10 px-6 bg-black text-white dark:bg-white dark:text-black text-xs font-bold tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Start Trading
          </Link>
        </section>

        {/* Product Preview */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] shadow-sm p-6 md:p-8">
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
                <div key={repo.name} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-5 flex flex-col justify-between">
                  <div className="mb-8">
                    <h3 className="text-lg font-bold tracking-tighter text-gray-900 dark:text-gray-100 truncate">{repo.name}</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{repo.owner}</p>
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
                    </div>
                    <div className="h-8 px-4 flex items-center text-[10px] font-bold tracking-widest uppercase bg-black text-white dark:bg-white dark:text-black">
                      Buy
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200 dark:border-gray-800">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">How It Works</p>
          <h2 className="text-3xl font-semibold tracking-tighter mb-12 text-gray-900 dark:text-gray-100">Three steps to your first trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-6 shadow-sm">
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 font-mono">{step.num}</span>
                <h3 className="text-xl font-semibold tracking-tighter mt-3 mb-2 text-gray-900 dark:text-gray-100">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200 dark:border-gray-800">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-4">Features</p>
          <h2 className="text-3xl font-semibold tracking-tighter mb-12 text-gray-900 dark:text-gray-100">Built for the open-source era</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] p-6 shadow-sm">
                <h3 className="text-lg font-semibold tracking-tighter mb-2 text-gray-900 dark:text-gray-100">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="bg-gray-900 dark:bg-white p-12 md:p-16 text-center">
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
