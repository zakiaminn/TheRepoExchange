import type { Metadata } from "next";
import { Bricolage_Grotesque, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { SITE_URL, SITE_NAME, SITE_SHORT, SITE_DESCRIPTION, abs } from "@/lib/site";

// the fonts — and this is the actual trademark, meant to carry into every
// project i build, not just TRX:
//
//   Bricolage Grotesque = the words, and now the mark too. slightly wonky,
//   mixed-width grotesque with real character (look at the g) that still reads
//   fine at any size. it carries titles, body, every label, and the "TRX"
//   wordmark itself.
//
//   Spline Sans Mono = the numbers, and only the numbers. every figure, every
//   reference code and timestamp. it replaced Martian Mono (2026-09), which had
//   started reading as a generic/AI mono; the rule tightened to "Bricolage
//   reads, Spline counts" with the mono kept strictly to the machine's output.

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const spline = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-spline",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves every relative OG/canonical/image URL below (and the og:image
  // that the app/opengraph-image route injects) against the real origin.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_SHORT} · ${SITE_NAME}`,
    template: `%s · ${SITE_SHORT}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "The Repo Exchange",
    "repo exchange",
    "open source market",
    "GitHub repository prices",
    "GitHub stars market",
    "open source stock market",
    "prediction market open source",
  ],
  // Own the brand term: the homepage is the canonical for the whole site.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_SHORT} · ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    // og:image comes from app/opengraph-image.tsx automatically.
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_SHORT} · ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

// Organization + WebSite structured data. This is what earns the branded
// sitelinks box and a proper knowledge-panel entry when someone searches
// "the repo exchange" / "TRX" — the single highest-leverage schema for a brand
// nobody has heard of yet. No SearchAction: there's no public site search to
// wire it to, and asserting one you don't have is worse than omitting it.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": abs("/#organization"),
      name: SITE_NAME,
      alternateName: SITE_SHORT,
      url: SITE_URL,
      logo: abs("/trx-mark.svg"),
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": abs("/#website"),
      name: SITE_NAME,
      alternateName: SITE_SHORT,
      url: SITE_URL,
      publisher: { "@id": abs("/#organization") },
      description: SITE_DESCRIPTION,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${spline.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {/* Brand structured data. Rendered server-side so crawlers see it in the
            initial HTML, not after hydration. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
