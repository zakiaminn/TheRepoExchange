import type { Metadata } from "next";
import { CALLS } from "@/lib/copy";

// signed-in only, so it's kept out of search. the page is a client component and can't
// export metadata itself
export const metadata: Metadata = {
  title: CALLS.title,
  robots: { index: false, follow: true },
};

export default function CallsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
