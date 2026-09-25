import type { Metadata } from "next";
import { SITE_NAME, abs } from "@/lib/site";

type Params = { owner: string; repo: string };

// per-repo title, description, canonical and share card for /asset/[owner]/[repo]. it's a
// server layout because the page is a client component and can't export generateMetadata.
// the page is auth-gated, so it's noindex to keep login shells out of search, while social
// scrapers can still read the open graph tags for a shared link
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
      // og:image comes from the sibling opengraph-image.tsx
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
