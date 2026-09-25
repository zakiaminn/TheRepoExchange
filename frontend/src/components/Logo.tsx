// the trx wordmark, with the "X" in the brand colour (--brand) on both themes and the
// full name beside it on wider screens

export function Wordmark({
  size = "md",
  showName = true,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  // "wide" holds the name back until lg, for bars that have to fit search,
  // nav and the account button beside it
  showName?: boolean | "wide";
  className?: string;
}) {
  const nameCls = showName === "wide" ? "hidden lg:block" : "hidden sm:block";

  const s = {
    sm: { ticker: "text-base", gap: "gap-2.5" },
    md: { ticker: "text-xl", gap: "gap-3" },
    lg: { ticker: "text-3xl", gap: "gap-4" },
  }[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <span className={`font-sans ${s.ticker} font-semibold text-ink leading-none tracking-[0.04em]`}>
        TR<span className="text-brand">X</span>
      </span>
      {showName && (
        <>
          <span className={`${nameCls} h-4 w-px bg-rule-2`} aria-hidden="true" />
          <span className={`label ${nameCls}`}>The Repo Exchange</span>
        </>
      )}
    </span>
  );
}
