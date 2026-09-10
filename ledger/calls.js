// ── Repo Calls economics ──
// A "call" is a prediction that a repo reaches a star target by a deadline. v1 settles
// EVEN-MONEY from the simulated wallet: a correct call returns 2x the stake (net +stake),
// a wrong one forfeits it (net -stake), and a call we can't judge (repo delisted, no
// public star count) is voided and the stake refunded. No invented odds — the payout
// rule is flat and stated, consistent with the rest of the product. A proper derived-odds
// model is v2, and needs star-velocity history we don't record yet.
//
// Pure: no db, no network. Pinned by ledger/calls.test.js.

const MIN_STAKE = 1.0;
const MAX_STAKE = 100000.0;
const MIN_HORIZON_MS = 24 * 60 * 60 * 1000;         // deadline must be >= 1 day out
const MAX_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;   // and <= 1 year out
const PAYOUT_MULTIPLIER = 2;                         // even-money: a win returns 2x stake

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Validate a call-open request against the repo's current stars and the clock.
// Returns { ok: true, stake, targetStars } or { ok: false, error }.
function validateOpen({ stake, targetStars, currentStars, deadlineMs, now = Date.now() }) {
    const s = Number(stake);
    if (!Number.isFinite(s) || s < MIN_STAKE || s > MAX_STAKE) {
        return { ok: false, error: `Stake must be between $${MIN_STAKE.toFixed(2)} and $${MAX_STAKE.toFixed(2)}.` };
    }
    const t = Number(targetStars);
    if (!Number.isInteger(t) || t <= 0) {
        return { ok: false, error: "Target stars must be a positive whole number." };
    }
    const c = Number(currentStars);
    if (!Number.isFinite(c) || c < 0) {
        return { ok: false, error: "Current star count is unavailable for this repository." };
    }
    // the target has to be ABOVE where the repo is now, or there is nothing to predict
    if (t <= c) {
        return { ok: false, error: `Target (${t}) must be above the current star count (${c}).` };
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
    return { ok: true, stake: round2(s), targetStars: t };
}

// Decide a due call against the resolved public star count. Returns
// { status: 'won' | 'lost', payout } where payout is what to CREDIT to the wallet
// (2x stake on a win, 0 on a loss).
function settle({ targetStars, stake, resolvedStars, direction = 'above' }) {
    const won = direction === 'below'
        ? Number(resolvedStars) <= Number(targetStars)
        : Number(resolvedStars) >= Number(targetStars);
    return {
        status: won ? 'won' : 'lost',
        payout: won ? round2(Number(stake) * PAYOUT_MULTIPLIER) : 0,
    };
}

// A call we can't judge (repo delisted, star count missing) is voided and the stake
// refunded — the user is made whole, never penalised for our missing data.
function voidRefund({ stake }) {
    return { status: 'void', payout: round2(stake) };
}

module.exports = {
    validateOpen, settle, voidRefund,
    MIN_STAKE, MAX_STAKE, MIN_HORIZON_MS, MAX_HORIZON_MS, PAYOUT_MULTIPLIER,
};
