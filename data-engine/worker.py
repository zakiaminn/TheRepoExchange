import os
import sys
import time
import logging
import requests
import random
import re
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from datetime import datetime, timedelta

# basic logging setup so we get timestamps and log levels instead of just print statements everywhere
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# pulls in whatever's in the .env file (DATABASE_URL, GITHUB_TOKEN) when running locally.
# on render/github actions these get set as real env vars instead, but load_dotenv() just
# no-ops if there's no .env file so it's safe either way
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")

# we only care about repos created in the last 30 days for the "hot ipos" category
thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

# these are literally just github search queries. each one defines a "shelf" on the
# discovery page on the frontend. add a new key here and it shows up as a new category,
# no other code needs to change
CATEGORIES = {
    "AI & Machine Learning": "topic:machine-learning stars:>10000",
    "Blue Chip Systems": "language:rust language:c++ stars:>20000",
    "Web Frameworks": "language:typescript language:javascript stars:>30000",
    "Hot IPOs (Last 30 Days)": f"created:>{thirty_days_ago} stars:>500"
}

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"

# ── how we price a repo ──
# old way was just stars/100 which is kinda dumb, a repo isn't worth money just
# because people clicked a star button. so this actually looks at whether the thing
# is alive:
#   - stars = popularity but cheap, there's a ton of them so each one is basically nothing
#   - forks + watchers = people actually building on it / following it, worth more
#   - open PRs = someone's literally contributing right now, worth a dollar each
#   - open issues = unfinished stuff / bugs, drags the price down a dollar each
#   - if nobody's pushed to it in forever it slowly loses value
#
# the weights are all in dollars and you can just change them, nothing else cares
# about the exact numbers. compute_price() is the only place the price gets decided.

W_STAR  = 0.001   # a star is like 0.1 cents, basically nothing on its own
W_FORK  = 0.01    # a fork's worth about 10 stars, someone actually copied the thing
W_WATCH = 0.05    # watchers are rarer than stars so they count for a bit more
W_PR    = 1.00    # open pull request = a dollar (someone's contributing rn)
W_ISSUE = 1.00    # open issue = minus a dollar (unfinished / a bug)

ISSUE_DRAG_CAP = 0.60  # issues can only knock off max 60% of the value, not more
BASE_LISTING   = 5.00  # every repo starts at 5 bucks so nothing's under a dollar
PRICE_FLOOR    = 1.00  # never go below this


def _recency_multiplier(pushed_at_iso):
    """if a repo got pushed to recently it's alive so full price (1.0). old dead ones
    slowly decay down to 0.7, never lower just from being old."""
    if not pushed_at_iso:
        return 1.0
    try:
        pushed = datetime.strptime(pushed_at_iso, "%Y-%m-%dT%H:%M:%SZ")
    except (ValueError, TypeError):
        return 1.0
    days = (datetime.utcnow() - pushed).days
    if days <= 30:
        return 1.0
    if days >= 365:
        return 0.70
    return 1.0 - 0.30 * (days - 30) / (365 - 30)


def get_open_pr_count(ticker, headers):
    """how many open PRs a repo has, in a single call. little trick: ask for 1 PR per
    page and just read the last page number out of the Link header, so we don't have to
    actually page through all of them. returns None if it breaks and we guess instead."""
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{ticker}/pulls",
            headers=headers, params={"state": "open", "per_page": 1}, timeout=10,
        )
        if resp.status_code != 200:
            return None
        link = resp.headers.get("Link", "")
        m = re.search(r'[?&]page=(\d+)>;\s*rel="last"', link)
        if m:
            return int(m.group(1))     # several pages -> last page number == PR count
        return len(resp.json())        # 0 or 1 open PRs (no Link header)
    except requests.exceptions.RequestException:
        return None


def compute_price(stars, forks, watchers, open_issues, open_prs, pushed_at):
    """the one spot a repo's price actually gets worked out. everything's just raw
    numbers from github. watchers and open_prs can come in as None (the search endpoint
    doesn't give them) so we guess and the hourly refresh fixes it later. heads up: when
    open_prs is None, open_issues is really open_issues_count (issues AND prs together)."""
    stars = stars or 0
    forks = forks or 0
    open_issues = open_issues or 0

    if watchers is None:
        watchers = stars * 0.03              # most repos have way fewer watchers than stars, rough guess
    if open_prs is None:
        est_prs = open_issues * 0.15         # ~15% of the "open issues" are actually PRs hiding in there
        open_prs = est_prs
        open_issues = max(0.0, open_issues - est_prs)

    gross = (BASE_LISTING
             + stars * W_STAR
             + forks * W_FORK
             + watchers * W_WATCH
             + open_prs * W_PR)

    # cap the drag so a giant repo with like 9000 open issues doesn't go negative
    debt = min(open_issues * W_ISSUE, ISSUE_DRAG_CAP * gross)
    price = (gross - debt) * _recency_multiplier(pushed_at)
    return round(max(PRICE_FLOOR, price), 2)

def get_db_connection():
    """connect to postgres and hand back the connection."""
    if not DATABASE_URL:
        # fail loud and early instead of letting psycopg2 throw some cryptic connection error later
        raise ValueError("DATABASE_URL environment variable is not set.")
    return psycopg2.connect(DATABASE_URL)

def fetch_repositories_for_category(category_name: str, query: str, _retry_count: int = 0, _max_retries: int = 3) -> list:
    """grab the top 10 repos from github for whatever category we're looking at."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Quantitative-Exchange-Worker" # don't touch this, it's for debugging
    }
    if GITHUB_TOKEN:
        # authed requests get 5000 requests/hr instead of 60, so this matters a lot
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    else:
        logger.warning("GITHUB_TOKEN is not set. API rate limits will be strictly limited.")

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": 10 # just the top 10, keeps us under rate limits
    }

    try:
        response = requests.get(GITHUB_SEARCH_URL, headers=headers, params=params, timeout=10)

        if response.status_code == 429:
            # got rate limited. github tells us exactly how long to chill for via this header
            if _retry_count >= _max_retries:
                logger.error(f"Rate limit exceeded {_max_retries} times for {category_name}. Giving up.")
                return []
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.warning(f"Rate limit exceeded (HTTP 429). Retry {_retry_count + 1}/{_max_retries} after {retry_after}s.")
            time.sleep(retry_after)
            # recurse with the retry count bumped up, this bails out after _max_retries tries
            return fetch_repositories_for_category(category_name, query, _retry_count + 1, _max_retries)

        # blow up on anything else that isn't a 2xx, gets caught below
        response.raise_for_status()
        data = response.json()
        return data.get("items", [])

    except requests.exceptions.RequestException as e:
        # network blip, timeout, dns failure, whatever - just log it and move on with an
        # empty list so one bad category doesn't kill the whole run
        logger.error(f"Failed to fetch repositories for {category_name}: {e}")
        return []

def update_known_assets(conn) -> set:
    """phase 1 - go through every repo we already know about and refresh its star count / price."""
    logger.info("Phase 1: Updating known assets.")
    known_tickers = set() # we hand this back so phase 2 knows what to skip

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT ticker FROM repositories")
            rows = cursor.fetchall()

            if not rows:
                logger.info("No known assets found in database.")
                return known_tickers

            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Quantitative-Exchange-Worker" # don't touch this, it's for debugging
            }
            if GITHUB_TOKEN:
                headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

            # loop over every ticker we already have and hit github's single-repo endpoint
            # for each one individually. yeah it's a lot of requests, that's what the
            # sleep(1) at the bottom of the loop is for
            for row in rows:
                ticker = row[0]
                known_tickers.add(ticker)

                url = f"https://api.github.com/repos/{ticker}"

                max_retries = 3
                retry_count = 0
                while True: # keep retrying this one repo until it works, 404s, or we give up
                    try:
                        response = requests.get(url, headers=headers, timeout=10)

                        if response.status_code == 429:
                            retry_count += 1
                            if retry_count > max_retries:
                                logger.error(f"Rate limit exceeded {max_retries} times for {ticker}. Skipping.")
                                break
                            retry_after = int(response.headers.get("Retry-After", 60))
                            logger.warning(f"Rate limit for {ticker}. Retry {retry_count}/{max_retries} after {retry_after}s.")
                            time.sleep(retry_after)
                            continue # go around the while loop again and retry this same repo

                        if response.status_code == 404:
                            # repo got deleted or renamed, just mark it inactive
                            # (we don't delete the row, keeps the history around)
                            logger.warning(f"Repository {ticker} not found (404). Marking as inactive.")
                            cursor.execute("UPDATE repositories SET is_active = FALSE WHERE ticker = %s", (ticker,))
                            break

                        response.raise_for_status()
                        data = response.json()

                        raw_stars = data.get("stargazers_count", 0)
                        forks = data.get("forks_count", 0)
                        watchers = data.get("subscribers_count", 0)
                        oi_total = data.get("open_issues_count", 0)   # open issues + open PRs
                        pushed_at = data.get("pushed_at")
                        # grab the real open-PR count and pull it out of open_issues_count,
                        # since github lumps issues and PRs together in that number
                        open_prs = get_open_pr_count(ticker, headers)
                        if open_prs is None:
                            current_price = compute_price(raw_stars, forks, watchers, oi_total, None, pushed_at)
                        else:
                            open_issues = max(0, oi_total - open_prs)
                            current_price = compute_price(raw_stars, forks, watchers, open_issues, open_prs, pushed_at)
                        current_time = datetime.now()

                        # update the live price on the repo's row
                        update_query = """
                            UPDATE repositories SET
                                current_price = %s,
                                raw_stars = %s,
                                is_active = TRUE
                            WHERE ticker = %s;
                        """
                        cursor.execute(update_query, (current_price, raw_stars, ticker))

                        # and drop a new point into the price history so the chart on the
                        # frontend has something fresh to show
                        history_query = """
                            INSERT INTO price_history (ticker, price, created_at)
                            VALUES (%s, %s, %s)
                        """
                        cursor.execute(history_query, (ticker, current_price, current_time))

                        logger.info(f"Updated known asset {ticker} (Stars: {raw_stars}).")
                        break # done with this repo, move to the next one

                    except requests.exceptions.RequestException as e:
                        logger.error(f"Failed to fetch repo {ticker}: {e}")
                        break

                # sleep a bit so github doesn't yell at me
                time.sleep(1)

            conn.commit()
            logger.info("Phase 1 complete.")
    except Exception as e:
        # something in the db blew up, roll back so we don't leave a half-finished transaction hanging
        conn.rollback()
        logger.error(f"Database error during Phase 1: {e}")

    return known_tickers

def process_and_upsert_new_repositories(category_name: str, items: list, known_tickers: set, conn):
    """phase 2 - only deals with repos we haven't seen before."""
    records = [] # gonna batch all the new repos into one insert instead of doing them one by one

    for item in items:
        owner = item.get("owner", {}).get("login", "")
        name = item.get("name", "")
        ticker = f"{owner}/{name}"

        # already tracking this one, skip it. phase 1 already refreshed its price
        if ticker in known_tickers:
            continue

        raw_stars = item.get("stargazers_count", 0)
        forks = item.get("forks_count", 0)
        oi_total = item.get("open_issues_count", 0)   # open issues + open PRs
        pushed_at = item.get("pushed_at")
        description = item.get("description", "")

        # descriptions can get pretty long, cap it so it doesn't blow up the ui or the db column
        if description and len(description) > 500:
            description = description[:497] + "..."

        # search results don't give watchers or split issues vs PRs, so compute_price
        # just guesses. phase 1 comes back within the hour and fixes it with real numbers
        current_price = compute_price(raw_stars, forks, None, oi_total, None, pushed_at)
        records.append((ticker, current_price, description, category_name, raw_stars))

    if not records:
        logger.info(f"No new records to insert for category {category_name}.")
        return

    # upsert instead of insert because the same repo can technically show up in multiple
    # category searches in the same run, so we might try to add it twice
    upsert_query = """
        INSERT INTO repositories (ticker, current_price, description, category, raw_stars, is_active)
        VALUES (%s, %s, %s, %s, %s, TRUE)
        ON CONFLICT (ticker)
        DO UPDATE SET
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            raw_stars = EXCLUDED.raw_stars,
            current_price = EXCLUDED.current_price,
            is_active = TRUE;
    """

    try:
        with conn.cursor() as cursor:
            # execute_batch just sends all the records in one go instead of round-tripping
            # to the db for each one, way faster for a bunch of inserts
            execute_batch(cursor, upsert_query, records)

            history_records = []
            current_time = datetime.now()

            for ticker, current_price, _, _, _ in records:
                known_tickers.add(ticker) # so we don't double count it if it shows up again this run

                history_records.append((ticker, current_price, current_time))

                # fake some history so the charts don't look empty on day one. we pick a
                # starting price a little below the current one and draw a straight line
                # up to today over 30 fake days. it's not real data, it's just so new
                # listings don't show up as a single dot on the chart
                start_price = current_price * random.uniform(0.90, 0.95)
                price_step = (current_price - start_price) / 30.0

                for i in range(30, 0, -1):
                    historical_price = start_price + (price_step * (30 - i))
                    historical_time = current_time - timedelta(days=i)
                    history_records.append((ticker, historical_price, historical_time))

            history_query = """
                INSERT INTO price_history (ticker, price, created_at)
                VALUES (%s, %s, %s)
            """
            execute_batch(cursor, history_query, history_records)

        conn.commit()
        logger.info(f"Successfully processed and backfilled {len(records)} NEW repositories for {category_name}.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error during Phase 2 upsert for {category_name}: {e}")

def run_ingestion_pipeline():
    """kicks off the whole pipeline - refresh known repos, then scout for new ones."""
    logger.info("Starting GitHub ingestion pipeline.")

    try:
        conn = get_db_connection()
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        raise # no point continuing if we can't even connect, let the caller deal with it

    try:
        # phase 1 first so known_tickers is populated before phase 2 checks against it
        known_tickers = update_known_assets(conn)

        # now go find new stuff
        logger.info("Phase 2: Scouting for new trending assets.")
        for category_name, query in CATEGORIES.items():
            logger.info(f"Scouting category: {category_name}")
            items = fetch_repositories_for_category(category_name, query)
            if items:
                process_and_upsert_new_repositories(category_name, items, known_tickers, conn)
            # sleep a bit so github doesn't yell at me
            time.sleep(2)
    finally:
        # always close the connection, even if we blew up somewhere above
        if conn:
            conn.close()
            logger.info("Database connection closed.")

    logger.info("GitHub ingestion pipeline completed.")

if __name__ == "__main__":
    logger.info("Starting single-execution ingestion cycle.")
    # this thing just runs forever. it's meant to be a long-lived process (deployed as a
    # render worker), not a script that runs once and exits. there's also a github actions
    # cron job that runs this same file once an hour as a backup in case the worker process
    # ever goes down for some reason
    while True:
        try:
            run_ingestion_pipeline()
            logger.info("Cycle complete. Sleeping for 1 hour...")
            time.sleep(3600)

        except Exception as e:
            # catch literally anything so one bad cycle doesn't kill the whole worker.
            # log it, chill for 5 min, then go around the loop and try again
            logger.critical(f"Unhandled exception in ingestion pipeline: {e}")
            logger.info("Sleeping for 5 minutes before retry...")
            time.sleep(300)
