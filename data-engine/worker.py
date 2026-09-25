import os
import sys
import time
import random
import logging
import requests
import re
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from pricing import compute_price, PRICING_VERSION

# basic logging setup so we get timestamps and log levels instead of just print statements everywhere
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# pulls in whatever's in the .env file (DATABASE_URL, GITHUB_TOKEN) when running locally.
# on github actions these get set as real env vars instead, but load_dotenv() just
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
MAX_ATTEMPTS = 5
MAX_WAIT_SECONDS = 300

# the pricing formula is in pricing.py. this module only fetches the raw metrics and
# hands them to compute_price


def github_headers():
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Quantitative-Exchange-Worker"  # names the worker in github's request logs
    }
    if GITHUB_TOKEN:
        # authed requests get 5000 requests/hr instead of 60, so this matters a lot
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def backoff_seconds(response, attempt):
    """how long to wait before retrying a rate-limited or failed github request. github's
    own Retry-After or rate-limit reset wins when it sends one, otherwise the wait doubles
    each attempt (2s, 4s, 8s, 16s) with a little jitter. capped at five minutes."""
    if response is not None:
        retry_after = response.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            return min(int(retry_after), MAX_WAIT_SECONDS)
        if response.headers.get("X-RateLimit-Remaining") == "0":
            reset = response.headers.get("X-RateLimit-Reset")
            if reset and reset.isdigit():
                return min(max(1, int(reset) - int(time.time()) + 1), MAX_WAIT_SECONDS)
    return min(2 ** (attempt + 1) + random.uniform(0, 1), MAX_WAIT_SECONDS)


def is_rate_limited(response):
    """github answers a rate limit with 429, or with 403 plus a zeroed remaining count or a
    Retry-After header (the secondary limits)."""
    if response.status_code == 429:
        return True
    if response.status_code == 403:
        return (response.headers.get("X-RateLimit-Remaining") == "0"
                or "Retry-After" in response.headers)
    return False


def github_get(url, params=None):
    """a github GET with exponential backoff on rate limits, server errors, and network
    blips. returns the final response, or None if every attempt failed to connect."""
    response = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = requests.get(url, headers=github_headers(), params=params, timeout=10)
        except requests.exceptions.RequestException as e:
            response = None
            logger.warning(f"GitHub request failed ({e}). Attempt {attempt + 1}/{MAX_ATTEMPTS}.")
        else:
            if not (is_rate_limited(response) or response.status_code >= 500):
                return response
            logger.warning(f"GitHub returned {response.status_code} for {url}. Attempt {attempt + 1}/{MAX_ATTEMPTS}.")
        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(backoff_seconds(response, attempt))
    return response


def get_open_pr_count(ticker):
    """how many open prs a repo has, in a single call. little trick: ask for 1 pr per
    page and just read the last page number out of the Link header, so we don't have to
    actually page through all of them. a repo with pull requests turned off answers 404,
    which counts as none open. returns None if it breaks."""
    resp = github_get(f"https://api.github.com/repos/{ticker}/pulls", {"state": "open", "per_page": 1})
    if resp is not None and resp.status_code == 404:
        return 0
    if resp is None or resp.status_code != 200:
        return None
    link = resp.headers.get("Link", "")
    m = re.search(r'[?&]page=(\d+)>;\s*rel="last"', link)
    if m:
        return int(m.group(1))     # several pages -> last page number == pr count
    return len(resp.json())        # 0 or 1 open prs (no Link header)


def fetch_repo_metrics(ticker):
    """everything the price needs for one repo, from the single-repo endpoint plus the open
    pr count. returns a dict, "missing" if the repo is gone or private, or None if github
    couldn't be reached."""
    resp = github_get(f"https://api.github.com/repos/{ticker}")
    if resp is None:
        return None
    if resp.status_code == 404:
        return "missing"
    if resp.status_code != 200:
        logger.error(f"GitHub returned {resp.status_code} for {ticker}.")
        return None
    data = resp.json()
    if data.get("private"):
        return "missing"

    open_prs = get_open_pr_count(ticker)
    if open_prs is None:
        return None
    oi_total = data.get("open_issues_count", 0)   # open issues + open prs

    description = data.get("description") or ""
    # descriptions can get pretty long, cap it so it doesn't blow up the ui or the db column
    if len(description) > 500:
        description = description[:497] + "..."

    return {
        "stars": data.get("stargazers_count", 0),
        "forks": data.get("forks_count", 0),
        "watchers": data.get("subscribers_count", 0),
        "open_prs": open_prs,
        # github lumps issues and prs together in open_issues_count, so the prs come out
        "open_issues": max(0, oi_total - open_prs),
        "pushed_at": data.get("pushed_at"),
        "description": description,
    }


def price_of(m):
    return compute_price(m["stars"], m["forks"], m["watchers"], m["open_issues"], m["open_prs"], m["pushed_at"])


def get_db_connection():
    """connect to postgres and hand back the connection."""
    if not DATABASE_URL:
        # fail loud and early instead of letting psycopg2 throw some cryptic connection error later
        raise ValueError("DATABASE_URL environment variable is not set.")
    return psycopg2.connect(DATABASE_URL)


def fetch_repositories_for_category(category_name: str, query: str) -> list:
    """grab the top 10 repos from github for whatever category we're looking at."""
    if not GITHUB_TOKEN:
        logger.warning("GITHUB_TOKEN is not set. API rate limits will be strictly limited.")

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": 10  # just the top 10, keeps us under rate limits
    }

    response = github_get(GITHUB_SEARCH_URL, params)
    if response is None or response.status_code != 200:
        # log it and move on with an empty list so one bad category doesn't kill the whole run
        status = response.status_code if response is not None else "no response"
        logger.error(f"Failed to fetch repositories for {category_name}: {status}")
        return []
    return response.json().get("items", [])


def record_price(cursor, ticker, m, current_price, priced_at):
    """writes a fresh price and its inputs onto the listing, plus a history point that also
    carries the star count calls are settled against."""
    cursor.execute(
        """
        UPDATE repositories SET
            current_price = %s,
            raw_stars = %s,
            raw_forks = %s,
            raw_watchers = %s,
            raw_open_issues = %s,
            raw_open_prs = %s,
            pushed_at = %s,
            priced_at = %s,
            pricing_version = %s,
            is_active = TRUE
        WHERE ticker = %s;
        """,
        (current_price, m["stars"], m["forks"], m["watchers"], m["open_issues"], m["open_prs"],
         m["pushed_at"], priced_at, PRICING_VERSION, ticker),
    )
    cursor.execute(
        """
        INSERT INTO price_history (ticker, price, stars, pricing_version, created_at)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (ticker, current_price, m["stars"], PRICING_VERSION, priced_at),
    )


def update_known_assets(conn) -> set:
    """phase 1: go through every repo we already know about and refresh its price. each repo
    commits on its own, so a run that gets cut off keeps what it already priced."""
    logger.info("Phase 1: Updating known assets.")
    known_tickers = set()  # we hand this back so phase 2 knows what to skip

    with conn.cursor() as cursor:
        cursor.execute("SELECT ticker FROM repositories")
        rows = cursor.fetchall()

    if not rows:
        logger.info("No known assets found in database.")
        return known_tickers

    for (ticker,) in rows:
        known_tickers.add(ticker.lower())
        m = fetch_repo_metrics(ticker)

        try:
            with conn.cursor() as cursor:
                if m == "missing":
                    # repo got deleted, renamed away, or made private, just mark it inactive
                    # (we don't delete the row, keeps the history around)
                    logger.warning(f"Repository {ticker} not found. Marking as inactive.")
                    cursor.execute("UPDATE repositories SET is_active = FALSE WHERE ticker = %s", (ticker,))
                elif m is None:
                    logger.error(f"Skipping {ticker} this pass, GitHub couldn't be reached.")
                else:
                    record_price(cursor, ticker, m, price_of(m), datetime.now(timezone.utc))
                    logger.info(f"Updated known asset {ticker} (Stars: {m['stars']}).")
            conn.commit()
        except psycopg2.Error as e:
            # something in the db blew up, roll back this repo and keep going
            conn.rollback()
            logger.error(f"Database error updating {ticker}: {e}")

        # pause between repos to stay under github's rate limit
        time.sleep(1)

    logger.info("Phase 1 complete.")
    return known_tickers


def process_and_upsert_new_repositories(category_name: str, items: list, known_tickers: set, conn):
    """phase 2: lists repos we haven't seen before, priced on the same full metrics as phase
    1. a repo someone added from the app that turns up in a search moves onto the main board."""
    records = []
    promoted = []

    for item in items:
        ticker = item.get("full_name") or f"{item.get('owner', {}).get('login', '')}/{item.get('name', '')}"

        # already tracking this one. phase 1 already refreshed its price
        if ticker.lower() in known_tickers:
            promoted.append((category_name, ticker))
            continue

        m = fetch_repo_metrics(ticker)
        if not isinstance(m, dict):
            logger.warning(f"Couldn't read {ticker} from GitHub, skipping it this pass.")
            continue
        records.append((ticker, m))
        known_tickers.add(ticker.lower())  # so it isn't listed twice if it shows up again this run
        time.sleep(1)

    try:
        with conn.cursor() as cursor:
            # a user-added repo that the search now finds becomes a main listing
            execute_batch(
                cursor,
                "UPDATE repositories SET source = 'worker', category = %s WHERE lower(ticker) = lower(%s) AND source = 'user'",
                promoted,
            )

            priced_at = datetime.now(timezone.utc)
            for ticker, m in records:
                current_price = price_of(m)
                # on conflict covers the same repo turning up in two categories in one run
                cursor.execute(
                    """
                    INSERT INTO repositories (ticker, current_price, description, category, raw_stars,
                                              raw_forks, raw_watchers, raw_open_issues, raw_open_prs,
                                              pushed_at, priced_at, is_active, source, pricing_version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, 'worker', %s)
                    ON CONFLICT (ticker) DO NOTHING
                    """,
                    (ticker, current_price, m["description"], category_name, m["stars"], m["forks"],
                     m["watchers"], m["open_issues"], m["open_prs"], m["pushed_at"], priced_at, PRICING_VERSION),
                )
                if cursor.rowcount == 1:
                    # a new listing starts with a single real price point and the chart fills
                    # in from there
                    cursor.execute(
                        """
                        INSERT INTO price_history (ticker, price, stars, pricing_version, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (ticker, current_price, m["stars"], PRICING_VERSION, priced_at),
                    )
        conn.commit()
        logger.info(f"Listed {len(records)} new repositories for {category_name}.")
    except psycopg2.Error as e:
        conn.rollback()
        logger.error(f"Database error during Phase 2 for {category_name}: {e}")


def run_ingestion_pipeline():
    """kicks off the whole pipeline: refresh known repos, then scout for new ones."""
    logger.info("Starting GitHub ingestion pipeline.")

    conn = get_db_connection()
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
        conn.close()
        logger.info("Database connection closed.")

    logger.info("GitHub ingestion pipeline completed.")


if __name__ == "__main__":
    # one pass and exit under github actions (the hourly cron) or with --once. otherwise it
    # runs as a long-lived process: one pass, then an hour's sleep
    if "--once" in sys.argv or os.getenv("GITHUB_ACTIONS") == "true":
        run_ingestion_pipeline()
        sys.exit(0)

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
