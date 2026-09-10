// ── Canonical pricing — PRICING-1 ──
// The single source of truth for the Node side. The Python worker mirrors this in
// data-engine/pricing.py, and BOTH are pinned to the shared cases in
// pricing/fixtures.json so the two implementations cannot silently drift. If you
// change a weight or the curve here, change it there, bump the version, and update
// METHODOLOGY.md. Pure: raw numbers in, a price out — no db, no network.

const W_STAR = 0.001, W_FORK = 0.01, W_WATCH = 0.05, W_PR = 1.00, W_ISSUE = 1.00;
const ISSUE_DRAG_CAP = 0.60, BASE_LISTING = 5.00, PRICE_FLOOR = 1.00;

// multiplier in [0.70, 1.00] from WHOLE days since last push. days is floored to an
// integer so this matches recency_multiplier() in data-engine/pricing.py exactly —
// fractional days were a parity bug between the two pricers. `now` is injectable so
// the shared fixtures are deterministic.
function recencyMultiplier(pushedAt, now = Date.now()) {
    if (!pushedAt) return 1.0;
    const pushed = new Date(pushedAt);
    if (isNaN(pushed.getTime())) return 1.0;
    const days = Math.floor((now - pushed.getTime()) / 86400000);
    if (days <= 30) return 1.0;
    if (days >= 365) return 0.70;
    return 1.0 - 0.30 * (days - 30) / (365 - 30);
}

function computePrice({ stars = 0, forks = 0, watchers = null, openIssues = 0, openPrs = null, pushedAt = null }, now = Date.now()) {
    stars = stars || 0; forks = forks || 0; openIssues = openIssues || 0;
    if (watchers == null) watchers = stars * 0.03;           // guess for missing data
    if (openPrs == null) {
        const estPrs = openIssues * 0.15;                    // ~15% of open issues are really PRs
        openPrs = estPrs;
        openIssues = Math.max(0, openIssues - estPrs);
    }
    const gross = BASE_LISTING + stars * W_STAR + forks * W_FORK + watchers * W_WATCH + openPrs * W_PR;
    const debt = Math.min(openIssues * W_ISSUE, ISSUE_DRAG_CAP * gross); // capped so big repos don't go negative
    const price = (gross - debt) * recencyMultiplier(pushedAt, now);
    return Math.round(Math.max(PRICE_FLOOR, price) * 100) / 100;
}

module.exports = {
    computePrice, recencyMultiplier,
    W_STAR, W_FORK, W_WATCH, W_PR, W_ISSUE, ISSUE_DRAG_CAP, BASE_LISTING, PRICE_FLOOR,
};
