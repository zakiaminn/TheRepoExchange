// the site's absolute origin, for anything seo or sharing related: metadataBase,
// canonicals, the sitemap, json-ld, og image urls. defaults to therepo.exchange, and
// NEXT_PUBLIC_SITE_URL overrides it so preview deploys can canonicalise to themselves
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://therepo.exchange"
).replace(/\/$/, "");

export const SITE_NAME = "The Repo Exchange";
export const SITE_SHORT = "TRX";

// the default meta description, also used in the json-ld
export const SITE_DESCRIPTION =
  "A market in open source. Listings are priced every hour from public GitHub activity. Trading is simulated.";

// absolute url for a site-relative path, e.g. `abs("/asset/x/y")`
export function abs(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
