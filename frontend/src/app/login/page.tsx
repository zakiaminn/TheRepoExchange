"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{text: string; type: "error" | "success"} | null>(null);

  // supabase intializaiton
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage({ text: error.message, type: "error" });
      } else {
        setMessage({ text: "Authentication successful. Redirecting...", type: "success" });
        // redirection after successful login
        window.location.href = "/"; 
      }
    } catch (err) {
      setMessage({ text: "An unexpected error occurred.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`, // Standard OAuth callback route
        },
      });

      if (error) setMessage({ text: error.message, type: "error" });
    } catch (err) {
      setMessage({ text: `Could not connect to ${provider}.`, type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] flex items-center justify-center font-sans selection:bg-gray-900 selection:text-white dark:selection:bg-white dark:selection:text-gray-900 relative transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tighter text-gray-900 dark:text-gray-100 mb-2">TRX.EXCHANGE</h1>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Sign in to your account
          </p>
        </div>

        <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
          
          <div className="space-y-3 mb-8">
            <button 
              onClick={() => handleOAuthLogin('google')}
              className="w-full h-10 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium tracking-tight text-gray-900 dark:text-gray-100 flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            
            <button 
              onClick={() => handleOAuthLogin('apple')}
              className="w-full h-10 border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium tracking-tight text-gray-900 dark:text-gray-100 flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.641-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z"/>
              </svg>
              Continue with Apple
            </button>
          </div>

          <div className="flex items-center mb-8">
            <div className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-800"></div>
            <span className="px-3 text-[10px] font-mono uppercase tracking-widest text-gray-400 dark:text-gray-500">Or</span>
            <div className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-800"></div>
          </div>

          
          {message && (
            <div className={`mb-6 px-3 py-2 text-xs font-mono border flex items-center gap-2 ${
              message.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/50'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}></div>
              {message.text}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 mb-2">
                Email/Username
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-10 px-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-100 transition-all"
                placeholder="user@trx.com"
              />
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400">
                  Password
                </label>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 px-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-100 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className={`w-full h-10 mt-2 text-xs font-bold tracking-wide uppercase transition-all duration-150 flex items-center justify-center ${
                isLoading 
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 active:scale-[0.98]'
              }`}
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}