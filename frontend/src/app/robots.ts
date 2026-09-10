import type { MetadataRoute } from "next";
import { SITE_URL, abs } from "@/lib/site";

// Crawl rules. The only route that renders public, indexable content is "/"
// (the logged-out landing page); everything else is auth-gated and bounces to
// /login, so we keep bots out of those to avoid indexing empty login shells.
//
// Note we deliberately do NOT disallow /asset/* here: those pages carry
// per-repo Open Graph tags, and social scrapers (Slack, Discord, X, etc.)
// honour robots.txt when fetching link previews. The asset pages mark
// themselves noindex in their own metadata instead, which keeps them out of
// Google's index while still letting a shared /asset/owner/repo link render a
// rich card. See app/asset/[owner]/[repo]/layout.tsx.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/login", "/auth/", "/settings", "/portfolio", "/calls"],
    },
    sitemap: abs("/sitemap.xml"),
    host: SITE_URL,
  };
}
