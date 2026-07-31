"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

type TickerSuggestion = { ticker: string; category: string };

// the top nav bar that sticks around on every page except login and the landing page.
// handles the search box + autocomplete, theme toggle, the user avatar dropdown, and a
// mobile hamburger menu since none of this fit on one row on a small screen
export function Header() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false); // need this so we don't render the theme toggle icon before we actually know the theme (avoids a hydration mismatch)
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allTickers, setAllTickers] = useState<TickerSuggestion[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);

  // pull the full ticker list once on mount so we can filter it client-side as the user
  // types, instead of hitting the api on every keystroke. same /api/discovery endpoint
  // the home page uses, just flattened out of its category grouping
  useEffect(() => {
    const loadTickers = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) return;
        const data = await res.json();
        const flattened: TickerSuggestion[] = Object.entries(data).flatMap(([category, repos]: [string, any]) =>
          (repos as any[]).map((r) => ({ ticker: r.ticker, category }))
        );
        setAllTickers(flattened);
      } catch {
        // no autocomplete data, not a big deal - direct owner/repo search still works
      }
    };
    loadTickers();
  }, []);

  // matches anywhere in the ticker, not just the start - "react" should surface both
  // "facebook/react" and "react/react"
  const suggestions = searchQuery.trim().length > 0
    ? allTickers.filter((t) => t.ticker.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6)
    : [];

  const goToAsset = (tickerStr: string) => {
    const [o, r] = tickerStr.split('/');
    setSearchQuery("");
    setShowSuggestions(false);
    setIsMobileMenuOpen(false);
    router.push(`/asset/${o.toLowerCase()}/${r.toLowerCase()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // if there's a suggestion showing, enter just goes to the first one
    if (suggestions.length > 0) {
      goToAsset(suggestions[0].ticker);
      return;
    }
    // otherwise fall back to treating it as a direct "owner/repo" string
    const repoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (repoRegex.test(searchQuery)) {
      goToAsset(searchQuery);
    }
  };

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    };
    getUser();
  }, [supabase.auth]);

  // close the account dropdown and the search suggestions when clicking anywhere outside
  // them - before this the dropdown just stayed open until you clicked the avatar again
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (pathname === "/login" || authLoading || !user) return null;

  let userInitials = "U";
  let userFullName = "User";

  if (user?.user_metadata) {
    const firstName = user.user_metadata.first_name || "";
    const lastName = user.user_metadata.last_name || "";
    if (firstName && lastName) {
      userInitials = `${firstName[0]}${lastName[0]}`.toUpperCase();
      userFullName = `${firstName} ${lastName}`;
    } else if (user.email) {
      userInitials = user.email[0].toUpperCase();
      userFullName = user.email.split('@')[0];
    }
  }

  // shared between the desktop and mobile layout - the search input plus its suggestions
  // dropdown underneath
  const searchBox = (
    <form ref={searchRef} onSubmit={handleSearch} className="relative flex-1">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Search owner/repo..."
        className="w-full px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.ticker}
              type="button"
              onClick={() => goToAsset(s.ticker)}
              className="w-full text-left px-4 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.ticker}</span>
              <span className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">{s.category}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-sm transition-colors duration-300 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100 hover:text-accent transition-colors">
            <Logo className="h-5 w-5 text-accent" />
            <span className="hidden sm:inline">TRX.EXCHANGE</span>
          </Link>
          <div className="hidden md:block h-5 w-[1px] bg-gray-300 dark:bg-gray-700"></div>
          {/* just a fake "market open" indicator, doesn't actually check anything, it's always on */}
          <div className="hidden md:flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Market Open</span>
          </div>
        </div>

        {/* desktop layout - search + nav links + avatar all inline */}
        <div className="hidden md:flex items-center gap-6 text-sm flex-1 justify-end">
          <div className="flex-1 max-w-md">{searchBox}</div>

          <Link
            href="/portfolio"
            className="font-medium text-gray-600 dark:text-gray-300 hover:text-accent transition-colors"
          >
            Portfolio
          </Link>

          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <div ref={dropdownRef} className="relative border-l border-gray-200 dark:border-gray-800 pl-6">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold tracking-wider shadow-sm">
                {userInitials}
              </div>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {userFullName}
              </span>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-10 mt-2 w-48 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161616] shadow-lg z-50 py-1">
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Account Settings
                </Link>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* mobile layout - just a hamburger toggle, everything else lives in the panel below */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] px-6 py-4 space-y-4">
          {searchBox}
          <div className="flex items-center justify-between">
            <Link
              href="/portfolio"
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-accent transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-accent transition-colors"
            >
              Account Settings
            </Link>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold tracking-wider">
                {userInitials}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userFullName}</span>
            </div>
            <div className="flex items-center gap-2">
              {mounted && (
                <button
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Toggle Theme"
                >
                  {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:text-accent transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
