import type { MetadataRoute } from "next";
import { abs, SITE_URL } from "@/lib/site";

// the pages with public, indexable content: the homepage, the faq and the legal pages.
// the app routes are auth-gated and redirect to /login, so they're left out
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
    {
      url: abs("/faq"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...legal.map((path) => ({
      url: abs(path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
