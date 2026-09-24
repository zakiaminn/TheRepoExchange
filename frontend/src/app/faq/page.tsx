import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Common questions about ${SITE_NAME}: what it is, how prices are set, repo calls, and whether any of it is real.`,
  alternates: { canonical: "/faq" },
};

// Answers are plain strings so the same data feeds both the rendered page and
// the FAQPage structured data below, and so quotes/apostrophes never trip the
// JSX no-unescaped-entities rule. Where a fuller answer lives elsewhere, `more`
// points at it. Facts here mirror the app's NOTICE, the pricing breakdown, and
// the repo-calls rules, so the FAQ and the product never disagree.
type QA = { q: string; a: string; more?: { href: string; label: string } };
type Group = { group: string; items: QA[] };

const FAQ: Group[] = [
  {
    group: "The basics",
    items: [
      {
        q: "What is The Repo Exchange?",
        a: "TRX is a simulated market where open-source GitHub repositories are listed like securities and priced from their live public activity. You place simulated buy and sell orders and build a portfolio. It is part game, part experiment in valuing open source.",
      },
      {
        q: "Is any of this real? Can I make or lose real money?",
        a: "No. TRX is a simulation. Every account starts with 100,000 dollars of simulated capital, and balances are fictional: they have no cash value and cannot be deposited, withdrawn, or redeemed. No real money is ever involved, so there is nothing real to win or lose.",
        more: { href: "/legal/disclaimer", label: "Read the disclaimer" },
      },
      {
        q: "Is this investing? Are the listings securities?",
        a: "No. Listings are not securities, and nothing on TRX is investment, financial, or trading advice. A position confers no ownership of, claim on, or stake in any repository or the people who maintain it.",
      },
    ],
  },
  {
    group: "Getting started",
    items: [
      {
        q: "How do I start?",
        a: "Open an account with an email address. It is credited with 100,000 dollars of simulated capital straight away. No deposit is required, and none can be accepted.",
      },
      {
        q: "How much does it cost?",
        a: "Nothing. The service is free to use, and there is no payment step because there is no real money in the system.",
      },
    ],
  },
  {
    group: "Prices",
    items: [
      {
        q: "How are prices set?",
        a: "A listing's price is derived from the repository's public GitHub activity. Stars, forks, and watchers lift it; open pull requests add; open issues subtract, up to a cap; and the whole figure is aged by how recently the repository was pushed. The feed is polled continuously.",
      },
      {
        q: "Can I check a price myself?",
        a: "Yes. Each listing page shows the full derivation: the base, every metric's contribution, the capped issue drag, and the recency factor, all rebuilt from the repository's public numbers so the mark reconciles line by line. Prices are meant to be reproducible, not taken on trust.",
      },
      {
        q: "Why did a price move?",
        a: "Because the underlying public activity moved. New stars, forks, pull requests, or issues, or a fresh push, change the inputs, and the mark is recomputed from them. Nothing is set by hand.",
      },
    ],
  },
  {
    group: "Repo calls",
    items: [
      {
        q: "What is a repo call?",
        a: "A repo call is a simulated prediction: you stake simulated capital on whether a repository's star count will be above or below a target by a chosen deadline. Settlement is even-money.",
      },
      {
        q: "How does a call settle?",
        a: "It resolves automatically at its deadline against the repository's public star count, the same figure the price is built from. If you were right you are paid even money; if you were wrong you lose the stake. All of it is simulated.",
      },
      {
        q: "What if a repository is delisted before my call resolves?",
        a: "The call is voided and your stake is refunded. A call only settles for or against you if the listing is still on the board at the deadline.",
      },
    ],
  },
  {
    group: "Data, privacy, and GitHub",
    items: [
      {
        q: "Where does the data come from?",
        a: "From public GitHub data, chiefly the GitHub REST API, backfilled with history where it exists. Only public repository activity is used.",
      },
      {
        q: "Is TRX affiliated with GitHub?",
        a: "No. TRX is not affiliated with, endorsed by, or sponsored by GitHub, Microsoft, or any repository or maintainer shown here. Repository names and marks belong to their owners and are used only to identify the public repositories a listing refers to.",
      },
      {
        q: "What data do you collect about me?",
        a: "Very little: the email you register with, an authentication credential you never share with us in plain text, and the simulated activity you generate. There is no real money, so we never collect payment details, and we do not sell your data.",
        more: { href: "/legal/privacy", label: "Read the privacy policy" },
      },
      {
        q: "Can I delete my account?",
        a: "Yes. Contact us and we will delete your account and the data tied to it, subject to any records we are required to keep. The privacy policy explains your rights and how to exercise them.",
        more: { href: "/legal/privacy", label: "Read the privacy policy" },
      },
    ],
  },
];

const ALL = FAQ.flatMap((g) => g.items);

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ALL.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FAQ_() {
  return (
    <div className="flex-1">
      <main className="mx-auto w-full max-w-[52rem] px-5 py-10 sm:px-8 sm:py-14">
        <Link href="/" className="label inline-block sig">
          ← Back to the exchange
        </Link>

        <div className="mt-6 mb-8 flex items-baseline justify-between gap-4 border-b border-rule pb-3">
          <span className="label label-ink">FAQ</span>
          <span className="ref">{SITE_NAME}</span>
        </div>

        <header className="mb-4 border-b border-rule-2 pb-8">
          <h1 className="display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ink">
            Frequently asked questions
          </h1>
          <p className="prose-measure mt-3 text-sm leading-relaxed text-ink-2">
            What TRX is, how the prices are built, and how much of it is real.
            The short answer to that last one is: none of the money.
          </p>
        </header>

        {FAQ.map((g) => (
          <section key={g.group} className="mt-12">
            <div className="mb-2 border-b border-rule pb-2">
              <span className="label label-ink">{g.group}</span>
            </div>
            <dl>
              {g.items.map((item) => (
                <div key={item.q} className="border-t border-rule py-6 first:border-t-0">
                  <dt className="text-[15px] font-medium text-ink">{item.q}</dt>
                  <dd className="prose-measure mt-2 text-sm leading-relaxed text-ink-2">
                    {item.a}
                    {item.more ? (
                      <>
                        {" "}
                        <Link href={item.more.href} className="link">
                          {item.more.label}
                        </Link>
                        .
                      </>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <p className="ref mt-14 border-t border-rule-2 pt-6">
          Still stuck? See the{" "}
          <Link href="/legal/terms" className="link">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="link">
            Privacy Policy
          </Link>
          , or the per-listing pages, where every price shows its own working.
        </p>

        {/* FAQPage structured data. Valid and still read by non-Google surfaces;
            Google no longer shows FAQ rich results for general sites. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </main>
    </div>
  );
}
