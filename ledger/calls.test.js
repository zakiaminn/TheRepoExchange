// tests for the repo calls rules. plain node, exits non-zero on failure

const assert = require('assert');
const {
    starVelocity, minTarget, eligibility, validateOpen, resolveStars, settle, voidRefund,
    PAYOUT_MULTIPLIER, SETTLE_GRACE_MS,
} = require('./calls');

const NOW = Date.parse('2026-09-10T00:00:00Z');
const hour = 60 * 60 * 1000;
const day = 24 * hour;

let failures = 0;
function check(name, fn) {
    try { fn(); console.log(`ok    ${name}`); }
    catch (e) { failures++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

// starVelocity
check('no velocity until the readings span a day', () => {
    assert.strictEqual(starVelocity([]), null);
    assert.strictEqual(starVelocity([{ at: NOW - 23 * hour, stars: 100 }, { at: NOW, stars: 200 }]), null);
});
check('velocity is stars per day across the window', () => {
    const v = starVelocity([{ at: NOW - 4 * day, stars: 1000 }, { at: NOW, stars: 1400 }]);
    assert.strictEqual(v, 100);
});
check('velocity takes the faster of the last day and the whole window', () => {
    const readings = [
        { at: NOW - 6 * day, stars: 10000 },
        { at: NOW - 1 * day, stars: 10050 },
        { at: NOW, stars: 12050 },
    ];
    assert.strictEqual(starVelocity(readings), 2000);
});
check('shrinking star counts give zero, not a negative pace', () => {
    assert.strictEqual(starVelocity([{ at: NOW - 2 * day, stars: 500 }, { at: NOW, stars: 480 }]), 0);
});

// minTarget
check('min target is current + projected growth + 1%', () => {
    assert.strictEqual(minTarget({ currentStars: 50000, velocityPerDay: 100, horizonMs: 30 * day }), 50000 + 3000 + 500);
});
check('min target margin is at least 10 stars', () => {
    assert.strictEqual(minTarget({ currentStars: 200, velocityPerDay: 0, horizonMs: 2 * day }), 210);
});

// eligibility
const fresh = { source: 'worker', isActive: true, currentStars: 5000, pricedAtMs: NOW - hour, velocityPerDay: 10, now: NOW };
check('an established, freshly read worker listing is eligible', () => {
    assert.deepStrictEqual(eligibility(fresh), { ok: true });
});
check('a repo someone added from the app is not eligible', () => {
    assert.strictEqual(eligibility({ ...fresh, source: 'user' }).ok, false);
});
check('an inactive repo is not eligible', () => {
    assert.strictEqual(eligibility({ ...fresh, isActive: false }).ok, false);
});
check('a repo under 1,000 stars is not eligible', () => {
    assert.strictEqual(eligibility({ ...fresh, currentStars: 999 }).ok, false);
});
check('a stale star count is not eligible', () => {
    assert.strictEqual(eligibility({ ...fresh, pricedAtMs: NOW - 3 * hour }).ok, false);
});
check('a repo without a day of star history is not eligible', () => {
    assert.strictEqual(eligibility({ ...fresh, velocityPerDay: null }).ok, false);
});

// validateOpen
const base = { stake: 250, currentStars: 75000, velocityPerDay: 0, deadlineMs: NOW + 30 * day, now: NOW };
check('accepts a call at the min target', () => {
    const r = validateOpen({ ...base, targetStars: 75750 });
    assert.deepStrictEqual(r, { ok: true, stake: 250, targetStars: 75750, minTarget: 75750 });
});
check('rejects a target already met or one star away', () => {
    assert.strictEqual(validateOpen({ ...base, targetStars: 75000 }).ok, false);
    assert.strictEqual(validateOpen({ ...base, targetStars: 75001 }).ok, false);
});
check('rejects a target below the projected trend', () => {
    // 2,000 stars a day for 30 days puts the floor at 75,000 + 60,000 + 750
    const r = validateOpen({ ...base, velocityPerDay: 2000, targetStars: 130000 });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /135,750/);
    assert.strictEqual(validateOpen({ ...base, velocityPerDay: 2000, targetStars: 135750 }).ok, true);
});
check('rounds the stake to the cent', () => {
    const r = validateOpen({ ...base, stake: 10.005, targetStars: 80000 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.stake, 10.01);
});
check('rejects a non-integer or non-positive target', () => {
    assert.strictEqual(validateOpen({ ...base, targetStars: 80000.5 }).ok, false);
    assert.strictEqual(validateOpen({ ...base, targetStars: 0 }).ok, false);
});
check('rejects a stake out of range', () => {
    assert.strictEqual(validateOpen({ ...base, stake: 0.5, targetStars: 80000 }).ok, false);
    assert.strictEqual(validateOpen({ ...base, stake: 10000.01, targetStars: 80000 }).ok, false);
    assert.strictEqual(validateOpen({ ...base, stake: Infinity, targetStars: 80000 }).ok, false);
});
check('caps the total stake across open calls', () => {
    assert.strictEqual(validateOpen({ ...base, stake: 2000, openStake: 8000, targetStars: 80000 }).ok, true);
    const r = validateOpen({ ...base, stake: 2000.01, openStake: 8000, targetStars: 80000 });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /\$8,000\.00 open/);
});
check('rejects a deadline too soon or too far out', () => {
    assert.strictEqual(validateOpen({ ...base, targetStars: 80000, deadlineMs: NOW + 1000 }).ok, false);
    assert.strictEqual(validateOpen({ ...base, targetStars: 80000, deadlineMs: NOW + 400 * day }).ok, false);
});

// resolveStars
const deadlineMs = NOW - hour;
check('uses the first reading after the deadline', () => {
    assert.deepStrictEqual(resolveStars({ deadlineMs, readingAfter: { stars: 81000 }, lastKnownStars: 90000, now: NOW }), { stars: 81000 });
});
check('waits for a reading during the grace period', () => {
    assert.strictEqual(resolveStars({ deadlineMs, readingAfter: null, lastKnownStars: 79000, now: NOW }), 'wait');
});
check('falls back to the last known count after the grace period, so a hidden repo is still judged', () => {
    const later = deadlineMs + SETTLE_GRACE_MS;
    assert.deepStrictEqual(resolveStars({ deadlineMs, readingAfter: null, lastKnownStars: 79000, now: later }), { stars: 79000 });
});
check('voids only when there is no star data at all', () => {
    const later = deadlineMs + SETTLE_GRACE_MS;
    assert.strictEqual(resolveStars({ deadlineMs, readingAfter: null, lastKnownStars: null, now: later }), 'void');
});

// settle
check('a met target wins and returns 2x the stake', () => {
    assert.deepStrictEqual(settle({ targetStars: 80000, stake: 250, resolvedStars: 80000 }), { status: 'won', payout: 500 });
    assert.deepStrictEqual(settle({ targetStars: 80000, stake: 250, resolvedStars: 81234 }), { status: 'won', payout: 500 });
});
check('a missed target loses and returns nothing', () => {
    assert.deepStrictEqual(settle({ targetStars: 80000, stake: 250, resolvedStars: 79999 }), { status: 'lost', payout: 0 });
});
check('payout multiplier is even-money (2x)', () => {
    assert.strictEqual(PAYOUT_MULTIPLIER, 2);
    assert.strictEqual(settle({ targetStars: 1, stake: 33.33, resolvedStars: 1 }).payout, 66.66);
});

// voidRefund
check('a void refunds exactly the stake', () => {
    assert.deepStrictEqual(voidRefund({ stake: 250 }), { status: 'void', payout: 250 });
});

// the calls form works out the min target with its own copy of the rule
(async () => {
    const path = require('path');
    const { pathToFileURL } = require('url');
    const frontend = await import(
        pathToFileURL(path.join(__dirname, '..', 'frontend', 'src', 'lib', 'calls.ts')).href
    );
    check('the frontend min target matches the ledger', () => {
        const cases = [
            [50000, 100, 30 * day], [200, 0, 2 * day], [75000, 2000, 30 * day],
            [1234, 17.5, 3.5 * day], [999999, 0.2, 364 * day],
        ];
        for (const [currentStars, velocityPerDay, horizonMs] of cases) {
            assert.strictEqual(
                frontend.minTarget(currentStars, velocityPerDay, horizonMs),
                minTarget({ currentStars, velocityPerDay, horizonMs })
            );
        }
    });

    if (failures) {
        console.error(`\n${failures} test(s) FAILED`);
        process.exit(1);
    }
    console.log(`\nAll Repo Calls tests pass.`);
})();
