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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s") #configure logging to include timestamps and log levels
logger = logging.getLogger(__name__) #create a logger for this module

# Load environment variables
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") #github api
DATABASE_URL = os.getenv("DATABASE_URL") #database connection string

# Dynamically calculate the cutoff date for momentum assets (30 days ago)
thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

CATEGORIES = { 
    "AI & Machine Learning": "topic:machine-learning stars:>10000",
    "Blue Chip Systems": "language:rust language:c++ stars:>20000",
    "Web Frameworks": "language:typescript language:javascript stars:>30000",
    "Hot IPOs (Last 30 Days)": f"created:>{thirty_days_ago} stars:>500"
}

GITHUB_SEARCH_URL = "https://api.github.com/search/repositories" #github search api ENDPOINT

def get_db_connection(): # establish a connection to the postgres database
    """Establish and return a connection to the PostgreSQL database."""
    if not DATABASE_URL: # if database url not set, raise an error
        raise ValueError("DATABASE_URL environment variable is not set.")
    return psycopg2.connect(DATABASE_URL)

def fetch_repositories_for_category(category_name: str, query: str, _retry_count: int = 0, _max_retries: int = 3) -> list: # fetch repositories from github search api for a given category query
    """Fetch the top 10 repositories from GitHub for a given category query."""
    headers = {
        "Accept": "application/vnd.github.v3+json", #github api versioning
        "User-Agent": "Quantitative-Exchange-Worker" #identifying worker (debugging don't touch!!!)
    }
    if GITHUB_TOKEN: #if github tokem i set
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}" # add auth header for github api requests to increase rate limits
    else:
        logger.warning("GITHUB_TOKEN is not set. API rate limits will be strictly limited.") #worker will function but api limit issue

    params = { #query parameters for github search api request
        "q": query, #search query for category
        "sort": "stars", #sort by stars
        "order": "desc", #sort by stars descending to get the most popular repositories for the category
        "per_page": 10 #only fetch top 10 results to limit data and stay within rate limits
    }

    try:
        response = requests.get(GITHUB_SEARCH_URL, headers=headers, params=params, timeout=10) #make api request to github ENDPOINT and set timeout for 10s 
        
        if response.status_code == 429:
            if _retry_count >= _max_retries:
                logger.error(f"Rate limit exceeded {_max_retries} times for {category_name}. Giving up.")
                return []
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.warning(f"Rate limit exceeded (HTTP 429). Retry {_retry_count + 1}/{_max_retries} after {retry_after}s.")
            time.sleep(retry_after)
            return fetch_repositories_for_category(category_name, query, _retry_count + 1, _max_retries)
        
        response.raise_for_status() #raise exception for any other https errors
        data = response.json() #parse the json response from github api
        return data.get("items", []) #return the list of repositories from the response, default to empty list if not found

    except requests.exceptions.RequestException as e: #handle any exceptions that occur during the api request and log the error
        logger.error(f"Failed to fetch repositories for {category_name}: {e}") #log the error
        return [] #return an empty list if there was an error fetching the repositories for the category

def update_known_assets(conn) -> set: 
    """Phase 1: Fetch all existing tickers, update their prices, or mark as inactive if 404.""" #  query the database for all known tickers and update their prices or mark as inactive if 404
    logger.info("Phase 1: Updating known assets.")
    known_tickers = set() 
    
    try:
        with conn.cursor() as cursor:
            # query all existing tickers
            cursor.execute("SELECT ticker FROM repositories")
            rows = cursor.fetchall()
            
            if not rows: # if no known tickers in the database 
                logger.info("No known assets found in database.") #log
                return known_tickers #and return empty set
                
            headers = {
                "Accept": "application/vnd.github.v3+json", #github api versioning
                "User-Agent": "Quantitative-Exchange-Worker" #identifying worker (debugging don't touch!!!)
            }
            if GITHUB_TOKEN: 
                headers["Authorization"] = f"Bearer {GITHUB_TOKEN}" # add auth header for github api requests to increase rate limits
                
            for row in rows: # iterate through each known ticker and update its price or mark as inactive if 404
                ticker = row[0]
                known_tickers.add(ticker)

                url = f"https://api.github.com/repos/{ticker}"

                max_retries = 3
                retry_count = 0
                while True:
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
                            continue
                            
                        if response.status_code == 404:
                            logger.warning(f"Repository {ticker} not found (404). Marking as inactive.") #if repo removed from github
                            cursor.execute("UPDATE repositories SET is_active = FALSE WHERE ticker = %s", (ticker,)) #mark the repository as inactive in the database
                            break # done with this ticker
                            
                        response.raise_for_status() #raise exception for any other https errors
                        data = response.json() #parse the json response from github api to get the repository details
                        
                        raw_stars = data.get("stargazers_count", 0) #get the number of stars for the repository, default to 0 if not found
                        current_price = raw_stars / 100.0 #get the current price for the repository based on the number of stars (not gonna even log it prolly)
                        current_time = datetime.now() #get the current time for price history record
                        
                        # Update repo
                        update_query = """
                            UPDATE repositories SET
                                current_price = %s, 
                                raw_stars = %s,
                                is_active = TRUE
                            WHERE ticker = %s;
                        """
                        cursor.execute(update_query, (current_price, raw_stars, ticker))
                        
                        # insert price history
                        history_query = """
                            INSERT INTO price_history (ticker, price, created_at)
                            VALUES (%s, %s, %s)
                        """
                        cursor.execute(history_query, (ticker, current_price, current_time)) #insert a new price history record for the repository with the current price and time
                        
                        logger.info(f"Updated known asset {ticker} (Stars: {raw_stars}).")
                        break # success, move to next ticker
                        
                    except requests.exceptions.RequestException as e:
                        logger.error(f"Failed to fetch repo {ticker}: {e}")
                        break # on other errors, just skip to next
                
                # Sleep briefly to respect API limits
                time.sleep(1) 
                
            conn.commit() #commit all the updates to the database after processing all known tickers
            logger.info("Phase 1 complete.") #log completion of phase 1
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error during Phase 1: {e}")
        
    return known_tickers

def process_and_upsert_new_repositories(category_name: str, items: list, known_tickers: set, conn): # process the repos fetched from github
    """Phase 2: Process only new repositories discovered via search."""
    records = []
    
    for item in items:
        owner = item.get("owner", {}).get("login", "") #get the owner login for the repository, default to empty string if not found
        name = item.get("name", "")
        ticker = f"{owner}/{name}"
        
        # filtering against the list of known tickers
        if ticker in known_tickers:
            continue
            
        raw_stars = item.get("stargazers_count", 0) 
        description = item.get("description", "")
        
        if description and len(description) > 500:
            description = description[:497] + "..."

        current_price = raw_stars / 100.0
        records.append((ticker, current_price, description, category_name, raw_stars))

    if not records:
        logger.info(f"No new records to insert for category {category_name}.") #log if no new records to insert for the category and
        return #exit the function

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
 
    try: # upsert the new repositories into the database and also insert synthetic price history records for the new repositories to create a more robust dataset for the frontend to display and analyze (BETA TEST)
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

        conn.commit() #commit the upsert and history inserts to the database
        logger.info(f"Successfully processed and backfilled {len(records)} NEW repositories for {category_name}.")
    except Exception as e: #handle any exceptions that occur during the database operations and log the error
        conn.rollback()
        logger.error(f"Database error during Phase 2 upsert for {category_name}: {e}")

def run_ingestion_pipeline(): #function to run entire ingestion pipeline
    """Main execution function for the GitHub ingestion worker."""
    logger.info("Starting GitHub ingestion pipeline.") #log the start of the ingestion pipeline
    
    try: #establish a connection to the database and log any connection errors
        conn = get_db_connection()
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        raise

    try:
        # updating known assets and getting the set of known tickers
        known_tickers = update_known_assets(conn)
        
        # scouting for new trending assets across categories
        logger.info("Phase 2: Scouting for new trending assets.")
        for category_name, query in CATEGORIES.items():
            logger.info(f"Scouting category: {category_name}")
            items = fetch_repositories_for_category(category_name, query)
            if items:
                process_and_upsert_new_repositories(category_name, items, known_tickers, conn)
            # Sleep briefly to respect API limits between category queries
            time.sleep(2)
    finally: #ensure the database connection is closed after the pipeline runs, even if there are errors
        if conn:
            conn.close()
            logger.info("Database connection closed.")
            
    logger.info("GitHub ingestion pipeline completed.")

if __name__ == "__main__": #main entry point for worker
    logger.info("Starting single-execution ingestion cycle.")
    while True:
        try:
            run_ingestion_pipeline()
            logger.info("Cycle complete. Sleeping for 1 hour...")
            time.sleep(3600) 
            
        except Exception as e:
            logger.critical(f"Unhandled exception in ingestion pipeline: {e}")
            logger.info("Sleeping for 5 minutes before retry...")
            time.sleep(300)
