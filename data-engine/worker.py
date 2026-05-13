import os
import time
import logging
import requests
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

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

def process_and_upsert_repositories(category_name: str, items: list, conn):
    """Parse repository data and upsert into the PostgreSQL database."""
    records = []
    for item in items:
        owner = item.get("owner", {}).get("login", "")
        name = item.get("name", "")
        ticker = f"{owner}/{name}"
        raw_stars = item.get("stargazers_count", 0)
        description = item.get("description", "")
        
        if description and len(description) > 500:
            description = description[:497] + "..."

        # Calculate initial current_price based on stars if row is new
        current_price = raw_stars / 100.0

        records.append((ticker, current_price, description, category_name, raw_stars))

    if not records:
        logger.info(f"No records to insert for category {category_name}.")
        return

    upsert_query = """
        INSERT INTO repositories (ticker, current_price, description, category, raw_stars)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (ticker)
        DO UPDATE SET
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            raw_stars = EXCLUDED.raw_stars;
    """

    try:
        with conn.cursor() as cursor:
            execute_batch(cursor, upsert_query, records)
        conn.commit()
        logger.info(f"Successfully processed and upserted {len(records)} repositories for {category_name}.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error during upsert for {category_name}: {e}")

def run_ingestion_pipeline():
    """Main execution function for the GitHub ingestion worker."""
    logger.info("Starting GitHub ingestion pipeline.")
    
    try:
        conn = get_db_connection()
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        return

    try:
        for category_name, query in CATEGORIES.items():
            logger.info(f"Processing category: {category_name}")
            items = fetch_repositories_for_category(category_name, query)
            if items:
                process_and_upsert_repositories(category_name, items, conn)
            # Sleep briefly to respect API limits between category queries
            time.sleep(2)
    finally:
        if conn:
            conn.close()
            logger.info("Database connection closed.")
            
    logger.info("GitHub ingestion pipeline completed.")

if __name__ == "__main__":
    run_ingestion_pipeline()
