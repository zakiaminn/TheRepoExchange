"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Logo } from "@/components/Logo";

// handles both sign in and sign up on the same page, toggled with isSignUp. also has the
// google oauth button
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

  // supabase's raw error messages are kind of ugly/technical, so this maps the common
  // ones to something a normal person would actually understand
  const sanitizeAuthError = (errorMessage: string): string => {
    const msg = errorMessage.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
      return 'Invalid email or password.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Please confirm your email address before signing in.';
    }
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return 'An account with this email already exists. Try signing in.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Too many attempts. Please try again later.';
    }
    if (msg.includes('password') && msg.includes('characters')) {
      return 'Password must be at least 6 characters.';
    }
    // fallback for anything we didn't specifically account for above
    return 'Authentication failed. Please try again.';
  };

  // this one function handles both sign up and sign in, just branches on isSignUp
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // stash first/last name in supabase's user_metadata, this is what the settings
        // page and header avatar read from later
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
        router.refresh(); // makes sure the header/page picks up the new session right away
      }
    } catch (error: any) {
      setMessage({ text: sanitizeAuthError(error.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // kicks off the google oauth flow, redirects to google then back to our /auth/callback
  // route which is what actually finishes logging them in
  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ text: sanitizeAuthError(error.message), type: "error" });
      setOauthLoading(false);
    }
    // no need to reset oauthLoading on success since the browser is about to navigate
    // away to google anyway
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-page text-ink font-sans selection:bg-accent selection:text-accent-foreground transition-colors duration-300">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-sm p-8 bg-card border-2 border-edge shadow-brutal">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Logo className="h-5 w-5 text-accent" />
            <h1 className="font-display text-2xl font-bold tracking-tighter">TRX.EXCHANGE</h1>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            {isSignUp ? "Create an Account" : "The Repo Exchange"}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          {/* only show the name fields when signing up, sign in just needs email + password */}
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 text-sm bg-card border-2 border-edge focus:outline-none focus:shadow-brutal-sm transition-shadow"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 text-sm bg-card border-2 border-edge focus:outline-none focus:shadow-brutal-sm transition-shadow"
              />
            </div>
          )}
          <input
            type="email"
            placeholder="user@trx.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-card border-2 border-edge focus:outline-none focus:shadow-brutal-sm transition-shadow"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-card border-2 border-edge focus:outline-none focus:shadow-brutal-sm transition-shadow"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 border-2 border-edge bg-accent text-accent-foreground text-xs font-bold tracking-widest uppercase press-brutal shadow-brutal-sm transition-all disabled:opacity-50"
          >
            {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-edge"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-[0.1em]">
            <span className="px-2 bg-card text-ink-muted">Or continue with</span>
          </div>
        </div>

        {/* google's official svg logo, just inlined instead of pulling in an icon library for one icon */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          disabled={oauthLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2 border-2 border-edge hover:bg-card-alt press-brutal shadow-brutal-sm transition-colors text-xs font-bold tracking-widest uppercase disabled:opacity-50"
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

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="font-bold text-accent hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>

        {message && (
          <div className={`mt-4 p-3 text-[10px] uppercase tracking-wider text-center border-2 ${
            message.type === 'success'
              ? 'border-bull/40 text-bull bg-bull/10'
              : 'border-bear/40 text-bear bg-bear/10'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
