// Parity test for the Node pricer. Loads the shared contract in pricing/fixtures.json
// and asserts computePrice() reproduces every expected value. Its twin,
// data-engine/test_pricing.py, asserts the same file against the Python pricer, so the
// two implementations are pinned to the same numbers and cannot drift.
//
// Run:  node ledger/pricing.test.js   (no test framework, exits non-zero on failure)

const fs = require('fs');
const path = require('path');
const { computePrice } = require('./pricing');

const fx = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'pricing', 'fixtures.json'), 'utf8')
);
const nowMs = Date.parse(fx.now);

let failures = 0;
for (const c of fx.cases) {
    const i = c.input;
    const got = computePrice(
        {
            stars: i.stars, forks: i.forks, watchers: i.watchers,
            openIssues: i.openIssues, openPrs: i.openPrs, pushedAt: i.pushedAt,
        },
        nowMs
    );
    if (got !== c.expected) {
        failures++;
        console.error(`FAIL  ${c.name}\n      expected ${c.expected}, got ${got}`);
    } else {
        console.log(`ok    ${c.name}  ->  ${got}`);
    }
}

if (failures) {
    console.error(`\n${failures} of ${fx.cases.length} pricing fixture(s) FAILED (${fx.version})`);
    process.exit(1);
}
console.log(`\nAll ${fx.cases.length} pricing fixtures pass (${fx.version}).`);
