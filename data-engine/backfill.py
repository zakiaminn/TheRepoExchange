"""one-off backfill after the switch to PRICING-2. it works everything out and prints a report,
and only writes to the database with --apply.

  prices     the old prices from 27 aug 16:00 utc (when the previous formula came in) up to the
             switch. stray readings written by a second, older copy of the worker are dropped,
             each day's remaining prices are reduced to their median, and that is scaled by the
             listing's own price change at the switch. a listing whose old prices swung back and
             forth (the old formula counted each open pr at a full dollar, so a small repo moved
             with every batch of prs) gets no older history, since one ratio can't translate it
  positions  open positions' entry prices, scaled through every switch since each trade, so a
             formula change doesn't read as a gain or a loss. a position whose stored entry price
             no longer matches its trades (already rebased) is left alone
"""

import math
import os
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_batch

from pricing import PRICING_VERSION

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

ADJUSTED_VERSION = f"{PRICING_VERSION}-adjusted"

# the previous formula came in for every listing in the same worker pass
FORMULA_SWITCH = datetime(2026, 8, 27, 16, 0, tzinfo=timezone.utc)

JUMP = 0.08                        # a move this big (log terms) between readings may start a stray run
RETURN = 0.03                      # a stray run ends when the price is back within this of where it left
STRAY_WINDOW = timedelta(hours=6)  # how long a stray run can last
LEVEL_READINGS = 3                 # readings either side of a switch that set the price level there
LEVEL_REACH = timedelta(hours=24)  # how far from a switch those readings can be (the worker had gaps)
ZIGZAG = 0.15                      # a daily move this big, reversed the next day, marks a pr-driven series


def log_move(a, b):
    return abs(math.log(a / b)) if a > 0 and b > 0 else float("inf")


def drop_strays(points):
    """removes runs of readings that jump away from a listing's series and come back within six
    hours. those came from a second copy of the worker running older code at the same time, so
    one listing alternated between two formulas. a jump that doesn't come back is a real move
    and stays. the series is anchored on the median of its first six hours, so it can't start on
    a stray."""
    if not points:
        return []
    first = [p for t, p in points if t - points[0][0] <= STRAY_WINDOW]
    anchor = statistics.median(first)
    start = next((i for i, (_, p) in enumerate(points) if log_move(p, anchor) < RETURN or p == anchor), 0)

    kept = [points[start]]
    i, n = start + 1, len(points)
    while i < n:
        t, p = points[i]
        base = kept[-1][1]
        if log_move(p, base) > JUMP:
            j, back = i, None
            while j < n and points[j][0] - t <= STRAY_WINDOW:
                if log_move(points[j][1], base) < RETURN:
                    back = j
                    break
                j += 1
            if back is not None:
                i = back
                continue
            if j >= n:
                # the series ends inside the window without coming back, so it can't be confirmed
                break
        kept.append((t, p))
        i += 1
    return kept


def level_before(points, when):
    """the median of the last few readings before `when`, within a day of it, or None."""
    prices = [p for t, p in points if when - LEVEL_REACH <= t < when][-LEVEL_READINGS:]
    return statistics.median(prices) if prices else None


def level_after(points, when):
    """the median of the first few readings at or after `when`, within a day of it, or None."""
    prices = [p for t, p in points if when <= t < when + LEVEL_REACH][:LEVEL_READINGS]
    return statistics.median(prices) if prices else None


def daily_medians(points, start, end):
    """one reading per utc day in [start, end): the median price, stamped at the day's last reading."""
    days = defaultdict(list)
    for t, p in points:
        if start <= t < end:
            days[t.astimezone(timezone.utc).date()].append((t, p))
    return [(days[d][-1][0], statistics.median(p for _, p in days[d])) for d in sorted(days)]


def swings(days):
    """true if the daily series moves more than ZIGZAG and then back the other way."""
    moves = [math.log(b / a) for (_, a), (_, b) in zip(days, days[1:]) if a > 0 and b > 0]
    return any(abs(m1) > ZIGZAG and abs(m2) > ZIGZAG and m1 * m2 < 0 for m1, m2 in zip(moves, moves[1:]))


def load_series(cur, since=None, tickers=None):
    """old-formula readings per ticker, oldest first."""
    sql = "SELECT ticker, created_at, price FROM price_history WHERE pricing_version IS NULL"
    args = []
    if since is not None:
        sql += " AND created_at >= %s"
        args.append(since)
    if tickers is not None:
        sql += " AND ticker = ANY(%s)"
        args.append(list(tickers))
    cur.execute(sql + " ORDER BY ticker, created_at", args)
    series = defaultdict(list)
    for ticker, at, price in cur.fetchall():
        series[ticker].append((at, float(price)))
    return series


def plan_prices(cur):
    """the adjusted daily history and each listing's price change at the switch."""
    cur.execute(
        """SELECT DISTINCT ON (ticker) ticker, created_at, price FROM price_history
           WHERE pricing_version = %s ORDER BY ticker, created_at""",
        (PRICING_VERSION,),
    )
    first_new = {t: (at, float(p)) for t, at, p in cur.fetchall()}
    series = load_series(cur, since=FORMULA_SWITCH)

    adjustments, rows, report = {}, [], []
    for ticker, (switched_at, new_price) in sorted(first_new.items()):
        old = [(t, p) for t, p in series.get(ticker, []) if t < switched_at]
        kept = drop_strays(old)
        old_price = level_before(kept, switched_at)
        if old_price is None:
            continue
        ratio = new_price / old_price
        adjustments[ticker] = (switched_at, old_price, new_price, ratio)
        days = daily_medians(kept, FORMULA_SWITCH, switched_at)
        skipped = swings(days)
        if not skipped:
            rows += [(ticker, round(p * ratio, 2), at) for at, p in days]
        report.append((ticker, len(old), len(old) - len(kept), 0 if skipped else len(days), old_price, new_price, ratio))
    return adjustments, rows, report


def switch_ratio(points):
    """a listing's price change at FORMULA_SWITCH, from its cleaned full history, or None."""
    kept = drop_strays(points)
    before = level_before(kept, FORMULA_SWITCH)
    after = level_after(kept, FORMULA_SWITCH)
    return after / before if before and after else None


def plan_positions(cur, adjustments):
    """new entry prices for open positions, replayed from their trades with each buy scaled by
    every switch after it."""
    cur.execute("SELECT id, user_id, ticker, shares, average_price FROM portfolios WHERE shares > 0")
    positions = cur.fetchall()
    early = set()
    trades = {}
    for pid, user, ticker, _, _ in positions:
        cur.execute(
            """SELECT action, shares, execution_price, created_at FROM transactions
               WHERE user_id = %s AND ticker = %s ORDER BY created_at""",
            (user, ticker),
        )
        trades[pid] = cur.fetchall()
        if any(at < FORMULA_SWITCH for _, _, _, at in trades[pid]):
            early.add(ticker)
    full = load_series(cur, tickers=early) if early else {}
    first_ratio = {t: switch_ratio(full.get(t, [])) for t in early}

    updates, report = [], []
    for pid, user, ticker, shares, avg in positions:
        adj = adjustments.get(ticker)
        held, plain, scaled, note = 0, 0.0, 0.0, None
        for action, qty, px, at in trades[pid]:
            px = float(px)
            if action == "SELL":
                held -= qty
                continue
            if adj and at >= adj[0]:
                factor = 1.0
            elif adj and at >= FORMULA_SWITCH:
                factor = adj[3]
            elif adj and first_ratio.get(ticker):
                factor = first_ratio[ticker] * adj[3]
            else:
                factor, note = None, "no ratio for this trade's formula"
                break
            total = held + qty
            plain = (held * plain + qty * px) / total
            scaled = (held * scaled + qty * px * factor) / total
            held = total
        if note is None and (held != shares or abs(round(plain, 2) - float(avg)) > 0.02):
            note = "entry price doesn't match its trades (already rebased?)"
        new_avg = round(scaled, 2) if note is None else None
        report.append((ticker, shares, float(avg), new_avg, note))
        if new_avg is not None and abs(new_avg - float(avg)) >= 0.01:
            updates.append((new_avg, pid))
    return updates, report


def main():
    apply = "--apply" in sys.argv
    jobs = [j for j in ("prices", "positions") if f"--{j}" in sys.argv] or ["prices", "positions"]
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    adjustments, price_rows, price_report = plan_prices(cur)
    if "prices" in jobs:
        print(f"prices: {len(adjustments)} listings, {len(price_rows)} daily points from {FORMULA_SWITCH:%d %b}")
        for t, n, dropped, days, old, new, ratio in price_report:
            print(f"  {t:45} {n:6} readings, {dropped:4} strays, {days:3} days, {old:10.2f} -> {new:10.2f}  x{ratio:.4f}")

    if "positions" in jobs:
        pos_updates, pos_report = plan_positions(cur, adjustments)
        print(f"positions: {len(pos_updates)} to rebase")
        for t, shares, avg, new_avg, note in pos_report:
            print(f"  {t:45} {shares:5} shares  entry {avg:10.2f} -> {new_avg if new_avg is not None else '-':>10}  {note or ''}")

    if not apply:
        print("\nreport only. nothing written.")
        return

    if "prices" in jobs:
        cur.execute("DELETE FROM price_history WHERE pricing_version = %s", (ADJUSTED_VERSION,))
        execute_batch(
            cur,
            "INSERT INTO price_history (ticker, price, pricing_version, created_at) VALUES (%s, %s, %s, %s)",
            [(t, p, ADJUSTED_VERSION, at) for t, p, at in price_rows],
        )
        execute_batch(
            cur,
            """INSERT INTO price_adjustments (ticker, switched_at, to_version, old_price, new_price, ratio)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (ticker, switched_at) DO UPDATE SET
                 old_price = EXCLUDED.old_price, new_price = EXCLUDED.new_price, ratio = EXCLUDED.ratio""",
            [(t, at, PRICING_VERSION, round(o, 2), round(n, 2), r) for t, (at, o, n, r) in adjustments.items()],
        )
    if "positions" in jobs:
        execute_batch(cur, "UPDATE portfolios SET average_price = %s WHERE id = %s", pos_updates)
    conn.commit()
    conn.close()
    print("\nwritten.")


if __name__ == "__main__":
    main()
