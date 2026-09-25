// rules for repo calls. a call is a prediction that a repo reaches a star target by a
// deadline, settled even-money from the simulated wallet: a correct call returns 2x the stake,
// a wrong one loses it. the target has to clear the repo's recent growth projected to the
// deadline, so a call is a bet on beating the trend. no db, no network

const MIN_STAKE = 1.0;
const MAX_STAKE = 10000.0;                          // per call
const MAX_OPEN_STAKE = 10000.0;                     // across all of a user's open calls
const MIN_CALL_STARS = 1000;                        // calls only on established repos
const MIN_HORIZON_MS = 24 * 60 * 60 * 1000;         // deadline at least 1 day out
const MAX_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;   // and at most 1 year out
const MAX_READING_AGE_MS = 2 * 60 * 60 * 1000;      // the star count has to be this fresh
const MIN_HISTORY_MS = 24 * 60 * 60 * 1000;         // star history needed before calls open
const SETTLE_GRACE_MS = 6 * 60 * 60 * 1000;         // how long settlement waits for a reading
const PAYOUT_MULTIPLIER = 2;                        // even-money: a win returns 2x stake
const DAY_MS = 24 * 60 * 60 * 1000;

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const fmt = (n) => Number(n).toLocaleString('en-US');
const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// stars gained per day, from a repo's star readings ({ at: ms, stars }, oldest first). takes
// the faster of the last day's growth and the growth across the whole window, so a repo that
// just started trending is judged on its new pace. null until the readings span a full day
function starVelocity(readings) {
    const rs = (readings || []).filter((r) => Number.isFinite(r.at) && Number.isFinite(r.stars));
    if (rs.length < 2) return null;
    const latest = rs[rs.length - 1];
    const first = rs[0];
    if (latest.at - first.at < MIN_HISTORY_MS) return null;

    const rate = (from) => (latest.stars - from.stars) / ((latest.at - from.at) / DAY_MS);
    // the newest reading that's at least a day older than the latest one
    let dayAgo = first;
    for (const r of rs) {
        if (r.at <= latest.at - MIN_HISTORY_MS) dayAgo = r;
        else break;
    }
    return Math.max(0, rate(first), rate(dayAgo));
}

// the lowest target a call can have: today's stars, plus the recent pace projected to the
// deadline, plus 1% (at least 10 stars) on top
function minTarget({ currentStars, velocityPerDay, horizonMs }) {
    const projected = Math.ceil(Math.max(0, velocityPerDay) * Math.max(0, horizonMs) / DAY_MS);
    const margin = Math.max(10, Math.ceil(currentStars * 0.01));
    return currentStars + projected + margin;
}

// whether a repo can take calls right now. returns { ok: true } or { ok: false, error }
function eligibility({ source, isActive, currentStars, pricedAtMs, velocityPerDay, now = Date.now() }) {
    if (source !== 'worker' || isActive !== true) {
        return { ok: false, error: "Calls are only open on the main listings, not on repositories you added." };
    }
    if (!Number.isFinite(currentStars) || currentStars < MIN_CALL_STARS) {
        return { ok: false, error: `Calls need a repository with at least ${fmt(MIN_CALL_STARS)} stars.` };
    }
    if (!Number.isFinite(pricedAtMs) || now - pricedAtMs > MAX_READING_AGE_MS) {
        return { ok: false, error: "The star count is more than two hours old. Try again after the next update." };
    }
    if (velocityPerDay == null) {
        return { ok: false, error: "Calls open on a repository once it has a day of star history." };
    }
    return { ok: true };
}

// validates a call-open request. `openStake` is what the user already has in open calls.
// returns { ok: true, stake, targetStars, minTarget } or { ok: false, error }
function validateOpen({ stake, targetStars, currentStars, velocityPerDay = 0, deadlineMs, openStake = 0, now = Date.now() }) {
    const s = Number(stake);
    if (!Number.isFinite(s) || s < MIN_STAKE || s > MAX_STAKE) {
        return { ok: false, error: `Stake must be between ${money(MIN_STAKE)} and ${money(MAX_STAKE)}.` };
    }
    const t = Number(targetStars);
    if (!Number.isInteger(t) || t <= 0) {
        return { ok: false, error: "Target stars must be a positive whole number." };
    }
    const c = Number(currentStars);
    if (!Number.isFinite(c) || c < 0) {
        return { ok: false, error: "Current star count is unavailable for this repository." };
    }
    if (!Number.isFinite(deadlineMs)) {
        return { ok: false, error: "Invalid deadline." };
    }
    const horizon = deadlineMs - now;
    if (horizon < MIN_HORIZON_MS) {
        return { ok: false, error: "Deadline must be at least 24 hours away." };
    }
    if (horizon > MAX_HORIZON_MS) {
        return { ok: false, error: "Deadline must be within a year." };
    }
    const floor = minTarget({ currentStars: c, velocityPerDay, horizonMs: horizon });
    if (t < floor) {
        return { ok: false, error: `Target must be at least ${fmt(floor)} stars for that deadline.` };
    }
    if (round2(Number(openStake) + s) > MAX_OPEN_STAKE) {
        return { ok: false, error: `Open calls are capped at ${money(MAX_OPEN_STAKE)} in total. You have ${money(openStake)} open.` };
    }
    return { ok: true, stake: round2(s), targetStars: t, minTarget: floor };
}

// picks the star count a due call is judged on. the first reading at or after the deadline
// wins. if none has come in by the end of the grace period (the worker is behind, or the repo
// went private or was deleted), it falls back to the last reading on record, so hiding a repo
// can't turn a loss into a refund. returns { stars }, 'wait', or 'void' when there's no data
function resolveStars({ deadlineMs, readingAfter, lastKnownStars, now = Date.now() }) {
    if (readingAfter && Number.isFinite(Number(readingAfter.stars))) {
        return { stars: Number(readingAfter.stars) };
    }
    if (now < deadlineMs + SETTLE_GRACE_MS) return 'wait';
    if (lastKnownStars != null && Number.isFinite(Number(lastKnownStars))) {
        return { stars: Number(lastKnownStars) };
    }
    return 'void';
}

// decides a due call against the resolved star count. returns { status: 'won' | 'lost',
// payout } where payout is what gets credited to the wallet (2x stake on a win, 0 on a loss)
function settle({ targetStars, stake, resolvedStars, direction = 'above' }) {
    const won = direction === 'below'
        ? Number(resolvedStars) <= Number(targetStars)
        : Number(resolvedStars) >= Number(targetStars);
    return {
        status: won ? 'won' : 'lost',
        payout: won ? round2(Number(stake) * PAYOUT_MULTIPLIER) : 0,
    };
}

// a call with no star data at all is voided and the stake refunded in full
function voidRefund({ stake }) {
    return { status: 'void', payout: round2(stake) };
}

module.exports = {
    starVelocity, minTarget, eligibility, validateOpen, resolveStars, settle, voidRefund,
    MIN_STAKE, MAX_STAKE, MAX_OPEN_STAKE, MIN_CALL_STARS, MIN_HORIZON_MS, MAX_HORIZON_MS,
    MAX_READING_AGE_MS, MIN_HISTORY_MS, SETTLE_GRACE_MS, PAYOUT_MULTIPLIER,
};
