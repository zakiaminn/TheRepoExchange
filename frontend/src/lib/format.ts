// every number in the app goes through here. if it didn't, the tenth table
// would invent its own way to show a dollar sign and we'd all suffer.
//
// one thing that looks like a typo but isn't: negatives use a real minus (−,
// U+2212), not a hyphen. the hyphen is short and sits high; the real minus is
// the same width/height as the plus, so a column of +/- numbers actually lines
// up. cheapest possible way to make numbers look designed instead of printf'd.

export const MINUS = "−";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $1,271.50 — negatives rendered with a true minus, sign leading the symbol. */
export function usd(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${MINUS}${MINUS}`;
  const s = usdFmt.format(Math.abs(n));
  return n < 0 ? `${MINUS}${s}` : s;
}

/** $1.27M — for figures that would otherwise blow out a column. */
export function usdCompact(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${MINUS}${MINUS}`;
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${usdFmt.format(abs)}`;
}

/** 12,431 — plain integers with separators. */
export function count(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${MINUS}`;
  return new Intl.NumberFormat("en-US").format(n);
}

/** "1 listing" / "12 listings" — a count with a noun that agrees with it. */
export function plural(value: number, singular: string, pluralForm?: string): string {
  const n = Number(value);
  const word = n === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${count(n)} ${word}`;
}

/** 12.4K — compact counts, for star totals and volumes. */
export function countCompact(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${MINUS}`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** +3.20% / −0.40% — always signed, always two places, always a true minus. */
export function pct(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${MINUS}${MINUS}`;
  const sign = n > 0.005 ? "+" : n < -0.005 ? MINUS : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

/** +$412.90 / −$88.10 — signed currency, for profit and loss columns. */
export function signedUsd(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${MINUS}${MINUS}`;
  const sign = n > 0 ? "+" : n < 0 ? MINUS : "";
  return `${sign}${usdFmt.format(Math.abs(n))}`;
}

/** Percentage change between two marks. Returns null when it can't be known. */
export function change(from: number | null | undefined, to: number | null | undefined): number | null {
  const a = Number(from);
  const b = Number(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

/** Semantic token for a value's direction. Zero is neutral, never green. */
export function tone(value: number | null | undefined): "pos" | "neg" | "flat" {
  const n = Number(value);
  // a move that rounds to 0.00% reads flat — no fake green/red on a dead tick
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return "flat";
  return n > 0 ? "pos" : "neg";
}

export function toneClass(value: number | null | undefined): string {
  const t = tone(value);
  return t === "pos" ? "text-pos" : t === "neg" ? "text-neg" : "text-ink-3";
}

/** FACEBOOK/REACT → the display form used in headlines and the board. */
export function tickerParts(ticker: string): { owner: string; repo: string } {
  const [owner = "", repo = ""] = ticker.split("/");
  return { owner, repo };
}

/** 21 AUG 2026 · 14:32:07Z — the document-reference timestamp. */
export function stamp(d: Date): string {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const p = (n: number) => String(n).padStart(2, "0");
  // LOCAL time — the stamp should read as the clock on the machine viewing it,
  // not UTC. we append the viewer's short timezone instead of a "Z".
  let tz = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(d);
    tz = parts.find((x) => x.type === "timeZoneName")?.value ?? "";
  } catch {
    tz = "";
  }
  return `${p(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${tz ? " " + tz : ""}`;
}
