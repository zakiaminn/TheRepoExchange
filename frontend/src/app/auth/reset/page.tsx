"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Wordmark } from "@/components/Logo";
import { SectionRule, DocRef, Field, Pending, Notice } from "@/components/ui";
import { AUTH, ERROR } from "@/lib/copy";

/* the "set a new password" step. you land here from the reset email link:
   Supabase -> /auth/callback (exchanges the code, sets a recovery session) ->
   here. so by the time this renders we should already have a session, and
   updateUser({ password }) just works. if there's no session, the link was
   bad or expired and we say so instead of showing a dead form. */
export default function ResetPage() {
  const [ready, setReady] = useState<boolean | null>(null); // null = still checking
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ text: AUTH.mismatch, type: "error" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ text: AUTH.passwordUpdated, type: "success" });
      // the recovery session is now a full session — send them in
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1300);
    } catch (err: any) {
      const raw = (err?.message || "").toLowerCase();
      setMessage({
        text: raw.includes("password") && raw.includes("characters") ? ERROR.password : ERROR.unexpected,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/" className="mb-10 block">
          <Wordmark size="md" />
        </Link>

        <SectionRule label={AUTH.resetKicker} meta={<DocRef code="TRX-ADM-0002" />} className="mb-7" />

        <h1 className="display mb-2 text-3xl text-ink">{AUTH.resetTitle}</h1>
        <p className="mb-8 text-sm leading-relaxed text-ink-2">{AUTH.resetBody}</p>

        {ready === null ? (
          <Pending>{AUTH.verifyingLink}</Pending>
        ) : ready === false ? (
          <Notice label="Link expired" tone="neg">
            {AUTH.linkInvalid}{" "}
            <Link href="/login" className="link">
              Request a new one
            </Link>
            .
          </Notice>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={AUTH.newPassword} hint="six characters minimum">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="field font-mono text-[13px]"
              />
            </Field>
            <Field label={AUTH.confirmPassword}>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="field font-mono text-[13px]"
              />
            </Field>
            <button type="submit" disabled={loading} className="ctl ctl-primary w-full">
              {loading ? AUTH.updating : AUTH.updatePassword}
            </button>
          </form>
        )}

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
      </div>
    </div>
  );
}
