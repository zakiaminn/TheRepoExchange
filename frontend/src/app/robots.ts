import type { MetadataRoute } from "next";
import { SITE_URL, abs } from "@/lib/site";

// crawl rules. the auth-gated routes redirect to /login, so bots are kept out of them.
// /asset/* stays crawlable because social scrapers respect robots.txt when building link
// previews, and those pages carry per-repo open graph tags. they mark themselves noindex
// in their own metadata instead
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
