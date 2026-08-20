#!/usr/bin/env python3
"""
Daily Instagram scraping utility for 4DASISTAS trip/retreat discovery.

Monitors known Muslim women's travel/retreat Instagram accounts for new
trip announcements and updates data/trips.json with any new findings.

Usage:
  python3 scripts/scrape_instagram_trips.py [--dry-run]

Configure the INSTAGRAM_SOURCES list with accounts to monitor.
For production use, consider:
  - Apify Instagram Scraper API
  - RapidAPI Instagram endpoints
  - Official Instagram Basic Display API
  - GitHub Actions scheduled runs
"""

import json, sys, os, re
from datetime import datetime

try:
    import requests
except ImportError:
    print("Missing requests. Install with: pip install requests")
    sys.exit(1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "trips.json")
USER_AGENT = "Mozilla/5.0 (compatible; 4DASISTAS-Bot/1.0)"

INSTAGRAM_SOURCES = [
    {
        "handle": "sakinaretreats",
        "url": "https://www.instagram.com/sakinaretreats/",
        "name": "Sakinah Retreats",
        "enabled": True,
    },
    {
        "handle": "the.mwtg",
        "url": "https://www.instagram.com/the.mwtg/",
        "name": "The Muslim Women's Travel Group",
        "enabled": True,
    },
    {
        "handle": "onepath.travel",
        "url": "https://www.instagram.com/onepath.travel/",
        "name": "OnePath Travel",
        "enabled": True,
    },
    {
        "handle": "sistersgetawayofficial",
        "url": "https://www.instagram.com/sistersgetawayofficial/",
        "name": "Sisters Getaway",
        "enabled": True,
    },
    {
        "handle": "mawa.collective",
        "url": "https://www.instagram.com/mawa.collective/",
        "name": "Ma'wa Collective",
        "enabled": True,
    },
]


def fetch_page(url):
    """Fetch a page with proper headers. Returns response text or None."""
    try:
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None


def extract_meta_description(html):
    """Extract Open Graph or meta description from HTML."""
    if not html:
        return ""
    og_desc = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', html)
    if og_desc:
        return og_desc.group(1)
    meta_desc = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]+)"', html)
    if meta_desc:
        return meta_desc.group(1)
    return ""


def scrape_account(source):
    """Scrape an Instagram account page for trip mentions."""
    print(f"Checking @{source['handle']} ({source['name']})...")
    html = fetch_page(source["url"])
    if not html:
        return []

    desc = extract_meta_description(html)
    if not desc:
        print(f"  No description found for @{source['handle']}")
        return []

    # Look for trip/retreat keywords in the description
    keywords = ["trip", "retreat", "travel", "tour", "2026", "2027", "booking", "join us"]
    found_keywords = [kw for kw in keywords if kw.lower() in desc.lower()]

    if not found_keywords:
        print(f"  No trip-related content detected in bio for @{source['handle']}")
        return []

    print(f"  Bio mentions: {', '.join(found_keywords)}")
    print(f"  Bio preview: {desc[:120]}...")

    # In a full implementation, you would:
    # 1. Use Apify/Instagram API to fetch recent posts
    # 2. Parse post captions for trip details
    # 3. Extract dates, locations, prices
    # 4. Compare against existing trips.json to avoid duplicates

    return []


def load_trips():
    """Load existing trips from JSON."""
    if not os.path.exists(DATA_FILE):
        return {"items": []}
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_trips(data):
    """Save trips to JSON."""
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def main():
    dry_run = "--dry-run" in sys.argv
    print(f"4DASISTAS Instagram Trip Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)

    if dry_run:
        print("DRY RUN MODE — no files will be modified")
        print()

    trips = load_trips()
    existing_ids = {item.get("id") for item in trips.get("items", [])}
    new_count = 0

    for source in INSTAGRAM_SOURCES:
        if not source.get("enabled"):
            continue
        findings = scrape_account(source)
        for finding in findings:
            if finding.get("id") not in existing_ids:
                if not dry_run:
                    trips["items"].append(finding)
                new_count += 1
                print(f"  → NEW: {finding.get('title', 'Unknown')}")

    if not dry_run and new_count > 0:
        save_trips(trips)
        print()
        print(f"Saved {new_count} new trip(s) to {DATA_FILE}")
    elif dry_run and new_count > 0:
        print()
        print(f"Would save {new_count} new trip(s) to {DATA_FILE}")
    else:
        print()
        print("No new trips found.")

    print()
    print("NOTE: Full Instagram scraping requires:")
    print("  - Apify Instagram Scraper (apify.com)")
    print("  - Instagram Basic Display API")
    print("  - Or scheduled headless browser (Playwright)")
    print("  Current implementation checks bio descriptions only.")


if __name__ == "__main__":
    main()
