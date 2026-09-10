"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { SectionRule, DocRef, Panel, Field, Notice, Empty, Skeleton } from "@/components/ui";
import { Toast, ToastMessage } from "@/components/Toast";
import { usd, count, countCompact, signedUsd, toneClass, tickerParts } from "@/lib/format";
import { SECTIONS, LABELS, ERROR, CALLS } from "@/lib/copy";

type CallStatus = "open" | "won" | "lost" | "void";

type Call = {
  id: string;
  ticker: string;
  direction: "above" | "below";
  target_stars: number | string;
  stake: number | string;
  deadline: string;
  status: CallStatus;
  opening_stars: number | string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_stars: number | string | null;
  payout: number | string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL;
const TICKER_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

// countdown from a fixed deadline against the page clock (nowMs is state, never
// Date.now() in render). deadlines are day-plus out, so day/hour/minute is enough.
function countdown(deadlineMs: number, nowMs: number): string {
  const left = deadlineMs - nowMs;
  if (left <= 0) return "due";
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

// deterministic given its input, so it's safe to call in render (unlike new Date()).
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_TONE: Record<CallStatus, string> = {
  open: "text-ink-2",
  won: "text-pos",
  lost: "text-neg",
  void: "text-ink-3",
};

/* Repo calls. A prediction that a repository reaches a star target by a date,
   staked from the same simulated wallet and settled even-money against the
   public star count. Open a call up top; your book of calls sits below, open
   ones first with a live countdown. */
export default function CallsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [repo, setRepo] = useState("");
  const [currentStars, setCurrentStars] = useState<number | null>(null);
  const [checkingRepo, setCheckingRepo] = useState(false);
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [minDeadline, setMinDeadline] = useState("");
  const [stake, setStake] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<ToastMessage>(null);

  const [nowMs, setNowMs] = useState(0);

  const supabase = createClient();

  // page clock for the countdowns — set off the render path so Date.now() is
  // never called during render
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    const t = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => { window.clearInterval(id); window.clearTimeout(t); };
  }, []);

  // default the deadline 30 days out, floor it at tomorrow — computed off the
  // render path for the same reason
  useEffect(() => {
    const t = window.setTimeout(() => {
      const plus = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      };
      setDeadline(plus(30));
      setMinDeadline(plus(1));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id);
    };
    check();
  }, [supabase]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const opts = { headers: { Authorization: `Bearer ${session.access_token}` } };
    const [balanceRes, callsRes] = await Promise.all([
      fetch(`${API}/api/balance/${userId}`, opts),
      fetch(`${API}/api/calls`, opts),
    ]);
    if (balanceRes.ok) setBalance(Number((await balanceRes.json()).balance));
    if (callsRes.ok) setCalls((await callsRes.json()).calls || []);
  };

  useEffect(() => {
    if (!userId) return;
    const run = async () => {
      try { await loadData(); }
      catch { console.error(ERROR.ledger); }
      finally { setLoading(false); }
    };
    run();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // resolve the repo's live star count as the user types, so the target is set
  // against a real number and validated before anything is staked. all state
  // updates happen inside the debounced callback, never synchronously in the
  // effect body.
  useEffect(() => {
    const t = repo.trim();
    const id = window.setTimeout(async () => {
      if (!TICKER_RE.test(t)) { setCurrentStars(null); setCheckingRepo(false); return; }
      setCheckingRepo(true);
      try {
        const [owner, name] = t.split("/");
        const res = await fetch(`${API}/api/history/${owner}/${name}`);
        if (!res.ok) { setCurrentStars(null); return; }
        const data = await res.json();
        const stars = data?.asset?.raw_stars;
        setCurrentStars(stars != null ? Number(stars) : null);
      } catch {
        setCurrentStars(null);
      } finally {
        setCheckingRepo(false);
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [repo]);

  const targetNum = Number(target);
  const stakeNum = Number(stake);
  const targetValid = Number.isInteger(targetNum) && targetNum > 0 && currentStars !== null && targetNum > currentStars;
  const stakeValid = Number.isFinite(stakeNum) && stakeNum >= 1 && (balance === null || stakeNum <= balance);
  const canSubmit = TICKER_RE.test(repo.trim()) && currentStars !== null && targetValid && stakeValid && !!deadline && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const res = await fetch(`${API}/api/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ticker: repo.trim(),
          targetStars: targetNum,
          stake: stakeNum,
          deadline: new Date(`${deadline}T23:59:59`).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || ERROR.ledger, type: "error" });
        return;
      }
      setMessage({ text: `Call opened on ${repo.trim()} at ${count(stakeNum)}.`, type: "success" });
      setRepo(""); setTarget(""); setStake(""); setCurrentStars(null);
      await loadData();
    } catch {
      setMessage({ text: ERROR.ledger, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 pb-20">
        <main className="mx-auto w-full max-w-[64rem] px-5 py-10 sm:px-8 sm:py-12">
          <Skeleton className="h-3 w-24" />
          <div className="mt-8"><Skeleton className="h-14 w-80 max-w-full" /></div>
          <div className="mt-10"><Skeleton className="h-40 w-full" /></div>
        </main>
      </div>
    );
  }

  const open = calls.filter((c) => c.status === "open");
  const settled = calls.filter((c) => c.status !== "open");

  return (
    <div className="flex-1 pb-20">
      <Toast message={message} />
      <main className="mx-auto w-full max-w-[64rem] px-5 py-10 sm:px-8 sm:py-12">
        <SectionRule label={SECTIONS.calls} meta={<DocRef code="TRX-CALL-001" />} className="mb-8" />

        <div className="border-b border-rule-2 pb-8">
          <h1 className="display text-[clamp(2rem,6vw,3.25rem)] leading-none text-ink">{CALLS.title}</h1>
          <p className="prose-measure mt-4 text-sm leading-relaxed text-ink-2">{CALLS.intro}</p>
        </div>

        <div className="mt-10 grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_1.1fr]">
          {/* ── open a call ─────────────────────────────────────────────── */}
          <section>
            <SectionRule
              label={SECTIONS.newCall}
              meta={balance !== null ? `${LABELS.purchasingPower} ${usd(balance)}` : undefined}
              className="mb-5"
            />
            <Panel className="p-4 sm:p-6">
              <form onSubmit={submit} className="grid gap-5">
                <Field
                  label={CALLS.repo}
                  hint={
                    checkingRepo ? "checking" :
                    currentStars !== null ? `${CALLS.now} ${count(currentStars)} stars` :
                    CALLS.repoHint
                  }
                >
                  <input
                    className="field"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    placeholder="oven-sh/bun"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  label={CALLS.target}
                  hint={currentStars !== null && targetNum > 0 && !targetValid ? CALLS.targetBelowCurrent : "whole number"}
                >
                  <input
                    className="field field-figure"
                    type="number"
                    inputMode="numeric"
                    min={currentStars !== null ? currentStars + 1 : 1}
                    step={1}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={currentStars !== null ? String(currentStars + 1000) : "80000"}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label={CALLS.deadline}>
                    <input
                      className="field"
                      type="date"
                      min={minDeadline || undefined}
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </Field>
                  <Field label={CALLS.stake} hint={balance !== null && stakeNum > balance ? CALLS.overStake : "USD"}>
                    <input
                      className="field field-figure"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step="0.01"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      placeholder="250"
                    />
                  </Field>
                </div>

                {/* the wager, spelled out: even-money, so a win returns twice the stake */}
                {stakeValid && targetValid && (
                  <p className="ref leading-relaxed">
                    Stake {usd(stakeNum)} that {repo.trim()} reaches {count(targetNum)} stars by {deadline ? fmtDate(`${deadline}T00:00:00`) : "-"}.
                    A correct call returns {usd(stakeNum * 2)}.
                  </p>
                )}

                <button type="submit" className="ctl ctl-primary" disabled={!canSubmit}>
                  {submitting ? CALLS.opening : CALLS.open}
                </button>
              </form>
            </Panel>

            <Notice label={CALLS.noticeLabel} className="mt-6">{CALLS.noticeBody}</Notice>
          </section>

          {/* ── the book of calls ──────────────────────────────────────── */}
          <section>
            <SectionRule
              label={SECTIONS.calls}
              meta={`${count(calls.length)} of record`}
              className="mb-5"
            />
            <Panel>
              {calls.length === 0 ? (
                <Empty>{CALLS.empty}</Empty>
              ) : (
                <div>
                  {[...open, ...settled].map((c, i) => {
                    const { owner, repo: name } = tickerParts(c.ticker);
                    const targetStars = Number(c.target_stars);
                    const stakeAmt = Number(c.stake);
                    const deadlineMs = Date.parse(c.deadline);
                    const payout = c.payout != null ? Number(c.payout) : null;
                    const net = payout != null ? payout - stakeAmt : null;
                    const resolvedStars = c.resolved_stars != null ? Number(c.resolved_stars) : null;

                    return (
                      <div key={c.id} className={`flex items-baseline justify-between gap-4 px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-rule" : ""}`}>
                        <div className="min-w-0">
                          <Link href={`/asset/${owner.toLowerCase()}/${name.toLowerCase()}`} className="group block min-w-0">
                            <span className="block truncate text-[13px] font-medium uppercase text-ink transition-colors group-hover:text-brand-ink">{name}</span>
                            <span className="block truncate text-[11px] text-ink-3">{owner}</span>
                          </Link>
                          <p className="ref mt-1.5">
                            → {count(targetStars)} stars by {fmtDate(c.deadline)} · stake {usd(stakeAmt)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className={`label ${STATUS_TONE[c.status]}`}>
                            {c.status === "open"
                              ? (nowMs > 0 ? `${CALLS.resolvesIn} ${countdown(deadlineMs, nowMs)}` : CALLS.status.open)
                              : CALLS.status[c.status]}
                          </div>
                          {c.status === "open" ? (
                            <div className="ref mt-1">{fmtDate(c.deadline)}</div>
                          ) : c.status === "void" ? (
                            <div className="ref mt-1">refunded {usd(stakeAmt)}</div>
                          ) : (
                            <div className="mt-1">
                              <span className="figure text-[12px] text-ink-2">
                                {CALLS.reached} {resolvedStars != null ? countCompact(resolvedStars) : "-"}
                              </span>
                              {net != null && (
                                <span className={`figure ml-2 text-[13px] ${toneClass(net)}`}>{signedUsd(net)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
}
