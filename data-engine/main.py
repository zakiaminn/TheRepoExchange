import time
import schedule
from github_client import fetch_repo_metrics

# github's s&p 500 lol
TARGET_REPOS = [
    "vercel/next.js",
    "facebook/react",
    "torvalds/linux",
    "django/django",
    "fastapi/fastapi"
]

def calculate_stock_price(metrics: dict) -> float:
    """
    The V1 Market Maker Algorithm.
    Converts raw GitHub metrics into a simulated USD stock price.
    """
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

def market_tick():
    """Runs one complete cycle of fetching data and updating prices."""
    print("\n--- MARKET TICK (Fetching Live Data) ---")
    
    for repo in TARGET_REPOS:
        metrics = fetch_repo_metrics(repo)
        
        if metrics:
            price = calculate_stock_price(metrics)
            print(f"[{metrics['ticker'].upper()}] : ${price:,.2f}") # =========== POST GRESSS ===========
        time.sleep(1) # avoids github blocking so sleep 1s
        
    print("-------------------------------------------\n")

if __name__ == "__main__":
    print("Starting TRX Data Engine...")
    
    # Run it immediately once on startup
    market_tick()
    
    # Schedule it to run every 1 minute
    schedule.every(1).minutes.do(market_tick)
    
    print("Engine running. Waiting for next scheduled tick... (Press Ctrl+C to stop)")
    
    # Keep the script running forever
    while True:
        schedule.run_pending()
        time.sleep(1)