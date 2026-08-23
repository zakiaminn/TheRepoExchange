"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Wordmark } from "@/components/Logo";
import { TickerTape, type TapeItem } from "@/components/TickerTape";
import { LiveDot } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { change } from "@/lib/format";
import { NAV, STATE } from "@/lib/copy";

type TickerSuggestion = { ticker: string; category: string };

/* the top bar. two rows: the masthead, and the ticker tape under it. that
   title-then-quotes stack is how newspapers have opened their front page
   forever, and it's most of why this feels like an exchange and not a
   dashboard. shows up on every logged-in page; it just returns null when
   there's no session (the landing page brings its own nav). */
export function Header() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tickers, setTickers] = useState<TickerSuggestion[]>([]);
  const [tape, setTape] = useState<TapeItem[]>([]);

  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // one call feeds two things: the autocomplete index and the tape. Filtering
  // client-side means typing doesn't hit the API on every keystroke.
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) return;
        const data = await res.json();

        const flat: TickerSuggestion[] = Object.entries(data).flatMap(
          ([category, repos]: [string, any]) =>
            (repos as any[]).map((r) => ({ ticker: r.ticker, category }))
        );
        setTickers(flat);

        // the tape wants the most active listings, not all of them — a strip
        // with two hundred items on it scrolls for four minutes before it
        // repeats, which defeats the point of a repeating strip
        const items: TapeItem[] = Object.values(data)
          .flat()
          .map((r: any) => ({
            ticker: r.ticker,
            price: Number(r.current_price),
            change: Array.isArray(r.sparkline) && r.sparkline.length > 1
              ? change(r.sparkline[0], r.sparkline[r.sparkline.length - 1])
              : null,
          }))
          .filter((r: TapeItem) => Number.isFinite(r.price))
          .slice(0, 18);
        setTape(items);
      } catch {
        // no tape and no autocomplete; typing owner/repo directly still works
      }
    };
    load();
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    };
    getUser();
  }, [supabase.auth]);

  // dismiss the account menu and the suggestion list on any outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // "/" focuses search, Escape leaves it. Terminal convention, and the kind
  // of thing the people who'd actually use this expect to work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // matches anywhere in the string, so "react" surfaces facebook/react as
  // well as react/react
  const suggestions =
    query.trim().length > 0
      ? tickers.filter((t) => t.ticker.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
      : [];

  const goTo = (ticker: string) => {
    const [o, r] = ticker.split("/");
    setQuery("");
    setShowSuggestions(false);
    setMobileOpen(false);
    router.push(`/asset/${o.toLowerCase()}/${r.toLowerCase()}`);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) return goTo(suggestions[0].ticker);
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(query.trim())) goTo(query.trim());
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (pathname === "/login" || authLoading || !user) return null;

  let initials = "—";
  let displayName = "Member";
  if (user?.user_metadata) {
    const first = user.user_metadata.first_name || "";
    const last = user.user_metadata.last_name || "";
    if (first && last) {
      initials = `${first[0]}${last[0]}`.toUpperCase();
      displayName = `${first} ${last}`;
    } else if (user.email) {
      initials = user.email[0].toUpperCase();
      displayName = user.email.split("@")[0];
    }
  }

  const search = (
    <form ref={searchRef} onSubmit={onSearch} className="relative w-full" role="search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        placeholder={NAV.search}
        aria-label={NAV.search}
        className="field h-9 pr-9 font-mono text-[13px]"
      />
      {/* the slash hint disappears the moment the field has focus or content */}
      {query.length === 0 && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center justify-center border border-rule-2 px-1.5 py-0.5 text-[10px] text-ink-3 md:flex">
          /
        </span>
      )}
      {showSuggestions && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border border-rule-2 bg-paper">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-ink-3">{STATE.noSuggestions}</div>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.ticker}
                type="button"
                onClick={() => goTo(s.ticker)}
                className="flex w-full items-center justify-between gap-3 border-b border-rule px-3 py-2 text-left last:border-b-0 hover:bg-paper-2"
              >
                <span className="figure truncate text-[13px] text-ink">{s.ticker}</span>
                <span className="label shrink-0 text-[10px]">{s.category}</span>
              </button>
            ))
          )}
        </div>
      )}
    </form>
  );

  const themeToggle = <ThemeToggle />;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-[var(--paper)]/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[76rem] items-center gap-5 px-5 sm:px-8">
        <Link href="/" className="shrink-0" aria-label="TRX, The Repo Exchange">
          <Wordmark size="md" showName={false} />
        </Link>

        <span className="hidden h-5 w-px shrink-0 bg-rule-2 lg:block" aria-hidden="true" />

        <span className="hidden shrink-0 items-center gap-2 lg:flex">
          <LiveDot />
          <span className="label">{NAV.board}</span>
        </span>

        <div className="ml-auto hidden max-w-sm flex-1 md:block">{search}</div>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <Link
            href="/portfolio"
            className={`px-3 py-2 text-[13px] transition-colors hover:text-brand-ink ${
              pathname === "/portfolio" ? "text-ink" : "text-ink-2"
            }`}
          >
            {NAV.positions}
          </Link>
          {themeToggle}
        </nav>

        <div ref={menuRef} className="relative hidden shrink-0 md:block">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 border border-rule py-1 pl-1 pr-3 transition-colors hover:border-rule-2"
          >
            <span className="figure flex h-7 w-7 items-center justify-center bg-paper-3 text-[11px] font-medium text-ink">
              {initials}
            </span>
            <span className="max-w-[9rem] truncate text-[13px] text-ink-2">{displayName}</span>
          </button>

          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 border border-rule-2 bg-paper">
              <div className="border-b border-rule px-3 py-2.5">
                <div className="label mb-0.5">{NAV.account}</div>
                <div className="figure truncate text-[11px] text-ink-2">{user?.email}</div>
              </div>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="block border-b border-rule px-3 py-2.5 text-[13px] text-ink hover:bg-paper-2"
              >
                {NAV.account}
              </Link>
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="block w-full px-3 py-2.5 text-left text-[13px] text-ink hover:bg-paper-2"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* mobile: everything collapses into the panel below */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={NAV.menu}
          aria-expanded={mobileOpen}
          className="ml-auto flex h-9 w-9 items-center justify-center border border-rule text-ink-2 md:hidden"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden="true">
            <span className="block h-px w-4 bg-current" />
            <span className={`block h-px w-4 bg-current ${mobileOpen ? "opacity-0" : ""}`} />
            <span className="block h-px w-4 bg-current" />
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-rule bg-paper px-5 py-4 md:hidden">
          {search}
          <div className="mt-4 grid grid-cols-2 gap-px border border-rule bg-rule">
            <Link href="/portfolio" onClick={() => setMobileOpen(false)} className="bg-paper px-3 py-3 text-[13px] text-ink">
              {NAV.positions}
            </Link>
            <Link href="/settings" onClick={() => setMobileOpen(false)} className="bg-paper px-3 py-3 text-[13px] text-ink">
              {NAV.account}
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
            <span className="flex items-center gap-2.5">
              <span className="figure flex h-7 w-7 items-center justify-center bg-paper-3 text-[11px] text-ink">{initials}</span>
              <span className="truncate text-[13px] text-ink-2">{displayName}</span>
            </span>
            <span className="flex items-center gap-2">
              {themeToggle}
              <button onClick={signOut} className="label hover:text-brand-ink">Sign out</button>
            </span>
          </div>
        </div>
      )}

      <TickerTape items={tape} />
    </header>
  );
}
