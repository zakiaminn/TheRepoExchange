// Server-only presentational bits for the legal pages. No hooks, no "use
// client": these pages are static text, so they ship zero JavaScript. The look
// borrows the Bureau system (ruled sections, mono figures for the clause
// numbers, Bricolage for headings), kept calm and plain per the house voice.
import Link from "next/link";
import type { ReactNode } from "react";

/** A text link in the standard underlined-on-hover style. */
export function L({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="link">
      {children}
    </Link>
  );
}

/** The three-way sub-nav shown at the top of every legal page. */
export function LegalNav() {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legal documents">
      <L href="/legal/terms">Terms of Service</L>
      <L href="/legal/privacy">Privacy Policy</L>
      <L href="/legal/disclaimer">Disclaimer</L>
    </nav>
  );
}

/** A left-ruled note, matching the app's Notice component. */
export function Note({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-l-2 border-l-rule-2 pl-4 py-1 ${className}`}>
      {label ? <div className="label mb-1.5">{label}</div> : null}
      <div className="prose-measure text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/** The document title block: name, one-line summary, and the effective date. */
export function DocHeader({
  title,
  summary,
  lastUpdated,
}: {
  title: string;
  summary: string;
  lastUpdated: string;
}) {
  return (
    <header className="mb-10 border-b border-rule-2 pb-8">
      <h1 className="display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ink">{title}</h1>
      <p className="prose-measure mt-3 text-sm leading-relaxed text-ink-2">{summary}</p>
      <p className="ref mt-4">Effective {lastUpdated}</p>
    </header>
  );
}

/** A numbered clause. The number is set in the mono (Spline) as a small figure,
    the title in Bricolage; the body is measured prose. */
export function Clause({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-9 border-t border-rule pt-7 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="flex items-baseline gap-3">
        <span className="figure text-[13px] text-ink-3">{n}</span>
        <span className="display text-lg text-ink">{title}</span>
      </h2>
      <div className="prose-measure mt-3 space-y-3 text-sm leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

/** A bulleted list inside a clause, in the same measured prose style. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="prose-measure list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
