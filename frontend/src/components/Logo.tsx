/* the TRX wordmark — the logo is the name itself, no separate symbol.

   the one move: the X is set in the accent (Sulfur). it's the exchange letter,
   it's the strongest glyph in "TRX", and it gives us a free one-letter favicon
   (see app/icon.svg). the X uses --brand-ink, not --brand, so it stays legible
   as text — deep olive on the light ground, bright on dark. everything else is
   ink, set in Martian Mono like the rest of the machine voice.

   (the old octagon seal is retired — this replaced it.) */

export function Wordmark({
  size = "md",
  showName = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}) {
  const s = {
    sm: { ticker: "text-base", gap: "gap-2.5" },
    md: { ticker: "text-xl", gap: "gap-3" },
    lg: { ticker: "text-3xl", gap: "gap-4" },
  }[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <span className={`figure ${s.ticker} font-semibold text-ink leading-none tracking-[0.04em]`}>
        TR<span className="text-brand-ink">X</span>
      </span>
      {showName && (
        <>
          <span className="hidden sm:block h-4 w-px bg-rule-2" aria-hidden="true" />
          <span className="label hidden sm:block">The Repo Exchange</span>
        </>
      )}
    </span>
  );
}
