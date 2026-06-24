"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type SystemMessage = {
  text: string;
  type: "success" | "error";
} | null;

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [message, setMessage] = useState<SystemMessage>(null);

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) { // not logged in, bounce them
        window.location.href = "/login";
      } else {
        // pre-fill the form with what we already know about them
        setEmail(user.email || "");
        setFirstName(user.user_metadata?.first_name || "");
        setLastName(user.user_metadata?.last_name || "");
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, [supabase.auth]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      });

      if (error) {
        setMessage({ text: error.message, type: "error" });
      } else {
        setMessage({ text: "Profile updated successfully.", type: "success" });
      }
    } catch (err) {
      setMessage({ text: "An unexpected error occurred.", type: "error" });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 4000); // clear the message after a bit so it doesn't just sit there
    }
  };

  if (isInitializing) { // show a loading state so the page doesn't flash
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        SECURING CONNECTION...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans relative selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10">
        <main className="max-w-xl mx-auto px-6 py-12">
          <div className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tighter mb-1">Account Settings</h1>
            </div>
            
            <div className="text-right">
              <Link href="/" className="text-[10px] uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                Back to Terminal
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-800 p-8 shadow-md">
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-2">
                  Email Address
                </label>
                <input 
                  type="email" 
                  value={email}
                  disabled // can't change email, it's tied to their auth
                  className="w-full h-10 px-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm focus:outline-none cursor-not-allowed transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-2">
                    First Name
                  </label>
                  <input 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 focus:ring-1 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 transition-all"
                    placeholder="First Name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-2">
                    Last Name
                  </label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full h-10 px-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 focus:ring-1 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 transition-all"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full h-10 mt-4 text-xs font-bold tracking-wide uppercase transition-all duration-150 flex items-center justify-center ${
                  isLoading 
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 active:scale-[0.98]'
                }`}
              >
                {isLoading ? 'Saving...' : 'Update Profile'}
              </button>
            </form>
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