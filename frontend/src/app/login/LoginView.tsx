"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Wordmark } from "@/components/Logo";
import { SectionRule, Field, Notice } from "@/components/ui";
import { usd, pct, change, toneClass, tickerParts } from "@/lib/format";
import { AUTH, ERROR, NOTICE, HERO, STATE } from "@/lib/copy";

type Spec = { ticker: string; mark: number; delta: number | null };
export type Mode = "signin" | "signup" | "forgot";

// login + signup + password-reset request, all on one page. the left column says what
// you're joining and shows the notice, the right one takes your details.
//
// three modes, driven by isSignUp / isForgot: sign in, open account, and the "email me
// a reset link" step. the new-password form itself is on /auth/reset (you land there
// from the email link). the mode lives in the url (?mode=signup / ?mode=forgot) so
// links can open straight onto the right one
export default function LoginView({ initialMode, error }: { initialMode: Mode; error: string | null }) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [isForgot, setIsForgot] = useState(initialMode === "forgot");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  // /auth/callback sends failed links back here with ?error=, and a dead reset link
  // lands on the forgot form
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    error === "reset" ? { text: AUTH.linkInvalid, type: "error" } : error ? { text: ERROR.auth, type: "error" } : null,
  );

  const router = useRouter();
  const supabase = createClient();

  // a few live listings for the left column, from the public discovery feed (no auth)
  const [spec, setSpec] = useState<Spec[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) return;
        const data = await res.json();
        // the feed can carry the same repo under two different tickers, so this
        // dedupes on both the repo name and the exact mark
        const seenRepo = new Set<string>();
        const seenMark = new Set<string>();
        const rows: Spec[] = (Object.values(data).flat() as any[])
          .filter((r) => Number.isFinite(Number(r.current_price)))
          .filter((r) => {
            const repo = String(r.ticker).split("/").pop()?.toLowerCase() ?? "";
            const mark = Number(r.current_price).toFixed(2);
            if (seenRepo.has(repo) || seenMark.has(mark)) return false;
            seenRepo.add(repo);
            seenMark.add(mark);
            return true;
          })
          .map((r) => ({
            ticker: r.ticker,
            mark: Number(r.current_price),
            delta:
              Array.isArray(r.sparkline) && r.sparkline.length > 1
                ? change(r.sparkline[0], r.sparkline[r.sparkline.length - 1])
                : null,
          }))
          .slice(0, 8);
        if (alive) setSpec(rows);
      } catch {
        // no listings then. the headline and notice still fill the column
      }
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // maps supabase's raw error messages to the plain notices in copy.ts
  const readable = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid password")) return ERROR.credentials;
    if (m.includes("email not confirmed")) return ERROR.unconfirmed;
    if (m.includes("already registered") || m.includes("already been registered")) return ERROR.registered;
    if (m.includes("rate limit") || m.includes("too many requests")) return ERROR.rateLimit;
    // supabase makes you wait about a minute between emails to one address
    if (m.includes("for security purposes") || m.includes("request this after")) return ERROR.rateLimit;
    // the email provider (smtp) refused or failed. not the person's fault
    if (m.includes("error sending")) return ERROR.emailSend;
    if (m.includes("password") && m.includes("characters")) return ERROR.password;
    return ERROR.auth;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // first/last go into user_metadata; the masthead and the account
        // record both read them back from there
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName } },
        });
        if (error) throw error;
        setMessage({ text: AUTH.confirmSent, type: "success" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh(); // re-render anything that read the session on the server
      }
    } catch (error: any) {
      setMessage({ text: readable(error.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // sends the reset email. supabase doesn't say whether the address exists (so nobody
  // can probe for accounts), so success shows the same neutral message either way. the
  // link lands on /auth/callback, which verifies it and forwards to /auth/reset
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      if (error) throw error;
      setMessage({ text: AUTH.resetSent, type: "success" });
    } catch (error: any) {
      // supabase's own wording goes to the console, and the notice gets a rewritten one
      console.error("[reset request]", error?.status, error?.message);
      const text = readable(error.message);
      setMessage({ text: text === ERROR.auth ? ERROR.emailSend : text, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage({ text: readable(error.message), type: "error" });
      setOauthLoading(false);
    }
    // on success the browser is already navigating away to google
  };

  // keeps the address bar in step with the form, so refresh and shared links land on
  // the same mode. replaceState, not a route change, since there's nothing to refetch
  const setMode = (mode: Mode) => {
    setIsSignUp(mode === "signup");
    setIsForgot(mode === "forgot");
    setMessage(null);
    window.history.replaceState(null, "", mode === "signin" ? "/login" : `/login?mode=${mode}`);
  };

  const kicker = isForgot ? AUTH.forgotKicker : isSignUp ? AUTH.applyKicker : AUTH.returnKicker;
  const title = isForgot ? AUTH.forgotTitle : isSignUp ? AUTH.applyTitle : AUTH.returnTitle;
  const body = isForgot ? AUTH.forgotBody : isSignUp ? AUTH.applyBody : AUTH.returnBody;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left column: the pitch, live listings and the notice */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-rule bg-paper-2 p-10 lg:flex xl:p-14">
        <Link href="/" className="relative">
          <Wordmark size="md" />
        </Link>

        <div className="relative w-full max-w-md">
          <h2 className="display text-[clamp(2rem,3.6vw,3rem)] text-ink">
            A market in <span className="swipe">open source.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink-2">{HERO.dek}</p>

          {/* real listings and marks off the public feed */}
          <div className="mt-9">
            <SectionRule
              label="Selected listings"
              className="mb-2"
            />
            {spec.length === 0 ? (
              <div className="py-6">
                <span className="ref">{STATE.quotes}</span>
              </div>
            ) : (
              <table className="board w-full table-fixed">
                <colgroup>
                  <col />
                  <col className="w-[6.5rem]" />
                  <col className="w-[4.75rem]" />
                </colgroup>
                <tbody>
                  {spec.map((s) => {
                    const { repo } = tickerParts(s.ticker);
                    return (
                      <tr key={s.ticker}>
                        <td>
                          <span className="block truncate text-[12px] uppercase text-ink">
                            {repo}
                          </span>
                        </td>
                        <td className="num text-[12px] text-ink">{usd(s.mark)}</td>
                        <td className={`num text-[12px] ${toneClass(s.delta)}`}>
                          {s.delta === null ? "-" : pct(s.delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="relative">
          <Notice label={NOTICE.label} tone="brand">
            {NOTICE.body}
          </Notice>
        </div>
      </aside>

      {/* right column: the form */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 block lg:hidden">
            <Wordmark size="md" />
          </Link>

          <SectionRule label={kicker} className="mb-7" />

          <h1 className="display mb-2 text-3xl text-ink">{title}</h1>
          <p className="mb-8 text-sm leading-relaxed text-ink-2">{body}</p>

          {/* reset-request mode: just an email and a send button */}
          {isForgot ? (
            <>
              <form onSubmit={handleForgot} className="space-y-4">
                <Field label={AUTH.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="field text-[13px]"
                  />
                </Field>
                <button type="submit" disabled={loading} className="ctl ctl-primary w-full">
                  {loading ? AUTH.sending : AUTH.sendReset}
                </button>
              </form>

              <p className="mt-8 text-[13px] text-ink-3">
                <button onClick={() => setMode("signin")} className="link">
                  ← {AUTH.backToSignIn}
                </button>
              </p>
            </>
          ) : (
            <>
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {isSignUp && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={AUTH.firstName}>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        autoComplete="given-name"
                        className="field"
                      />
                    </Field>
                    <Field label={AUTH.lastName}>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        autoComplete="family-name"
                        className="field"
                      />
                    </Field>
                  </div>
                )}

                <Field label={AUTH.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="field text-[13px]"
                  />
                </Field>

                <div>
                  <Field label={AUTH.password} hint={isSignUp ? "six characters minimum" : undefined}>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      className="field text-[13px]"
                    />
                  </Field>
                  {/* only offered on sign-in, since there's nothing to recover mid-signup */}
                  {!isSignUp && (
                    <div className="mt-2 text-right">
                      <button type="button" onClick={() => setMode("forgot")} className="link text-[12px]">
                        {AUTH.forgotLink}
                      </button>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading} className="ctl ctl-primary w-full">
                  {loading ? AUTH.submitting : isSignUp ? AUTH.signUp : AUTH.signIn}
                </button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <span className="rule-line" />
                <span className="label">{AUTH.divider}</span>
                <span className="rule-line" />
              </div>

              <button onClick={handleGoogle} type="button" disabled={oauthLoading} className="ctl w-full">
                {oauthLoading ? (
                  AUTH.connecting
                ) : (
                  <>
                    {/* google's own mark, inlined rather than pulling an icon
                        package in for a single glyph */}
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {AUTH.google}
                  </>
                )}
              </button>

              <p className="mt-8 text-[13px] text-ink-3">
                {isSignUp ? AUTH.toReturn : AUTH.toApply}{" "}
                <button
                  onClick={() => setMode(isSignUp ? "signin" : "signup")}
                  className="link"
                >
                  {isSignUp ? AUTH.signIn : AUTH.signUp}
                </button>
              </p>
            </>
          )}

          {message && (
            <div role="status" className="mt-6">
              <Notice tone={message.type === "success" ? "brand" : "neg"}>{message.text}</Notice>
            </div>
          )}

          <p className="ref mt-10 block leading-relaxed lg:hidden">{NOTICE.body}</p>
        </div>
      </div>
    </div>
  );
}
