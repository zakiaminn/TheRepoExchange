"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { MiniSparkline } from "@/components/MiniSparkline";

// fake data just for the little "product preview" card on the landing page. none of this
// is real, it's purely to make the marketing page look alive before you've even logged in
const mockRepos = [
  { name: "NEXT.JS", owner: "vercel", price: 1271.50, change: +3.2, sparkline: [40, 42, 38, 44, 43, 47, 50, 48, 52, 55] },
  { name: "REACT", owner: "facebook", price: 2335.23, change: +1.8, sparkline: [60, 58, 62, 61, 64, 63, 66, 65, 68, 67] },
  { name: "RUST", owner: "rust-lang", price: 992.10, change: -0.4, sparkline: [45, 47, 46, 44, 48, 46, 43, 45, 44, 43] },
  { name: "BUN", owner: "oven-sh", price: 536.78, change: +7.1, sparkline: [20, 22, 25, 24, 28, 30, 32, 35, 38, 42] },
];

// content for the "how it works" 3-step section
const steps = [
  { num: "01", title: "Discover", desc: "Browse curated categories of trending GitHub repositories — from frontend frameworks and systems languages to AI tools and hot new projects." },
  { num: "02", title: "Trade", desc: "Buy and sell shares with real-time pricing derived from GitHub stars. Every star moves the market — one star equals one cent." },
  { num: "03", title: "Track", desc: "Monitor your portfolio value, view interactive price charts, and track your profit and loss as the open-source landscape evolves." },
];

// content for the 3-column features grid
const features = [
  { title: "Real-Time GitHub Data", desc: "Prices update continuously from live GitHub star counts. The market reflects the real pulse of open source — no artificial data.", icon: "◉" },
  { title: "Simulated Brokerage", desc: "Start with $100,000 in simulated capital. Place market orders with slippage protection, manage positions, and compete on returns.", icon: "◈" },
  { title: "Portfolio Analytics", desc: "Track your holdings, average entry prices, and unrealized P&L. View historical price charts powered by real star data over time.", icon: "◇" },
];

// the marketing page that shows up for anyone who isn't logged in yet. gets rendered by
// page.tsx when there's no user session, it's basically its own little standalone site
export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false); // same hydration-safety trick as Header.tsx

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-page text-ink font-sans relative selection:bg-accent selection:text-accent-foreground transition-colors duration-300">
      {/* keeping this exactly as-is, it's the one piece of the old look that's staying */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <div className="relative z-10">
        {/* nav - this page has its own nav bar since the shared Header component hides
            itself when there's no logged in user */}
        <nav className="border-b-2 border-edge bg-page/90 backdrop-blur-sm transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg tracking-tight text-ink">
              <Logo className="h-5 w-5 text-accent" />
              TRX.EXCHANGE
            </Link>
            <div className="flex items-center gap-4 sm:gap-6 text-sm">
              {mounted && (
                <button
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="p-2 text-ink-muted hover:bg-card-alt transition-colors"
                  aria-label="Toggle Theme"
                >
                  {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
              <Link href="/login" className="hidden sm:inline font-medium text-ink-muted hover:text-accent transition-colors">
                Sign In
              </Link>
              <Link
                href="/login"
                className="h-8 px-4 flex items-center border-2 border-edge bg-accent text-accent-foreground text-xs font-bold tracking-widest uppercase press-brutal shadow-brutal-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* hero */}
        <section className="max-w-7xl mx-auto px-6 pt-24 pb-16 md:pt-32 md:pb-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] dark:opacity-[0.04]">
            <span className="text-[20rem] md:text-[28rem] font-display font-bold tracking-tighter leading-none">$</span>
          </div>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-4">The Repo Exchange</p>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter mb-6 text-ink">
              The Stock Market<br />for <em className="not-italic font-medium">Code</em>
            </h1>
            <p className="text-base md:text-lg text-ink-muted max-w-lg mx-auto mb-10 leading-relaxed">
              Trade shares in open-source repositories. Prices move with real GitHub stars. Build your portfolio of the world&apos;s best code.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center h-10 px-6 border-2 border-edge bg-accent text-accent-foreground text-xs font-bold tracking-widest uppercase press-brutal shadow-brutal-sm"
              >
                Start Trading
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center h-10 px-6 border-2 border-edge text-xs font-bold tracking-widest uppercase text-ink-muted press-brutal shadow-brutal-sm hover:text-accent transition-colors"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        {/* product preview - this is the fake terminal mockup using mockRepos up top,
            none of these numbers are real */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="border-2 border-edge bg-page shadow-brutal p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">Market Open</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-ink-muted mb-1">Purchasing Power</p>
                {/* hardcoded 100k here, real starting balance is set in the db when a user signs up */}
                <p className="font-display text-lg font-bold tracking-tighter text-ink tabular-nums">$100,000.00</p>
              </div>
            </div>

            <h3 className="text-[11px] tracking-[0.25em] font-bold uppercase text-ink-muted mb-4">Trending</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mockRepos.map((repo) => (
                <div key={repo.name} className="border-2 border-edge bg-page p-5 flex flex-col justify-between press-brutal shadow-brutal-sm">
                  <div className="mb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-display text-lg font-bold tracking-tighter text-ink truncate">{repo.name}</h3>
                        <p className="text-[10px] text-ink-muted mt-0.5 truncate">{repo.owner}</p>
                      </div>
                      <MiniSparkline data={repo.sparkline} positive={repo.change >= 0} />
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-auto">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-muted mb-1">Mark Price</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-ink-muted">$</span>
                        <span className="font-display text-2xl font-bold tracking-tighter text-ink tabular-nums">
                          {repo.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <span className={`text-[10px] font-medium tabular-nums ${repo.change >= 0 ? "text-bull" : "text-bear"}`}>
                        {repo.change >= 0 ? "+" : ""}{repo.change.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-8 px-4 flex items-center text-[10px] font-bold tracking-widest uppercase bg-accent text-accent-foreground border-2 border-edge">
                      Buy
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-24 border-t-2 border-edge">
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-4">How It Works</p>
          <h2 className="font-display text-3xl font-bold tracking-tighter mb-16 text-ink">Three steps to your first trade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {steps.map((step) => (
              <div key={step.num}>
                <span className="font-display text-5xl font-bold tracking-tighter text-card-alt block mb-4 tabular-nums">{step.num}</span>
                <h3 className="font-display text-xl font-bold tracking-tighter mb-3 text-ink">{step.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* features */}
        <section className="max-w-7xl mx-auto px-6 py-24 border-t-2 border-edge">
          <div className="max-w-2xl mb-16">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-4">Features</p>
            <h2 className="font-display text-3xl font-bold tracking-tighter mb-4 text-ink">Built for the open-source era</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              A full trading simulation powered by real data. No artificial prices, no fake metrics — just GitHub stars driving the market.
            </p>
          </div>
          {/* each tile is its own independent bordered/shadowed block with real gaps between
              them, not the old shared-hairline-divider trick */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="bg-page border-2 border-edge shadow-brutal-sm p-8">
                <span className="text-2xl mb-4 block opacity-40 text-accent">{feature.icon}</span>
                <h3 className="font-display text-lg font-bold tracking-tighter mb-2 text-ink">{feature.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* cta banner - the one place accent gets to be the whole background instead of
            a small accent, it's meant to be the loudest moment on the page */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="border-2 border-edge bg-accent text-accent-foreground p-12 md:p-16 text-center relative overflow-hidden shadow-brutal">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.08]">
              <span className="text-[16rem] font-display font-bold tracking-tighter leading-none">TRX</span>
            </div>
            <div className="relative">
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tighter mb-4">
                Start Building Your Portfolio
              </h2>
              <p className="text-sm opacity-80 max-w-md mx-auto mb-8">
                Join the exchange and trade shares in the world&apos;s most popular open-source projects. No real money required.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center h-10 px-6 border-2 border-edge bg-page text-ink text-xs font-bold tracking-widest uppercase press-brutal shadow-brutal-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="border-t-2 border-edge">
          <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="flex items-center gap-2 font-display font-bold text-sm tracking-tight text-ink">
              <Logo className="h-4 w-4 text-accent" />
              TRX.EXCHANGE
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              &copy; {new Date().getFullYear()} TRX Exchange. All rights reserved.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
