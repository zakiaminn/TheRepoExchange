import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";

// display font - headlines, big stat numbers (price/index/pnl), the logo wordmark.
// only need the two weights we actually use, no point shipping the rest
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

// body font - everything else. labels, paragraphs, buttons, table cells
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

// shows up in the browser tab and in link previews when someone shares the site
export const metadata: Metadata = {
  title: "TRX Exchange",
  description: "Modern retail brokerage platform",
};

// this wraps literally every page in the app. themeprovider handles dark/light mode
// switching and header shows up on every route except login (header bails out early if
// you're on /login, see Header.tsx)
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-page text-ink transition-colors duration-300 font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
