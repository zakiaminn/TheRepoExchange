"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Toast, ToastMessage } from "@/components/Toast";
import { SectionRule, DocRef, Panel, Field, Skeleton, Notice } from "@/components/ui";
import { ACCOUNT, ERROR, NAV, NOTICE } from "@/lib/copy";

/* account settings — really just "change your name". email is shown but locked
   because it's tied to the Supabase auth identity, and changing that is a whole
   separate confirm-email flow we don't do here. styled as amending a record
   rather than a settings form, which is honestly more accurate since there's
   exactly one editable field. */
export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [message, setMessage] = useState<ToastMessage>(null);

  const supabase = createClient();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setEmail(user.email || "");
      setFirstName(user.user_metadata?.first_name || "");
      setLastName(user.user_metadata?.last_name || "");
      setInitializing(false);
    };
    check();
  }, [supabase.auth]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { first_name: firstName, last_name: lastName },
      });
      setMessage(
        error
          ? { text: ERROR.unexpected, type: "error" }
          : { text: ACCOUNT.saved, type: "success" }
      );
    } catch {
      setMessage({ text: ERROR.unexpected, type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (initializing) {
    return (
      <div className="flex-1 pb-20">
        <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-12">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-6 h-9 w-56" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
          <div className="panel mt-9 space-y-5 p-6 sm:p-8">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-20">
      <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-12">
        <Link href="/" className="label inline-block transition-colors hover:text-brand-ink">
          ← {NAV.back}
        </Link>

        <SectionRule
          label={ACCOUNT.kicker}
          meta={<DocRef code="TRX-MBR-0001" />}
          className="mb-8 mt-6"
        />

        <h1 className="display mb-2 text-4xl text-ink">{ACCOUNT.title}</h1>
        <p className="prose-measure mb-9 text-sm leading-relaxed text-ink-2">{ACCOUNT.body}</p>

        <Panel registered className="p-6 sm:p-8">
          <form onSubmit={save} className="space-y-5">
            <Field label="Email address" hint={ACCOUNT.emailLocked}>
              <input type="email" value={email} disabled className="field font-mono text-[13px]" />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  className="field"
                />
              </Field>
              <Field label="Last name">
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

            <div className="border-t border-rule pt-5">
              <button type="submit" disabled={saving} className="ctl ctl-primary w-full sm:w-auto">
                {saving ? ACCOUNT.saving : ACCOUNT.save}
              </button>
            </div>
          </form>
        </Panel>

        <Notice label={NOTICE.label} className="mt-10">
          {NOTICE.body}
        </Notice>
      </main>

      <Toast message={message} />
    </div>
  );
}
