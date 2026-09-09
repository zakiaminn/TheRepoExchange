import type { Metadata } from "next";
import { Bricolage_Grotesque, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

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
  title: {
    default: "TRX · The Repo Exchange",
    template: "%s · TRX",
  },
  description:
    "A market in open source. Listings are priced from live GitHub activity. Settlement is simulated.",
  openGraph: {
    title: "TRX · The Repo Exchange",
    description: "A market in open source. Listings priced from live GitHub activity.",
    type: "website",
  },
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
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
