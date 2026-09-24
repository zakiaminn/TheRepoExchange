"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Wordmark } from "@/components/Logo";
import { NAV, STATE } from "@/lib/copy";

type TickerSuggestion = { ticker: string; category: string };

/* the top bar: the masthead, laid out like a newspaper front page, which is
   most of why this feels like an exchange and not a dashboard. shows up on
   every logged-in page; it just returns null when there's no session (the
   landing page brings its own nav). */
export function Header() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  // which suggestion the arrow keys are on; -1 means none, and Enter falls
  // back to the first match
  const [active, setActive] = useState(-1);
  const [tickers, setTickers] = useState<TickerSuggestion[]>([]);

  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();

  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // populates the autocomplete index. filtering client-side means typing
  // doesn't hit the API on every keystroke.
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
      } catch {
        // no autocomplete; typing owner/repo directly still works
      }
    };
    load();
  }, []);

  // follow the session rather than asking for it once. this used to be a
  // single getUser() on mount, and the header lives in the root layout, so it
  // mounts once per page load: sign in on /login (where it had already
  // recorded "no user") and the bar stayed gone until a reload, and any
  // failed or thrown lookup hid it for the rest of the visit. the listener
  // fires INITIAL_SESSION straight away from the stored session, then again
  // on sign-in, sign-out, token refresh and name changes. it's only deciding
  // whether to draw the bar; every page still verifies the user itself.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
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
    if (suggestions.length > 0) return goTo(suggestions[Math.max(0, active)].ticker);
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(query.trim())) goTo(query.trim());
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (pathname === "/login" || authLoading || !user) return null;

  let initials = "-";
  let displayName = "Account";
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
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + suggestions.length) % suggestions.length);
          }
        }}
        role="combobox"
        aria-expanded={showSuggestions && suggestions.length > 0}
        aria-controls="search-suggestions"
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
        placeholder={NAV.search}
        aria-label={NAV.search}
        className="field h-9 pr-9 text-[13px]"
      />
      {/* the slash hint disappears the moment the field has focus or content */}
      {query.length === 0 && (
        <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center justify-center border border-rule-2 px-1.5 py-0.5 text-[10px] text-ink-3 md:flex">
          /
        </span>
      )}
      {showSuggestions && query.trim().length > 0 && (
        <div id="search-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border border-rule-2 bg-paper">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-ink-3">{STATE.noSuggestions}</div>
          ) : (
            // no motion on the highlight: arrowing through a list is something
            // you do fast and often, so it has to keep up with the keys
            suggestions.map((s, i) => (
              <button
                key={s.ticker}
                id={`suggestion-${i}`}
                role="option"
                aria-selected={i === active}
                type="button"
                tabIndex={-1}
                onClick={() => goTo(s.ticker)}
                onMouseMove={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 border-b border-rule px-3 py-2 text-left last:border-b-0 ${
                  i === active ? "bg-paper-2" : ""
                }`}
              >
                <span className="truncate text-[13px] text-ink">{s.ticker}</span>
                <span className="label shrink-0 text-[10px]">{s.category}</span>
              </button>
            ))
          )}
        </div>
      )}
    </form>
  );

  return (
    // named so a navigation leaves the bar in place instead of fading it out
    // and back in with the rest of the page
    <header className="sticky top-0 z-40 border-b border-rule bg-[var(--paper)]/92 backdrop-blur-md [view-transition-name:site-header]">
      <div className="mx-auto flex h-14 max-w-[76rem] items-center gap-5 px-5 sm:px-8">
        <Link href="/" className="shrink-0" aria-label="TRX, The Repo Exchange">
          <Wordmark size="md" showName="wide" />
        </Link>

        <div className="ml-auto hidden max-w-sm flex-1 md:block">{search}</div>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          <Link
            href="/portfolio"
            className={`px-3 py-2 text-[13px] sig ${
              pathname === "/portfolio" ? "text-ink" : "text-ink-2"
            }`}
          >
            {NAV.positions}
          </Link>
          <Link
            href="/calls"
            className={`px-3 py-2 text-[13px] sig ${
              pathname === "/calls" ? "text-ink" : "text-ink-2"
            }`}
          >
            {NAV.calls}
          </Link>
        </nav>

        <div ref={menuRef} className="relative hidden shrink-0 md:block">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="ctl ctl-sm gap-2 pl-1 pr-3.5"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-[11px] font-medium text-ink">
              {initials}
            </span>
            <span className="max-w-[9rem] truncate text-[13px] text-ink-2">{displayName}</span>
          </button>

          {menuOpen && (
            <div role="menu" className="menu absolute right-0 top-full z-50 mt-1 w-52 border border-rule-2 bg-paper">
              <div className="border-b border-rule px-3 py-2.5">
                <div className="label mb-0.5">{NAV.account}</div>
                <div className="truncate text-[11px] text-ink-2">{user?.email}</div>
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
          className="ctl ctl-sm ctl-icon ml-auto text-ink-2 md:hidden"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden="true">
            <span className="block h-px w-4 bg-current" />
            <span className={`block h-px w-4 bg-current ${mobileOpen ? "opacity-0" : ""}`} />
            <span className="block h-px w-4 bg-current" />
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div className="drop border-t border-rule bg-paper px-5 py-4 md:hidden">
          {search}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/portfolio" onClick={() => setMobileOpen(false)} className="ctl">
              {NAV.positions}
            </Link>
            <Link href="/calls" onClick={() => setMobileOpen(false)} className="ctl">
              {NAV.calls}
            </Link>
            <Link href="/settings" onClick={() => setMobileOpen(false)} className="ctl">
              {NAV.account}
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-rule pt-4">
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-3 text-[11px] text-ink">{initials}</span>
              <span className="truncate text-[13px] text-ink-2">{displayName}</span>
            </span>
            <button onClick={signOut} className="ctl ctl-sm">Sign out</button>
          </div>
        </div>
      )}
    </header>
  );
}
