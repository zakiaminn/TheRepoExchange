import type { MetadataRoute } from "next";
import { SITE_URL, abs } from "@/lib/site";

// crawl rules. the sign-in and account pages stay crawlable so bots can read their
// noindex and drop them, since a robots.txt block hides the noindex and leaves an old
// copy in the index. /auth/ is only reached from email links, so it stays blocked.
// /asset/* is crawlable for social scrapers building link previews and marks itself
// noindex in its own metadata
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/"],
    },
    sitemap: abs("/sitemap.xml"),
    host: SITE_URL,
  };
}
