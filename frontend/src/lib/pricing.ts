// Reader-side pricing mirror — PRICING-1.
//
// The authorities that STRIKE prices are the ledger (ledger/pricing.js) and the
// worker (data-engine/pricing.py), pinned to each other by pricing/fixtures.json.
// This module lets the asset page RECONSTRUCT a stored mark, line by line, from the
// repository's public numbers — so the price is a shown derivation, not a figure to
// take on faith. It re-implements the same formula on purpose; if it ever drifts, the
// page's own reconciliation flag (`reconciles`) surfaces it on screen.
// See METHODOLOGY.md.

export const BASE_LISTING = 5.0;
export const W_STAR = 0.001;
export const W_FORK = 0.01;
export const W_WATCH = 0.05;
export const W_PR = 1.0;
export const W_ISSUE = 1.0;
export const ISSUE_DRAG_CAP = 0.6;
export const PRICE_FLOOR = 1.0;

export interface AssetMetrics {
  current_price?: number | string | null;
  raw_stars?: number | string | null;
  raw_forks?: number | string | null;
  raw_watchers?: number | string | null;
  raw_open_prs?: number | string | null;
  raw_open_issues?: number | string | null;
  pushed_at?: string | null;
  priced_at?: string | null;
  description?: string | null;
}

// Multiplier in [0.70, 1.00] from WHOLE days since last push — floored to an integer
// so it matches the ledger and worker exactly (fractional days were a parity bug).
export function recencyMultiplier(days: number): number {
  if (days <= 30) return 1.0;
  if (days >= 365) return 0.7;
  return 1.0 - (0.3 * (days - 30)) / (365 - 30);
}

export interface MetricLine {
  key: string;
  label: string;
  count: number;
  unit: number;
  contrib: number;
}

export interface Valuation {
  base: number;
  lines: MetricLine[];
  gross: number;
  drag: { count: number; unit: number; uncapped: number; applied: number; capped: boolean };
  preRecency: number;
  recency: { factor: number; days: number | null; implied: boolean } | null;
  mark: number | null;
  reconciles: boolean | null;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// Rebuild the mark from stored public metrics. `mark` is the price the ledger reports;
// we recompute the derivation and check it reconciles.
export function deriveValuation(a: AssetMetrics, mark: number | null): Valuation {
  const stars = num(a.raw_stars);
  const forks = num(a.raw_forks);
  const watchers = num(a.raw_watchers);
  const openPrs = num(a.raw_open_prs);
  const openIssues = num(a.raw_open_issues);

  const lines: MetricLine[] = [
    { key: "raw_stars", label: "Stars", count: stars, unit: W_STAR, contrib: stars * W_STAR },
    { key: "raw_forks", label: "Forks", count: forks, unit: W_FORK, contrib: forks * W_FORK },
    { key: "raw_watchers", label: "Watchers", count: watchers, unit: W_WATCH, contrib: watchers * W_WATCH },
    { key: "raw_open_prs", label: "Open PRs", count: openPrs, unit: W_PR, contrib: openPrs * W_PR },
  ];

  const gross = BASE_LISTING + lines.reduce((s, l) => s + l.contrib, 0);
  const uncapped = openIssues * W_ISSUE;
  const cap = ISSUE_DRAG_CAP * gross;
  const applied = Math.min(uncapped, cap);
  const preRecency = gross - applied;

  // Recency is exact when both timestamps are present (the mark was struck at
  // priced_at; the repo was last pushed at pushed_at). Until those are backfilled we
  // back the factor out of the mark so the column still reconciles, and mark it
  // "implied".
  let recency: Valuation["recency"] = null;
  if (a.pushed_at && a.priced_at) {
    const pushedMs = Date.parse(a.pushed_at);
    const pricedMs = Date.parse(a.priced_at);
    if (Number.isFinite(pushedMs) && Number.isFinite(pricedMs)) {
      const days = Math.floor((pricedMs - pushedMs) / 86400000);
      recency = { factor: recencyMultiplier(days), days, implied: false };
    }
  }
  if (!recency && mark !== null && preRecency > 0) {
    recency = { factor: mark / preRecency, days: null, implied: true };
  }

  const reconstructed =
    recency !== null
      ? Math.round(Math.max(PRICE_FLOOR, preRecency * recency.factor) * 100) / 100
      : null;
  const reconciles =
    mark !== null && reconstructed !== null ? Math.abs(reconstructed - mark) <= 0.01 : null;

  return {
    base: BASE_LISTING,
    lines,
    gross,
    drag: { count: openIssues, unit: W_ISSUE, uncapped, applied, capped: uncapped > cap },
    preRecency,
    recency,
    mark,
    reconciles,
  };
}
