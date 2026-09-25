// response shapes from the ledger. the api hands back numbers as strings in some columns
// and numbers in others (postgres numerics via node-postgres), so any field that can be
// either is typed as both and coerced where it's used

export type ListingRow = {
  ticker: string;
  current_price: number | string;
  description?: string;
  raw_stars?: number | string;
  sparkline?: number[];
};

// /api/discovery: listings grouped by category
export type DiscoveryResponse = Record<string, ListingRow[]>;

export type HoldingRow = {
  ticker: string;
  shares: number;
  average_price: number | string;
  current_price?: number | string;
};

// /api/portfolio/:id
export type PortfolioResponse = { portfolio?: HoldingRow[] };

// /api/history/:owner/:repo: the last price of each day under the current formula
export type HistoryPoint = { time: string; value: number };
export type HistoryResponse = { ticker?: string; pricingVersion?: string; history?: HistoryPoint[] };
