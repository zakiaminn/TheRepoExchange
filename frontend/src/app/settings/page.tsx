"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Toast, ToastMessage } from "@/components/Toast";
import { SectionRule, Panel, Field, Skeleton, Notice } from "@/components/ui";
import { ACCOUNT, AUTH, ERROR, NAV, NOTICE } from "@/lib/copy";

/* account settings — really just "change your name". email is shown but locked
   because it's tied to the Supabase auth identity, and changing that is a whole
   separate confirm-email flow we don't do here. styled as amending a record
   rather than a settings form, which is honestly more accurate since there's
   exactly one editable field. */
export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
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
      setCreated(user.created_at || null);
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
    }
  };

  if (initializing) {
    return (
      <div className="flex-1 pb-20">
        <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
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

  // when the account was created, off the auth record, as an ordinary date
  const joined = created
    ? (() => {
        const d = new Date(created);
        return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
      })()
    : "-";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "-";

  return (
    <div className="flex-1 pb-20">
      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-12">
        <Link href="/" className="label inline-block transition-colors hover:text-brand-ink">
          ← {NAV.back}
        </Link>

        <SectionRule
          label={ACCOUNT.kicker}
          className="mb-8 mt-6"
        />

        <h1 className="display mb-2 text-4xl text-ink">{ACCOUNT.title}</h1>
        <p className="prose-measure mb-10 text-sm leading-relaxed text-ink-2">{ACCOUNT.body}</p>

        {/* what's on the account on the left, the one editable thing on the right */}
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2 lg:items-start">
          {/* ── details ── */}
          <section>
            <SectionRule label={ACCOUNT.details} className="mb-4" />
            <dl className="border-t border-rule-2">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                <dt className="label">{ACCOUNT.name}</dt>
                <dd className="text-[13px] text-ink">{fullName}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                <dt className="label">{ACCOUNT.joined}</dt>
                <dd className="figure text-[13px] text-ink">{joined}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3">
                <dt className="label">{ACCOUNT.email}</dt>
                <dd className="max-w-[60%] truncate text-[13px] text-ink" title={email}>{email}</dd>
              </div>
            </dl>
          </section>

          {/* ── edit ── */}
          <section>
            <SectionRule label={ACCOUNT.editName} className="mb-4" />
            <Panel className="p-6 sm:p-7">
              <form onSubmit={save} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                <div className="border-t border-rule pt-5">
                  <button type="submit" disabled={saving} className="ctl ctl-primary w-full">
                    {saving ? ACCOUNT.saving : ACCOUNT.save}
                  </button>
                </div>
              </form>
            </Panel>
          </section>
        </div>

        <Notice label={NOTICE.label} className="mt-12">
          {NOTICE.body}
        </Notice>
      </main>

      <Toast message={message} />
    </div>
  );
}
