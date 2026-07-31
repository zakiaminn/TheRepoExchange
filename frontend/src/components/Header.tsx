"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";

// the top nav bar that sticks around on every page except login and the landing page.
// handles the search box, theme toggle, and the user avatar dropdown
export function Header() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false); // need this so we don't render the theme toggle icon before we actually know the theme (avoids a hydration mismatch)
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // search box just takes an "owner/repo" string and routes straight to that asset page.
  // regex check first so we don't push a broken url if someone types garbage
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const repoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    if (repoRegex.test(searchQuery)) {
      router.push(`/asset/${searchQuery}`);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  // hide the header entirely on the login page (it has its own nav), while auth is still
  // loading (avoids a flash of the wrong state), and if nobody's logged in (landing page
  // has its own nav too)
  if (pathname === "/login" || authLoading || !user) return null;

  // build the little avatar initials + display name from whatever we've got on the user.
  // falls back to the email if they never set a first/last name
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

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-sm transition-colors duration-300 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            TRX.EXCHANGE
          </Link>
          <div className="h-5 w-[1px] bg-gray-300 dark:bg-gray-700"></div>
          {/* just a fake "market open" indicator, doesn't actually check anything, it's always on */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Market Open</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search owner/repo..."
            className="w-full px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800/60 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
        </form>

        <div className="flex items-center gap-6 text-sm relative">
          {user && (
            <Link
              href="/portfolio"
              className="font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Portfolio
            </Link>
          )}

          {/* only render the toggle once mounted is true, otherwise ssr and the client
              could disagree on which icon to show and react complains about it */}
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* avatar + dropdown with settings/sign out */}
          {user && (
            <div className="relative border-l border-gray-200 dark:border-gray-800 pl-6">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold tracking-wider shadow-sm">
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
          )}
        </div>
      </div>
    </header>
  );
}
