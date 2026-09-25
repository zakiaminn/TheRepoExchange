"""the repo pricing formula, the python copy of ledger/pricing.js. both are tested
against the same cases in pricing/fixtures.json. raw numbers in, a price out, no
network, no database.
"""

import math
from datetime import datetime

# weights are in dollars.
W_STAR = 0.001
W_FORK = 0.01
W_WATCH = 0.05
W_PR = 1.00
W_ISSUE = 1.00

ISSUE_DRAG_CAP = 0.60   # issue drag can remove at most 60% of gross
BASE_LISTING = 5.00     # every listing starts here
PRICE_FLOOR = 1.00      # marks never price below this


def recency_multiplier(pushed_at_iso, now=None):
    """multiplier in [0.70, 1.00] from whole days since the last push. days is floored
    so it matches recencyMultiplier() in ledger/pricing.js."""
    if not pushed_at_iso:
        return 1.0
    try:
        pushed = datetime.strptime(pushed_at_iso, "%Y-%m-%dT%H:%M:%SZ")
    except (ValueError, TypeError):
        return 1.0
    if now is None:
        now = datetime.utcnow()
    days = (now - pushed).days   # whole days
    if days <= 30:
        return 1.0
    if days >= 365:
        return 0.70
    return 1.0 - 0.30 * (days - 30) / (365 - 30)


def _round_half_up(x):
    """round to the cent, half away from zero, to match js Math.round(x*100)/100 for
    the non-negative prices we deal with. python's built-in round() is banker's
    rounding, which would disagree with the ledger on exact half-cents."""
    return math.floor(x * 100 + 0.5) / 100


def compute_price(stars, forks, watchers, open_issues, open_prs, pushed_at, now=None):
    """a repo's price from its raw metrics. watchers and open_prs can be None (the
    search endpoint omits them), in which case they're estimated and the hourly
    refresh corrects them. `now` is injectable so the fixtures are deterministic."""
    stars = stars or 0
    forks = forks or 0
    open_issues = open_issues or 0

    if watchers is None:
        watchers = stars * 0.03
    if open_prs is None:
        est_prs = open_issues * 0.15
        open_prs = est_prs
        open_issues = max(0.0, open_issues - est_prs)

    gross = (BASE_LISTING
             + stars * W_STAR
             + forks * W_FORK
             + watchers * W_WATCH
             + open_prs * W_PR)
    debt = min(open_issues * W_ISSUE, ISSUE_DRAG_CAP * gross)
    price = (gross - debt) * recency_multiplier(pushed_at, now)
    return _round_half_up(max(PRICE_FLOOR, price))
