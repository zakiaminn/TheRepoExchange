"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });
        if (error) throw error;
        setMessage({ text: "Check your email to confirm your account.", type: "success" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (error: any) {
      setMessage({ text: error.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ text: error.message, type: "error" });
      setOauthLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 font-sans selection:bg-gray-900 selection:text-white transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-sm p-8 bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tighter mb-1">TRX.EXCHANGE</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            {isSignUp ? "Create an Account" : "The Repo Exchange"}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 text-sm bg-transparent border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 transition-colors"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 text-sm bg-transparent border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 transition-colors"
              />
            </div>
          )}
          <input
            type="email"
            placeholder="user@trx.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-transparent border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-transparent border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-900 dark:focus:border-gray-100 transition-colors"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-bold tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-[0.1em]">
            <span className="px-2 bg-white dark:bg-[#121212] text-gray-500">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          disabled={oauthLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs font-bold tracking-widest uppercase disabled:opacity-50"
        >
          {oauthLoading ? (
            "Connecting..."
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </>
          )}
        </button>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.1em] text-gray-500">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="font-bold text-gray-900 dark:text-gray-100 hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>

        {message && (
          <div className={`mt-4 p-3 text-[10px] uppercase tracking-wider text-center border ${
            message.type === 'success' 
              ? 'border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10' 
              : 'border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
