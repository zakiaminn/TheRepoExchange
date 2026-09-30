import type { Metadata } from "next";
import { Board } from "@/components/Board";
import { discoverySnapshot, hasSessionCookie } from "@/lib/snapshot";

export const metadata: Metadata = {
  title: "Listings",
  description: "Every listing on The Repo Exchange and its current price, recalculated every hour from public GitHub numbers.",
  alternates: { canonical: "/listings" },
};

// every listing and its price, readable without an account
export default async function ListingsPage() {
  const [initial, maybeSignedIn] = await Promise.all([discoverySnapshot(), hasSessionCookie()]);
  return <Board initial={initial} maybeSignedIn={maybeSignedIn} />;
}
