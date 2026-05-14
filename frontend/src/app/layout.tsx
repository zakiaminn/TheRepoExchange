import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";

const inter = Inter({ // using variable font for better performance and flexibility
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = { //metadata for app
  title: "TRX Exchange",
  description: "Modern retail brokerage platform",
};

export default function RootLayout({ // the root layout that wraps all pages, includes the header and theme provider, and applies global styles
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
