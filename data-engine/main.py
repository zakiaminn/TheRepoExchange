import time
import threading
import psycopg2
import os
from github_client import fetch_repo_metrics
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv


load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "*")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

# github's s&p 500 lol
TARGET_REPOS = [
    "vercel/next.js",
    "facebook/react",
    "torvalds/linux",
    "django/django",
    "fastapi/fastapi"
]

live_market_data = []

def save_to_db(ticker, price):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        query = """ INSERT INTO repositories (ticker, current_price, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (ticker)
                    DO UPDATE SET current_price = EXCLUDED.current_price, updated_at = NOW();
                """
        cur.execute(
            query,
            (ticker, price)
        )
        
        history_query = """ INSERT INTO price_history (ticker, price)
                            VALUES (%s, %s);
                        """
        cur.execute(
            history_query,
            (ticker, price)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[DB ERROR] Could not save {ticker} to database: {e}")
        return False


def calculate_stock_price(metrics: dict) -> float:
    if not metrics:
        return 0.00
        
    # Algorithm Weights
    # Stars == Popularity (Light Weight)
    # Forks == Developer Interest (Heavy Weight)
    # Open Issue == Libability (bring price down)
    
    star_value = metrics["stars"] * 0.01      # 100 stars = $1.00
    fork_value = metrics["forks"] * 0.05      # 20 forks = $1.00
    issue_penalty = metrics["open_issues"] * 0.02 
    raw_price = star_value + fork_value - issue_penalty
    
    # checkfor stock NEVER going below 1 dollar to avoid penny stock status
    return max(round(raw_price, 2), 1.00)

def market_worker():
    """Runs in the background, updating prices every 60 seconds."""
    global live_market_data
    while True:
        print("\n[Data Engine] Fetching new market data...")
        new_data = []
        for repo in TARGET_REPOS:
            metrics = fetch_repo_metrics(repo)
            if metrics:
                price = calculate_stock_price(metrics)
                ticker = metrics["ticker"].upper()
                sucess = save_to_db(ticker, price)
                if sucess:
                    print(f"synced {ticker} to Supabase: ${price}")
                new_data.append({
                    "ticker": metrics["ticker"].upper(),
                    "price": price,
                    "stars": metrics["stars"]
                })
            time.sleep(1) # prevent hitting GitHub rate limits
            
        live_market_data = new_data
        print("[Data Engine] Market data updated.")
        time.sleep(60)

# starting background woekr on app startup
@app.on_event("startup")
def startup_event():
    thread = threading.Thread(target=market_worker, daemon=True)
    thread.start()

# endpoint for frontend to fetch live market data
@app.get("/api/market")
def get_market_data():
    return {"market": live_market_data}