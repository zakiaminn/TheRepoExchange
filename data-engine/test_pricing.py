"""checks compute_price() against every case in pricing/fixtures.json.
ledger/pricing.test.js runs the same cases against the node pricer. plain python,
exits non-zero on failure.
"""

import json
import os
import sys
from datetime import datetime

from pricing import compute_price

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "..", "pricing", "fixtures.json")) as f:
    fx = json.load(f)

now = datetime.strptime(fx["now"], "%Y-%m-%dT%H:%M:%SZ")

failures = 0
for c in fx["cases"]:
    i = c["input"]
    got = compute_price(
        i["stars"], i["forks"], i["watchers"],
        i["openIssues"], i["openPrs"], i["pushedAt"], now,
    )
    if got != c["expected"]:
        failures += 1
        print(f"FAIL  {c['name']}\n      expected {c['expected']}, got {got}")
    else:
        print(f"ok    {c['name']}  ->  {got}")

if failures:
    print(f"\n{failures} of {len(fx['cases'])} pricing fixture(s) FAILED ({fx['version']})")
    sys.exit(1)
print(f"\nAll {len(fx['cases'])} pricing fixtures pass ({fx['version']}).")
