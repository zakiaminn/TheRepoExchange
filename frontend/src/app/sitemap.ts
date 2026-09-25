import type { MetadataRoute } from "next";
import { abs, SITE_URL } from "@/lib/site";

// the pages with public, indexable content: the homepage, the listings, the faq and the legal
// pages. single listings are client-rendered and stay out for now
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
      url: abs("/listings"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
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
