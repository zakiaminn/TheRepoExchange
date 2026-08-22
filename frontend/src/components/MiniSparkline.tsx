/* A trend line small enough to live inside a table cell. Deliberately not a
   chart: no axes, no fill, no gradient, no dots. It answers exactly one
   question — which way has this been going — and anything added to it makes
   it answer that question more slowly.

   The real chart, on the asset page, uses lightweight-charts. */
export function MiniSparkline({
  data,
  positive,
  className,
  w = 60,
  h = 18,
}: {
  data: number[];
  positive: boolean;
  className?: string;
  w?: number;
  h?: number;
}) {
  // one point is a dot, not a trend — brand new listings just don't get a line
  if (!Array.isArray(data) || data.length < 2) {
    return <span className={`inline-block ${className || ""}`} style={{ width: w, height: h }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // guard the flat-line case
  const pad = 1.5; // keep the stroke off the edges of the box
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--pos)" : "var(--neg)"}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
