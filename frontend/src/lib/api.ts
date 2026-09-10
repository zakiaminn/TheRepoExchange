// ── LEDGER / ENGINE RESPONSE SHAPES ───────────────────────────────────────
// The API hands back numbers as strings in some columns and numbers in
// others (Postgres numerics via node-postgres), so every field that can be
// either is typed as both and coerced at the point of use rather than
// trusted. These types exist so the fetch sites stop reaching for `any`.

export type ListingRow = {
  ticker: string;
  current_price: number | string;
  description?: string;
  raw_stars?: number | string;
  sparkline?: number[];
};

/** /api/discovery — listings grouped by category. */
export type DiscoveryResponse = Record<string, ListingRow[]>;

export type HoldingRow = {
  ticker: string;
  shares: number;
  average_price: number | string;
  current_price?: number | string;
};

/** /api/portfolio/:id */
export type PortfolioResponse = { portfolio?: HoldingRow[] };

/** /api/history/:owner/:repo — one point per observation. */
export type HistoryPoint = { time: string; value: number };
export type HistoryResponse = { history?: HistoryPoint[] };
