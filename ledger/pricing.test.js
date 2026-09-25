// checks computePrice() in ledger/pricing.js and frontend/src/lib/pricing.ts against every
// case in pricing/fixtures.json. data-engine/test_pricing.py runs the same cases against the
// python pricer. plain node, exits non-zero on failure

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ledger = require('./pricing');

const fx = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'pricing', 'fixtures.json'), 'utf8')
);
const nowMs = Date.parse(fx.now);

// runs every case through one pricer and returns how many failed
function check(label, computePrice, version) {
    let failures = 0;
    if (version !== fx.version) {
        failures++;
        console.error(`FAIL  ${label} says ${version}, fixtures are ${fx.version}`);
    }
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
            console.error(`FAIL  ${label}: ${c.name}\n      expected ${c.expected}, got ${got}`);
        } else {
            console.log(`ok    ${label}: ${c.name}  ->  ${got}`);
        }
    }
    return failures;
}

(async () => {
    // node 24 runs .ts files directly by stripping the types
    const frontend = await import(
        pathToFileURL(path.join(__dirname, '..', 'frontend', 'src', 'lib', 'pricing.ts')).href
    );
    const failures =
        check('ledger', ledger.computePrice, ledger.PRICING_VERSION) +
        check('frontend', frontend.computePrice, frontend.PRICING_VERSION);

    if (failures) {
        console.error(`\n${failures} pricing check(s) FAILED (${fx.version})`);
        process.exit(1);
    }
    console.log(`\nAll ${fx.cases.length} pricing fixtures pass in both copies (${fx.version}).`);
})();
