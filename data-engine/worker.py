import os
import time
import logging
import requests
import random
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")

CATEGORIES = {
    "AI & Machine Learning": "topic:machine-learning stars:>10000",
    "Blue Chip Systems": "language:rust language:c++ stars:>20000",
    "Web Frameworks": "language:typescript language:javascript stars:>30000"
}

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories"

def get_db_connection():
    """Establish and return a connection to the PostgreSQL database."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set.")
    return psycopg2.connect(DATABASE_URL)

def fetch_repositories_for_category(category_name: str, query: str) -> list:
    """Fetch the top 10 repositories from GitHub for a given category query."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Quantitative-Exchange-Worker"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    else:
        logger.warning("GITHUB_TOKEN is not set. API rate limits will be strictly limited.")

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": 10
    }

    try:
        response = requests.get(GITHUB_SEARCH_URL, headers=headers, params=params, timeout=10)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.error(f"Rate limit exceeded (HTTP 429). Retrying after {retry_after} seconds.")
            time.sleep(retry_after)
            return fetch_repositories_for_category(category_name, query)
        
        response.raise_for_status()
        data = response.json()
        return data.get("items", [])

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch repositories for {category_name}: {e}")
        return []

def update_known_assets(conn) -> set:
    """Phase 1: Fetch all existing tickers, update their prices, or mark as inactive if 404."""
    logger.info("Phase 1: Updating known assets.")
    known_tickers = set()
    
    try:
        with conn.cursor() as cursor:
            # Query all existing tickers
            cursor.execute("SELECT ticker FROM repositories")
            rows = cursor.fetchall()
            
            if not rows:
                logger.info("No known assets found in database.")
                return known_tickers
                
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Quantitative-Exchange-Worker"
            }
            if GITHUB_TOKEN:
                headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
                
            for row in rows:
                ticker = row[0]
                known_tickers.add(ticker)
                
                url = f"https://api.github.com/repos/{ticker}"
                
                while True: # simple retry loop for rate limit
                    try:
                        response = requests.get(url, headers=headers, timeout=10)
                        
                        if response.status_code == 429:
                            retry_after = int(response.headers.get("Retry-After", 60))
                            logger.error(f"Rate limit exceeded (HTTP 429). Sleeping for {retry_after} seconds.")
                            time.sleep(retry_after)
                            continue # retry the request
                            
                        if response.status_code == 404:
                            logger.warning(f"Repository {ticker} not found (404). Marking as inactive.")
                            cursor.execute("UPDATE repositories SET is_active = FALSE WHERE ticker = %s", (ticker,))
                            break # done with this ticker
                            
                        response.raise_for_status()
                        data = response.json()
                        
                        raw_stars = data.get("stargazers_count", 0)
                        current_price = raw_stars / 100.0
                        current_time = datetime.now()
                        
                        # Update repo
                        update_query = """
                            UPDATE repositories SET
                                current_price = %s,
                                raw_stars = %s,
                                is_active = TRUE
                            WHERE ticker = %s;
                        """
                        cursor.execute(update_query, (current_price, raw_stars, ticker))
                        
                        # Insert price history
                        history_query = """
                            INSERT INTO price_history (ticker, price, created_at)
                            VALUES (%s, %s, %s)
                        """
                        cursor.execute(history_query, (ticker, current_price, current_time))
                        
                        logger.info(f"Updated known asset {ticker} (Stars: {raw_stars}).")
                        break # success, move to next ticker
                        
                    except requests.exceptions.RequestException as e:
                        logger.error(f"Failed to fetch repo {ticker}: {e}")
                        break # on other errors, just skip to next
                
                # Sleep briefly to respect API limits
                time.sleep(1)
                
            conn.commit()
            logger.info("Phase 1 complete.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error during Phase 1: {e}")
        
    return known_tickers

def process_and_upsert_new_repositories(category_name: str, items: list, known_tickers: set, conn):
    """Phase 2: Process only new repositories discovered via search."""
    records = []
    
    for item in items:
        owner = item.get("owner", {}).get("login", "")
        name = item.get("name", "")
        ticker = f"{owner}/{name}"
        
        # Filter against the list of known tickers
        if ticker in known_tickers:
            continue
            
        raw_stars = item.get("stargazers_count", 0)
        description = item.get("description", "")
        
        if description and len(description) > 500:
            description = description[:497] + "..."

        current_price = raw_stars / 100.0
        records.append((ticker, current_price, description, category_name, raw_stars))

    if not records:
        logger.info(f"No new records to insert for category {category_name}.")
        return

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
            execute_batch(cursor, upsert_query, records)
            
            history_records = []
            current_time = datetime.now()
            
            for ticker, current_price, _, _, _ in records:
                known_tickers.add(ticker) # add to known
                
                history_records.append((ticker, current_price, current_time))
                
                # synthetic backfill
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
    """Main execution function for the GitHub ingestion worker."""
    logger.info("Starting GitHub ingestion pipeline.")
    
    try:
        conn = get_db_connection()
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        return

    try:
        # Phase 1: Update known
        known_tickers = update_known_assets(conn)
        
        # Phase 2: Scout new
        logger.info("Phase 2: Scouting for new trending assets.")
        for category_name, query in CATEGORIES.items():
            logger.info(f"Scouting category: {category_name}")
            items = fetch_repositories_for_category(category_name, query)
            if items:
                process_and_upsert_new_repositories(category_name, items, known_tickers, conn)
            # Sleep briefly to respect API limits between category queries
            time.sleep(2)
    finally:
        if conn:
            conn.close()
            logger.info("Database connection closed.")
            
    logger.info("GitHub ingestion pipeline completed.")

if __name__ == "__main__":
    while True:
        logger.info("Heartbeat: Starting scheduled ingestion cycle.")
        run_ingestion_pipeline()
        
        logger.info("Cycle complete. Sleeping for an hour before next cycle.")
        time.sleep(3600) #one hour sleep between cycles
