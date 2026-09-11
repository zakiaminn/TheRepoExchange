import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { L } from "./parts";

export const metadata: Metadata = {
  title: "Legal",
  description: `The terms, privacy policy, and disclaimer governing use of ${SITE_NAME}.`,
  alternates: { canonical: "/legal" },
};

const DOCS = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    blurb: "The agreement between you and the operator. What TRX is, what you may and may not do, disclaimers, and the limits on liability.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    blurb: "What data we collect (an email and your simulated activity), why, who processes it, and the rights you have over it.",
  },
  {
    href: "/legal/disclaimer",
    title: "Disclaimer",
    blurb: "The short version: TRX is a simulation, nothing here is a security or financial advice, and it is not affiliated with GitHub.",
  },
];

export default function LegalIndex() {
  return (
    <div>
      <header className="mb-10 border-b border-rule-2 pb-8">
        <h1 className="display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ink">Legal</h1>
        <p className="prose-measure mt-3 text-sm leading-relaxed text-ink-2">
          The documents that govern your use of {SITE_NAME}. TRX is a simulation:
          no securities are offered or sold, and no real money changes hands.
        </p>
      </header>

      <ul className="divide-y divide-rule border-y border-rule">
        {DOCS.map((d) => (
          <li key={d.href} className="py-6">
            <h2 className="text-base">
              <L href={d.href}>{d.title}</L>
            </h2>
            <p className="prose-measure mt-2 text-sm leading-relaxed text-ink-2">
              {d.blurb}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
