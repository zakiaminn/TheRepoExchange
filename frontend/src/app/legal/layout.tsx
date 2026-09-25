import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { LegalNav, Note } from "./parts";

// shared shell for every /legal page: a narrow reading column, a way back to the app,
// the document nav, and the "not legal advice" note. titles and metadata are set on
// each page
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <main className="mx-auto w-full max-w-[34rem] px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/"
          className="label inline-block sig"
        >
          ← Back to the exchange
        </Link>

        <div className="mt-6 mb-8 flex items-baseline justify-between gap-4 border-b border-rule pb-3">
          <span className="label label-ink">Legal</span>
          <span className="ref">{SITE_NAME}</span>
        </div>

        <LegalNav />

        <Note className="mb-10">
          These pages are provided for information and are not legal advice.
          They govern your use of {SITE_NAME}, a simulated platform. Read them in
          full before using the service.
        </Note>

        {children}
      </main>
    </div>
  );
}
