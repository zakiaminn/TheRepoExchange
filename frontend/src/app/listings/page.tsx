import type { Metadata } from "next";
import { Board } from "@/components/Board";

export const metadata: Metadata = {
  title: "Listings",
  description: "Every listing on The Repo Exchange and its current price, recalculated every hour from public GitHub numbers.",
  alternates: { canonical: "/listings" },
};

// every listing and its price, readable without an account
export default function ListingsPage() {
  return <Board />;
}
