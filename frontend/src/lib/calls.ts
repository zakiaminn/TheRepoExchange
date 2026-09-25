// the lowest target a call can have: today's stars, plus the recent pace projected to the
// deadline, plus 1% (at least 10 stars). the same rule as minTarget in ledger/calls.js,
// which checks it again when the call is opened
export function minTarget(currentStars: number, velocityPerDay: number, horizonMs: number): number {
  const projected = Math.ceil((Math.max(0, velocityPerDay) * Math.max(0, horizonMs)) / 86400000);
  const margin = Math.max(10, Math.ceil(currentStars * 0.01));
  return currentStars + projected + margin;
}

// a yyyy-mm-dd date in the viewer's own timezone, `days` from now
export function localDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// a call's deadline is the end of the chosen day in the viewer's timezone
export function deadlineMs(date: string): number {
  return new Date(`${date}T23:59:59`).getTime();
}
