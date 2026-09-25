// the repo pricing formula. data-engine/pricing.py and frontend/src/lib/pricing.ts are the
// other copies, and all three are tested against the same cases in pricing/fixtures.json.
// raw numbers in, a price out

const PRICING_VERSION = 'PRICING-2';

const W_STAR = 0.001, W_FORK = 0.01, W_WATCH = 0.05, W_PR = 1.00, W_ISSUE = 1.00;
const ISSUE_DRAG_CAP = 0.60, BASE_LISTING = 5.00, PRICE_FLOOR = 1.00;

// multiplier in [0.70, 1.00] from whole days since the last push. days is floored so it
// matches recency_multiplier() in data-engine/pricing.py. `now` is injectable so the
// fixtures are deterministic
function recencyMultiplier(pushedAt, now = Date.now()) {
    if (!pushedAt) return 1.0;
    const pushed = new Date(pushedAt);
    if (isNaN(pushed.getTime())) return 1.0;
    const days = Math.floor((now - pushed.getTime()) / 86400000);
    if (days <= 30) return 1.0;
    if (days >= 365) return 0.70;
    return 1.0 - 0.30 * (days - 30) / (365 - 30);
}

// open prs and open issues count as ln(1 + n), so a few thousand of either moves the price
// by a few dollars instead of a few thousand
function activity(n) {
    return Math.log1p(Math.max(0, n));
}

function computePrice({ stars = 0, forks = 0, watchers = null, openIssues = 0, openPrs = null, pushedAt = null }, now = Date.now()) {
    stars = stars || 0; forks = forks || 0; openIssues = openIssues || 0;
    if (watchers == null) watchers = stars * 0.03;           // guess for missing data
    if (openPrs == null) {
        const estPrs = openIssues * 0.15;                    // ~15% of open issues are really prs
        openPrs = estPrs;
        openIssues = Math.max(0, openIssues - estPrs);
    }
    const gross = BASE_LISTING + stars * W_STAR + forks * W_FORK + watchers * W_WATCH + activity(openPrs) * W_PR;
    const debt = Math.min(activity(openIssues) * W_ISSUE, ISSUE_DRAG_CAP * gross); // capped so small repos don't go negative
    const price = (gross - debt) * recencyMultiplier(pushedAt, now);
    return Math.round(Math.max(PRICE_FLOOR, price) * 100) / 100;
}

module.exports = {
    PRICING_VERSION, computePrice, recencyMultiplier, activity,
    W_STAR, W_FORK, W_WATCH, W_PR, W_ISSUE, ISSUE_DRAG_CAP, BASE_LISTING, PRICE_FLOOR,
};
