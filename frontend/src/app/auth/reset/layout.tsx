import type { Metadata } from "next";
import { AUTH } from "@/lib/copy";

// reached only from a reset email, so it's kept out of search. the page is a client
// component and can't export metadata itself
export const metadata: Metadata = {
  title: AUTH.resetTitle,
  robots: { index: false, follow: true },
};

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
