import type { MetadataRoute } from "next";
import { abs, SITE_URL } from "@/lib/site";

// Only list URLs that actually render indexable content: the homepage and the
// public legal pages. The app routes are auth-gated and redirect to /login, so
// listing them would feed Google URLs that resolve to empty login shells
// (a "submitted URL not indexed" penalty, not a win).
//
// When the per-repo /asset/[owner]/[repo] pages are made to server-render
// public content (see the note in the layout there), enumerate the listed
// repos from the discovery API and emit one entry each: that's the long-tail
// surface worth indexing.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const legal = ["/legal", "/legal/terms", "/legal/privacy", "/legal/disclaimer"];
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...legal.map((path) => ({
      url: abs(path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
