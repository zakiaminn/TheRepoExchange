import type { Metadata } from "next";
import { Board } from "@/components/Board";
import { discoverySnapshot, hasSessionCookie } from "@/lib/snapshot";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// the title and description are the layout's defaults. openGraph replaces the layout's
// whole object, so it repeats the type and site name
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, url: SITE_URL },
};

// the home page: the landing page for visitors, the listings once you're signed in
export default async function Home() {
  const [initial, maybeSignedIn] = await Promise.all([discoverySnapshot(), hasSessionCookie()]);
  return <Board landing initial={initial} maybeSignedIn={maybeSignedIn} />;
}
