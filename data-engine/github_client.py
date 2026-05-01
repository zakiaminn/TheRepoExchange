import os
import requests
from dotenv import load_dotenv

# Load the environment variables from your .env file
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not GITHUB_TOKEN:
    raise ValueError("CRITICAL ERROR: GITHUB_TOKEN is missing from .env file.")

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def fetch_repo_metrics(owner_repo: str) -> dict:
    """
    Fetches raw metrics from the GitHub API for a specific repository.
    Example: fetch_repo_metrics("facebook/react")
    """
    url = f"https://api.github.com/repos/{owner_repo}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "ticker": owner_repo,
                "stars": data.get("stargazers_count", 0),
                "forks": data.get("forks_count", 0),
                "open_issues": data.get("open_issues_count", 0),
                "subscribers": data.get("subscribers_count", 0) # People 'watching' the repo
            }
        elif response.status_code == 404:
            print(f"[WARNING] Repository not found: {owner_repo}")
            return None
        elif response.status_code == 403:
            print("[ERROR] Rate limit exceeded or forbidden access.")
            return None
        else:
            print(f"[ERROR] GitHub API returned status {response.status_code} for {owner_repo}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Network failure connecting to GitHub: {e}")
        return None

# --- Quick Test Block ---
# This only runs if you execute this file directly
if __name__ == "__main__":
    print("Testing GitHub API Connection...")
    test_repo = fetch_repo_metrics("vercel/next.js")
    print(f"Result: {test_repo}")