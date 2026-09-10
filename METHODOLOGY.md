# Pricing methodology

**TRX prices are not quoted, invented, or modelled off a hidden signal. Every
mark is a pure function of a handful of public GitHub numbers and the fixed
formula below.** This page publishes that formula in full so any price on the
board can be reproduced from the repository's public metrics.

This is the whole contract: given the six inputs, anyone gets the same price the
ledger does. Nothing else feeds the mark.

## Version

`PRICING-1` — 2026-09-10. The formula is versioned; if a weight changes, the
version changes with it, and the change is recorded here. A mark is only
reproducible against the version it was struck under.

## Inputs

All six come straight from the GitHub REST API for the repository. Five are
counts; one is a timestamp.

| Input | Source field | Notes |
|---|---|---|
| Stars | `stargazers_count` | |
| Forks | `forks_count` | |
| Watchers | `subscribers_count` | see fallback below |
| Open PRs | count of open pull requests | see fallback below |
| Open issues | `open_issues_count` minus open PRs | GitHub folds PRs into this count; we split them out |
| Last push | `pushed_at` | drives the recency term |

**Fallbacks (only when the cheaper GitHub search endpoint omits a field).** The
hourly refresh replaces both with the real counts on its next pass, so these are
transient, not permanent:

- Watchers missing → `stars × 0.03`
- Open-PR count missing → `open_issues × 0.15` is treated as PRs, and the same
  amount is subtracted from open issues.

## Constants (`PRICING-1`)

| Constant | Value | Meaning |
|---|---|---|
| `BASE_LISTING` | `$5.00` | every listing starts here |
| `W_STAR` | `$0.001` | per star |
| `W_FORK` | `$0.01` | per fork |
| `W_WATCH` | `$0.05` | per watcher |
| `W_PR` | `$1.00` | per open PR (work in flight) |
| `W_ISSUE` | `$1.00` | per open issue (drag) |
| `ISSUE_DRAG_CAP` | `0.60` | issue drag can remove at most 60% of gross |
| `PRICE_FLOOR` | `$1.00` | no listing prices below this |

## Formula

```
gross  = BASE_LISTING
       + stars      × W_STAR
       + forks      × W_FORK
       + watchers   × W_WATCH
       + open_prs   × W_PR

debt   = min( open_issues × W_ISSUE ,  ISSUE_DRAG_CAP × gross )

price  = max( PRICE_FLOOR ,  (gross − debt) × recency )
         rounded to the nearest cent
```

### Recency

`recency` is a multiplier in `[0.70, 1.00]` set by how long ago the repo was
last pushed to. Recently-active repos price at full value; a repo untouched for
a year or more is marked down to 70% and no further.

```
days = now − pushed_at   (whole days, floored to an integer)

recency = 1.00                                if days ≤ 30
        = 0.70                                if days ≥ 365
        = 1.00 − 0.30 × (days − 30) / 335     otherwise   (linear)
```

`days` is floored to a whole integer, and the final mark is rounded to the cent
half-away-from-zero. Both pricers do this identically — see the parity fixture
below.

## Worked example

Illustrative inputs (not a live listing — plug in any repository's real numbers
and the arithmetic is identical):

```
stars = 40,000   forks = 6,000   watchers = 1,200
open_prs = 80    open_issues = 900   pushed 120 days ago

gross = 5.00 + 40000×0.001 + 6000×0.01 + 1200×0.05 + 80×1.00
      = 5.00 + 40.00 + 60.00 + 60.00 + 80.00
      = 245.00

debt  = min( 900×1.00 , 0.60×245.00 )
      = min( 900.00 , 147.00 )
      = 147.00                         ← the cap binds here

recency = 1.00 − 0.30 × (120 − 30) / 335 = 1.00 − 0.0806 = 0.9194

price = max( 1.00 , (245.00 − 147.00) × 0.9194 )
      = 98.00 × 0.9194
      = $90.10
```

The asset page shows this same derivation for every listing, line by line, so
the mark is never a number you have to take on faith.

## Parity fixture

The mark is computed in two places — the Node ledger (`ledger/pricing.js`) and
the Python worker (`data-engine/pricing.py`). They are separate implementations,
so they are pinned to a shared contract: `pricing/fixtures.json` lists inputs and
their expected prices, and both `ledger/pricing.test.js` and
`data-engine/test_pricing.py` assert against it. If the two ever disagree, a test
fails. Run them with:

```
node ledger/pricing.test.js
python data-engine/test_pricing.py
```

## Reproducibility status

Where the claim now stands, honestly:

1. **Two pricers stay in lock-step.** Resolved — the formula lives in one module
   per runtime, pinned by the shared fixture above. This also closed a real
   parity bug: the ledger used to measure recency in fractional days while the
   worker floored to whole days, so the two could disagree by a few cents. Both
   now floor to whole days and round the final mark to the cent the same way.

2. **Recency can be reproduced to the cent.** The mark stored in the ledger was
   computed at the worker's last poll, and `days` keeps growing after that — so a
   naive recompute at read time would use a larger `days` than the one that
   struck the price. The ledger now persists both `pushed_at` (recency input) and
   `priced_at` (the instant the mark was struck), so the asset page reconstructs
   recency from `priced_at − pushed_at` exactly, not from the current clock.

   **Pending:** existing rows carry `NULL` for these two columns until the worker
   has repriced them at least once after the deploy of migration
   `003_repro_timestamps.sql`. While a row is `NULL`, the asset page falls back to
   an *implied* recency factor (backed out of the mark) and labels it as such.
   Once backfilled, the factor is shown with the exact age.
