import os
import sys
import time
import logging
import requests
import re
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from pricing import compute_price

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

# these are literally just github search queries. each key becomes a category on the
# board, and a new key shows up as a new category with no other code changes
CATEGORIES = {
    "AI & Machine Learning": "topic:machine-learning stars:>10000",
    "Blue Chip Systems": "language:rust language:c++ stars:>20000",
    "Web Frameworks": "language:typescript language:javascript stars:>30000",
    "Hot IPOs (Last 30 Days)": f"created:>{thirty_days_ago} stars:>500"
}

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"

# the pricing formula is in pricing.py. this module only fetches the raw metrics and
# hands them to compute_price


def get_open_pr_count(ticker, headers):
    """how many open prs a repo has, in a single call. little trick: ask for 1 pr per
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
            return int(m.group(1))     # several pages -> last page number == pr count
        return len(resp.json())        # 0 or 1 open prs (no Link header)
    except requests.exceptions.RequestException:
        return None


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
        "User-Agent": "Quantitative-Exchange-Worker" # names the worker in github's request logs
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
            # got rate limited. github tells us exactly how long to wait via this header
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
        # network blip, timeout, dns failure, whatever. just log it and move on with an
        # empty list so one bad category doesn't kill the whole run
        logger.error(f"Failed to fetch repositories for {category_name}: {e}")
        return []

def update_known_assets(conn) -> set:
    """phase 1: go through every repo we already know about and refresh its star count / price."""
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
                "User-Agent": "Quantitative-Exchange-Worker" # names the worker in github's request logs
            }
            if GITHUB_TOKEN:
                headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

            # loop over every ticker we already have and hit github's single-repo endpoint
            # for each one individually. it's a lot of requests, which is what the
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
                        oi_total = data.get("open_issues_count", 0)   # open issues + open prs
                        pushed_at = data.get("pushed_at")
                        # grab the real open-pr count and pull it out of open_issues_count,
                        # since github lumps issues and prs together in that number
                        open_prs = get_open_pr_count(ticker, headers)
                        if open_prs is None:
                            open_prs = int(round(oi_total * 0.15))   # call failed, just estimate
                        open_issues = max(0, oi_total - open_prs)
                        current_price = compute_price(raw_stars, forks, watchers, open_issues, open_prs, pushed_at)
                        current_time = datetime.now()
                        # priced_at anchors the recency term to the instant this mark was
                        # struck, so the asset page can reproduce it instead of guessing.
                        priced_at = datetime.now(timezone.utc)

                        # update the live price on the repo's row
                        update_query = """
                            UPDATE repositories SET
                                current_price = %s,
                                raw_stars = %s,
                                raw_forks = %s,
                                raw_watchers = %s,
                                raw_open_issues = %s,
                                raw_open_prs = %s,
                                pushed_at = %s,
                                priced_at = %s,
                                is_active = TRUE
                            WHERE ticker = %s;
                        """
                        cursor.execute(update_query, (current_price, raw_stars, forks, watchers, open_issues, open_prs, pushed_at, priced_at, ticker))

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

                # pause between repos to stay under github's rate limit
                time.sleep(1)

            conn.commit()
            logger.info("Phase 1 complete.")
    except Exception as e:
        # something in the db blew up, roll back so we don't leave a half-finished transaction hanging
        conn.rollback()
        logger.error(f"Database error during Phase 1: {e}")

    return known_tickers

def process_and_upsert_new_repositories(category_name: str, items: list, known_tickers: set, conn):
    """phase 2: only deals with repos we haven't seen before."""
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
        oi_total = item.get("open_issues_count", 0)   # open issues + open prs
        pushed_at = item.get("pushed_at")
        description = item.get("description", "")

        # descriptions can get pretty long, cap it so it doesn't blow up the ui or the db column
        if description and len(description) > 500:
            description = description[:497] + "..."

        # search results don't give watchers or split issues vs prs, so estimate them.
        # phase 1 comes back within the hour and overwrites them with the real numbers
        est_watchers = int(round(raw_stars * 0.03))
        est_prs = int(round(oi_total * 0.15))
        est_issues = max(0, oi_total - est_prs)
        current_price = compute_price(raw_stars, forks, est_watchers, est_issues, est_prs, pushed_at)
        priced_at = datetime.now(timezone.utc)
        records.append((ticker, current_price, description, category_name, raw_stars, forks, est_watchers, est_issues, est_prs, pushed_at, priced_at))

    if not records:
        logger.info(f"No new records to insert for category {category_name}.")
        return

    # upsert instead of insert because the same repo can technically show up in multiple
    # category searches in the same run, so we might try to add it twice
    upsert_query = """
        INSERT INTO repositories (ticker, current_price, description, category, raw_stars,
                                  raw_forks, raw_watchers, raw_open_issues, raw_open_prs, pushed_at, priced_at, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
        ON CONFLICT (ticker)
        DO UPDATE SET
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            raw_stars = EXCLUDED.raw_stars,
            raw_forks = EXCLUDED.raw_forks,
            raw_watchers = EXCLUDED.raw_watchers,
            raw_open_issues = EXCLUDED.raw_open_issues,
            raw_open_prs = EXCLUDED.raw_open_prs,
            current_price = EXCLUDED.current_price,
            pushed_at = EXCLUDED.pushed_at,
            priced_at = EXCLUDED.priced_at,
            is_active = TRUE;
    """

    try:
        with conn.cursor() as cursor:
            # execute_batch just sends all the records in one go instead of round-tripping
            # to the db for each one, way faster for a bunch of inserts
            execute_batch(cursor, upsert_query, records)

            history_records = []
            current_time = datetime.now()

            for rec in records:
                ticker, current_price = rec[0], rec[1]
                known_tickers.add(ticker) # so we don't double count it if it shows up again this run

                # seed a single point at the price we just computed. a new listing has one
                # data point until the worker polls it again, and the chart fills in from
                # there
                history_records.append((ticker, current_price, current_time))

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
    """kicks off the whole pipeline: refresh known repos, then scout for new ones."""
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
            # pause between categories to stay under github's rate limit
            time.sleep(2)
    finally:
        # always close the connection, even if we blew up somewhere above
        if conn:
            conn.close()
            logger.info("Database connection closed.")

    logger.info("GitHub ingestion pipeline completed.")

if __name__ == "__main__":
    logger.info("Starting single-execution ingestion cycle.")
    # this runs forever as a long-lived process: one pipeline run, then an hour's sleep.
    # the ingestion github actions workflow also runs this file on an hourly cron
    while True:
        try:
            run_ingestion_pipeline()
            logger.info("Cycle complete. Sleeping for 1 hour...")
            time.sleep(3600)

        except Exception as e:
            # catch literally anything so one bad cycle doesn't kill the whole worker.
            # log it, wait 5 minutes, then go around the loop and try again
            logger.critical(f"Unhandled exception in ingestion pipeline: {e}")
            logger.info("Sleeping for 5 minutes before retry...")
            time.sleep(300)
