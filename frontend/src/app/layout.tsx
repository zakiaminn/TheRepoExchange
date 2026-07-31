import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";

const inter = Inter({ // variable font so we get all the weights we need
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 dark:bg-[#121212] dark:text-gray-100 transition-colors duration-300 font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
