import type { Metadata } from "next";
import { NAV } from "@/lib/copy";

// signed-in only, so it's kept out of search. the page is a client component and can't
// export metadata itself
export const metadata: Metadata = {
  title: NAV.positions,
  robots: { index: false, follow: true },
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
