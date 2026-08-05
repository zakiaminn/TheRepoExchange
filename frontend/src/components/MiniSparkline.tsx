// tiny inline line chart, just draws a polyline through the data points scaled to fit a
// 48x24 box. used on the landing page's fake preview cards and on the real discovery
// cards (fed by actual recent price history from the ledger). for anything more
// detailed than "is this going up or down at a glance," the real chart on the asset
// page uses the actual lightweight-charts library instead
export function MiniSparkline({ data, positive, className }: { data: number[]; positive: boolean; className?: string }) {
  // need at least two points to draw a line - brand new listings with only one price
  // point yet just don't get a sparkline, no point drawing a single dot
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // avoid dividing by zero if every value in the data is the same
  const h = 24;
  const w = 48;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`overflow-visible ${className || ""}`}>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--bull)" : "var(--bear)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
