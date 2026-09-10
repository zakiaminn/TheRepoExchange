import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only list URLs that actually render indexable content. Right now that's just
// the homepage — every other route is auth-gated and redirects to /login, so
// putting them here would feed Google URLs that resolve to empty login shells
// (a "submitted URL not indexed" penalty, not a win).
//
// When the per-repo /asset/[owner]/[repo] pages are made to server-render
// public content (see the note in the layout there), enumerate the listed
// repos from the discovery API and emit one entry each — that's the long-tail
// surface worth indexing.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
