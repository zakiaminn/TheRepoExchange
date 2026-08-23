"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Wordmark } from "@/components/Logo";
import { SectionRule, DocRef, Field, Notice } from "@/components/ui";
import { AUTH, ERROR, NOTICE, MECHANICS, BRAND, HERO } from "@/lib/copy";

/* login + signup on one page, toggled between the two.

   two columns instead of a centred card: the left says what you're joining and
   on what terms, the right takes your details. the point of the split is that
   the notice (the fine print a real exchange makes you see before you sign) is
   right there while you sign up, not buried in a footer. */
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

  // Supabase's raw errors are written for developers. These are written for
  // the person reading them, in the same register as everything else — a
  // notice, not an apology.
  const readable = (raw: string): string => {
    const m = raw.toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid password")) return ERROR.credentials;
    if (m.includes("email not confirmed")) return ERROR.unconfirmed;
    if (m.includes("already registered") || m.includes("already been registered")) return ERROR.registered;
    if (m.includes("rate limit") || m.includes("too many requests")) return ERROR.rateLimit;
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
        router.refresh(); // so the masthead picks up the session immediately
      }
    } catch (error: any) {
      setMessage({ text: readable(error.message), type: "error" });
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
    // on success the browser is already navigating away to Google
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── the terms ────────────────────────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-rule bg-paper-2 p-10 lg:flex xl:p-14">

        <Link href="/" className="relative">
          <Wordmark size="md" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="display text-[clamp(2rem,3.6vw,3rem)] text-ink">
            A market in <span className="swipe">open source.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink-2">{HERO.dek}</p>

          <dl className="mt-9 border-t border-rule-2">
            {MECHANICS.slice(0, 4).map((m) => (
              <div key={m.term} className="flex gap-5 border-b border-rule py-3">
                <dt className="label w-32 shrink-0 pt-0.5">{m.term}</dt>
                <dd className="text-[13px] leading-relaxed text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <Notice label={NOTICE.label} tone="brand">
            {NOTICE.body}
          </Notice>
          <DocRef code="TRX-ADM-0001" className="mt-5 block" />
        </div>
      </aside>

      {/* ── the application ──────────────────────────────────────────── */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 block lg:hidden">
            <Wordmark size="md" />
          </Link>

          <SectionRule
            label={isSignUp ? AUTH.applyKicker : AUTH.returnKicker}
            className="mb-7"
          />

          <h1 className="display mb-2 text-3xl text-ink">
            {isSignUp ? AUTH.applyTitle : AUTH.returnTitle}
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-ink-2">
            {isSignUp ? AUTH.applyBody : AUTH.returnBody}
          </p>

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
                className="field font-mono text-[13px]"
              />
            </Field>

            <Field label={AUTH.password} hint={isSignUp ? "six characters minimum" : undefined}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="field font-mono text-[13px]"
              />
            </Field>

            <button type="submit" disabled={loading} className="ctl ctl-primary w-full">
              {loading ? AUTH.submitting : isSignUp ? AUTH.signUp : AUTH.signIn}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <span className="rule-line" />
            <span className="label">{AUTH.divider}</span>
            <span className="rule-line" />
          </div>

          <button
            onClick={handleGoogle}
            type="button"
            disabled={oauthLoading}
            className="ctl w-full"
          >
            {oauthLoading ? (
              AUTH.connecting
            ) : (
              <>
                {/* Google's own mark, inlined rather than pulling an icon
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

          {message && (
            <div
              className={`mt-6 border-l-2 pl-4 text-[13px] leading-relaxed ${
                message.type === "success" ? "border-l-pos text-ink-2" : "border-l-neg text-neg"
              }`}
              role="status"
            >
              {message.text}
            </div>
          )}

          <p className="mt-8 text-[13px] text-ink-3">
            {isSignUp ? AUTH.toReturn : AUTH.toApply}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="link"
            >
              {isSignUp ? AUTH.signIn : AUTH.signUp}
            </button>
          </p>

          <p className="ref mt-10 block leading-relaxed lg:hidden">{BRAND.est} · {NOTICE.body}</p>
        </div>
      </div>
    </div>
  );
}
