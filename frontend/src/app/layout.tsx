import type { Metadata } from "next";
import { Bricolage_Grotesque, Martian_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";

// the fonts — and this is the actual trademark, meant to carry into every
// project i build, not just TRX:
//
//   Bricolage Grotesque = the words. slightly wonky, mixed-width grotesque
//   with real character (look at the g) that still reads fine at any size. it
//   looks chosen, which is the whole point — not a default.
//
//   Martian Mono = the machine voice AND the logo. every number, every
//   reference code, and the "TRX" wordmark itself use it. making the mono the
//   brand mark is the ownable bit — it reads as built-by-someone-who-ships.

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const martian = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian",
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
      suppressHydrationWarning
      className={`${bricolage.variable} ${martian.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            <Header />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
