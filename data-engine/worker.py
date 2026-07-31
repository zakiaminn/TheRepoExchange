import os
import sys
import time
import logging
import requests
import random
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
                        # price is just stars / 100, simple as that. one star = one cent
                        current_price = raw_stars / 100.0
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
        description = item.get("description", "")

        # descriptions can get pretty long, cap it so it doesn't blow up the ui or the db column
        if description and len(description) > 500:
            description = description[:497] + "..."

        current_price = raw_stars / 100.0
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
