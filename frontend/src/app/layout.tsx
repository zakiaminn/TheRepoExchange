import type { Metadata } from "next";
import { Bricolage_Grotesque, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_ALIASES,
  SITE_PROFILES,
  SITE_DESCRIPTION,
  abs,
} from "@/lib/site";

// the fonts: bricolage grotesque for the words (titles, body, labels and the wordmark),
// spline sans mono for the numbers (figures, reference codes and timestamps)

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
  // resolves every relative og, canonical and image url below (and the og:image that
  // the app/opengraph-image route injects) against the real origin
  metadataBase: new URL(SITE_URL),
  // the full name leads every title. "TRX" alone is also the ticker of a large
  // cryptocurrency, so it doesn't identify the site in search results
  title: {
    default: `${SITE_NAME} · ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
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
  // each page sets its own canonical. og and twitter titles and descriptions are left
  // out here so next fills them from each page's own title and description
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    // og:image comes from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Organization and WebSite structured data for search results. the WebSite name and
// alternateName are what google shows as the site name. there's no SearchAction since
// the site has no public search
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": abs("/#organization"),
      name: SITE_NAME,
      alternateName: SITE_ALIASES,
      url: SITE_URL,
      logo: abs("/trx-logo.png"),
      description: SITE_DESCRIPTION,
      sameAs: SITE_PROFILES,
    },
    {
      "@type": "WebSite",
      "@id": abs("/#website"),
      name: SITE_NAME,
      alternateName: SITE_ALIASES,
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
        {/* brand structured data, rendered server-side so crawlers see it in the
            initial html */}
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
