// server-only building blocks for the legal pages. no hooks and no client code, so the
// pages are static text with no javascript
import Link from "next/link";
import type { ReactNode } from "react";

// a text link in the standard underline-on-hover style
export function L({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="link">
      {children}
    </Link>
  );
}

// the three-way sub-nav at the top of every legal page
export function LegalNav() {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legal documents">
      <L href="/legal/terms">Terms of Service</L>
      <L href="/legal/privacy">Privacy Policy</L>
      <L href="/legal/disclaimer">Disclaimer</L>
    </nav>
  );
}

// a left-ruled note, like the app's Notice component
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

// the document title block: name, one-line summary, and the effective date
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

// a clause: the title as a ruled section label (like SectionRule), with the body as
// prose below
export function Clause({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-11 first:mt-0">
      <div className="flex items-center gap-4">
        <h2 className="label label-ink shrink-0">{title}</h2>
        <span className="rule-line" aria-hidden="true" />
      </div>
      <div className="prose-measure mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

// a bulleted list inside a clause, in the same prose style
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="prose-measure list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
