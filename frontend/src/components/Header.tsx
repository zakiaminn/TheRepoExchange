"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { usePathname } from "next/navigation";

export function Header() { //header component
  const { resolvedTheme, setTheme } = useTheme(); // theme toggling using next-themes
  const [mounted, setMounted] = useState(false); //only render theme after component is mounted
  const [user, setUser] = useState<any>(null); // user state to determine if user logged in
  const supabase = createClient(); // supabase client for auth and user management
  const pathname = usePathname(); // get current pathname to conditionally render header on login page, we don't want to show the header on the login page

  useEffect(() => { //hydration mismatch fix
    setMounted(true); //set mounted to true
    const getUser = async () => { //get user from supabase auth
      const { data: { user } } = await supabase.auth.getUser(); // set user state to auth user
      setUser(user);
    };
    getUser(); // call getUser on component mount to check if user is logged in and set user state accordingly
  }, [supabase.auth]); //dependency array to only run on mount and when supabase auth changes

  const handleLogout = async () => { // handle user logout, sign out from supabase and redirect to login page
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (pathname === "/login") return null; //dont render header on login page

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            TRX.EXCHANGE
          </Link>
          <div className="h-5 w-[1px] bg-gray-300 dark:bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Market Open</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm">
          {user && (
            <Link 
              href="/portfolio"
              className="font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Portfolio  
            </Link> 
            // only show portfolio link if user logged in
          )}
          
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle Theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {user && (
            <div className="flex items-center gap-4 border-l border-gray-200 dark:border-gray-800 pl-6">
              <span className="text-gray-500 dark:text-gray-400">
                {user.id?.split('-')[0]}
              </span>
              <button 
                onClick={handleLogout} //onclick event for logout
                className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
