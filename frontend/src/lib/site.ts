// One source of truth for anything SEO/sharing that needs an absolute origin:
// metadataBase, canonicals, the sitemap host, JSON-LD, OG image URLs.
//
// The canonical production host is therepo.exchange. It's overridable via
// NEXT_PUBLIC_SITE_URL so preview/staging deployments can canonicalise to
// themselves instead of leaking link equity to production — but the default is
// the real domain so nothing breaks if the env var is unset.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://therepo.exchange"
).replace(/\/$/, "");

export const SITE_NAME = "The Repo Exchange";
export const SITE_SHORT = "TRX";

// Used verbatim as the default meta description and the JSON-LD description.
// Deadpan and exact — a market in open source, priced from live GitHub
// activity, settlement simulated. No hype adjectives.
export const SITE_DESCRIPTION =
  "A market in open source. Listings are priced from live GitHub activity. Settlement is simulated.";

/** Absolute URL for a site-relative path. `abs("/asset/x/y")` → full URL. */
export function abs(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
