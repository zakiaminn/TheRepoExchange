// tests for the repo calls payout rules. plain node, exits non-zero on failure

const assert = require('assert');
const { validateOpen, settle, voidRefund, PAYOUT_MULTIPLIER } = require('./calls');

const NOW = Date.parse('2026-09-10T00:00:00Z');
const day = 24 * 60 * 60 * 1000;

let failures = 0;
function check(name, fn) {
    try { fn(); console.log(`ok    ${name}`); }
    catch (e) { failures++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

// validateOpen
check('accepts a well-formed call', () => {
    const r = validateOpen({ stake: 250, targetStars: 80000, currentStars: 75000, deadlineMs: NOW + 30 * day, now: NOW });
    assert.deepStrictEqual(r, { ok: true, stake: 250, targetStars: 80000 });
});
check('rounds the stake to the cent', () => {
    const r = validateOpen({ stake: 10.005, targetStars: 100, currentStars: 50, deadlineMs: NOW + 2 * day, now: NOW });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.stake, 10.01);
});
check('rejects a target at or below current stars', () => {
    assert.strictEqual(validateOpen({ stake: 10, targetStars: 75000, currentStars: 75000, deadlineMs: NOW + 30 * day, now: NOW }).ok, false);
    assert.strictEqual(validateOpen({ stake: 10, targetStars: 100, currentStars: 200, deadlineMs: NOW + 30 * day, now: NOW }).ok, false);
});
check('rejects a non-integer or non-positive target', () => {
    assert.strictEqual(validateOpen({ stake: 10, targetStars: 100.5, currentStars: 10, deadlineMs: NOW + 2 * day, now: NOW }).ok, false);
    assert.strictEqual(validateOpen({ stake: 10, targetStars: 0, currentStars: 0, deadlineMs: NOW + 2 * day, now: NOW }).ok, false);
});
check('rejects a stake out of range', () => {
    assert.strictEqual(validateOpen({ stake: 0.5, targetStars: 100, currentStars: 10, deadlineMs: NOW + 2 * day, now: NOW }).ok, false);
    assert.strictEqual(validateOpen({ stake: 100001, targetStars: 100, currentStars: 10, deadlineMs: NOW + 2 * day, now: NOW }).ok, false);
});
check('rejects a deadline too soon or too far out', () => {
    assert.strictEqual(validateOpen({ stake: 10, targetStars: 100, currentStars: 10, deadlineMs: NOW + 1000, now: NOW }).ok, false);
    assert.strictEqual(validateOpen({ stake: 10, targetStars: 100, currentStars: 10, deadlineMs: NOW + 400 * day, now: NOW }).ok, false);
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

if (failures) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exit(1);
}
console.log(`\nAll Repo Calls economics tests pass.`);
