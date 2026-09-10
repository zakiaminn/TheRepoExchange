import type { Metadata } from "next";
import { SITE_NAME, abs } from "@/lib/site";

type Params = { owner: string; repo: string };

// Per-repo metadata for /asset/[owner]/[repo]. This lives in a server layout so
// the client trading page (page.tsx) is left untouched — a client component
// can't export generateMetadata, and this is the least invasive way to give
// every listing its own title, description, canonical, and share card.
//
// robots: index:false is deliberate. The page body is auth-gated and redirects
// to /login for anyone not signed in — including Googlebot — so letting it be
// indexed would just fill the index with login shells. noindex keeps it out of
// search while `follow` still passes link equity, and it does NOT stop social
// scrapers (Slack, X, Discord) from reading the Open Graph tags, so a shared
// /asset/owner/repo link still renders a rich per-repo card.
//
// When these pages are reworked to server-render public content, drop the
// index:false and add them to sitemap.ts — that's the long-tail SEO surface.
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const path = `/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const title = `${owner}/${repo}`;
  const description = `${owner}/${repo} priced on ${SITE_NAME} — a live mark derived from the repository's GitHub activity. Settlement is simulated.`;

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      url: abs(path),
      title: `${owner}/${repo}`,
      description,
      // og:image comes from the sibling opengraph-image.tsx (per-repo card).
    },
    twitter: {
      card: "summary_large_image",
      title: `${owner}/${repo}`,
      description,
    },
  };
}

export default function AssetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
