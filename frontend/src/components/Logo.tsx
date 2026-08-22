/* the TRX mark — an octagon "seal" with a little ascending step inside.

   the octagon isn't random: it's the shape of a hallmark / coin edge / stamped
   seal, which reads as old and official. it also still works at 16px, which a
   round seal with text around it never does.

   the step inside reads as a price ladder or a commit graph climbing through
   branches — both work, don't overthink it.

   it's all strokes on currentColor with no hardcoded fill, so it just inherits
   whatever colour it's dropped into and works on light, dark, or on the accent
   without needing a second version.

   NOTE: heads up — the octagon/step is basically a placeholder. logo + seal is
   the next thing we're actually designing. */

export function Mark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* the seal */}
      <path
        d="M10.5 2.5 H21.5 L29.5 10.5 V21.5 L21.5 29.5 H10.5 L2.5 21.5 V10.5 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
      {/* the step */}
      <path
        d="M9 22 H15 V16 H21 V10"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/* The masthead lockup: seal, ticker set in the editorial serif, a hairline,
   and the full name in small caps. Straight out of a newspaper masthead,
   where the abbreviation and the full title have always sat on either side
   of a rule.                                                              */
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
    sm: { mark: "h-4 w-4", ticker: "text-base", gap: "gap-2" },
    md: { mark: "h-5 w-5", ticker: "text-xl", gap: "gap-2.5" },
    lg: { mark: "h-8 w-8", ticker: "text-3xl", gap: "gap-3.5" },
  }[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <Mark className={`${s.mark} text-brand-ink shrink-0`} />
      <span className={`figure ${s.ticker} font-semibold text-ink leading-none tracking-[0.01em]`}>TRX</span>
      {showName && (
        <>
          <span className="hidden sm:block h-4 w-px bg-rule-2" aria-hidden="true" />
          <span className="label hidden sm:block">The Repo Exchange</span>
        </>
      )}
    </span>
  );
}

// kept as an alias so nothing that imported the old name breaks
export const Logo = Mark;
