#!/usr/bin/env python3
"""
Scrape GTA Sunni mosque websites for female-only / sisters-only events
and update data/mosquegatherings.json.

Usage:
  python3 scripts/scrape_mosque_events.py [--dry-run]

Configure the mosque URLs and selectors in the MOSQUE_SOURCES dict below.
"""

import json, re, sys, os
from datetime import datetime
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install requests beautifulsoup4")
    sys.exit(1)


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "data", "mosquegatherings.json")
USER_AGENT = "Mozilla/5.0 (compatible; 4DASISTAS-Bot/1.0)"

MOSQUE_SOURCES = [
    {
        "name": "HIA / Masjid Halton",
        "url": "https://www.hia.live/events",
        "enabled": True,
        "parse": "hia_events",
    },
    {
        "name": "ICCO",
        "url": "https://centres.macnet.ca/icco/announcements-mac-icco",
        "enabled": True,
        "parse": "icco_announcements",
    },
    {
        "name": "MAM",
        "url": "https://miltonmasjid.com/",
        "enabled": True,
        "parse": "mam_home",
    },
    {
        "name": "Al-Falah",
        "url": "https://icna.website/alfalahcentre/our-events/",
        "enabled": True,
        "parse": "alfalah_events",
    },
    {
        "name": "ISNA Canada",
        "url": "https://www.isnacanada.com/events-programs/",
        "enabled": True,
        "parse": "isna_events",
    },
    {
        "name": "Meadowvale Islamic Centre",
        "url": "https://mici.org/",
        "enabled": True,
        "parse": "mic_home",
    },
    {
        "name": "Masjid Al-Farooq Mississauga",
        "url": "https://en.masjidway.com/masjid/4507/events",
        "enabled": True,
        "parse": "masjidway_events",
    },
    {
        "name": "Dar Foundation",
        "url": "https://dar-foundation.wheree.com/",
        "enabled": True,
        "parse": "dar_home",
    },
]

SISTERS_KEYWORDS = re.compile(
    r"sisters?|sisterhood|female.only|women.only|ladies.only|girls.only|"
    r"muslimah|sisters.only|hijabis|sisters.islamic|sisters.craft|"
    r"sisters.halaqa|sisters.youth|sisters.event|sisters.activate",
    re.I,
)


def fetch(url, timeout=20):
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"  [WARN] Failed to fetch {url}: {e}")
        return None


def is_sisters_event(text):
    if not text:
        return False
    return bool(SISTERS_KEYWORDS.search(text))


def extract_date_candidates(text):
    dates = []
    patterns = [
        r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}",
        r"\d{4}-\d{2}-\d{2}",
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? \w+ \d{1,2}",
        r"(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),? \w+ \d{1,2}",
    ]
    for p in patterns:
        dates.extend(re.findall(p, text, re.I))
    return list(set(dates))


def dedupe(items, key_fn=lambda x: x["id"]):
    seen = set()
    out = []
    for i in items:
        k = key_fn(i)
        if k not in seen:
            seen.add(k)
            out.append(i)
    return out


def parse_hia_events(html, base_url):
    items = []
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("[class*=event]")
    seen = set()
    for card in cards:
        text = card.get_text(separator=" ", strip=True)
        title_el = card.select_one("h1, h2, h3, h4, .event-title, .title, a")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue
        title_lower = title.lower()
        if not is_sisters_event(title_lower) and not is_sisters_event(text[:300]):
            continue
        link_el = card.select_one("a[href]")
        link = urljoin(base_url, link_el["href"]) if link_el else base_url
        key = re.sub(r"[^a-z0-9]+", "", title_lower)[:60]
        if key in seen:
            continue
        seen.add(key)
        date_str = ", ".join(extract_date_candidates(text)[:3])
        items.append({
            "id": f"mg-hia-{key[:40]}",
            "tag": "Mosque Gathering",
            "title": title[:120],
            "date": date_str or "Date TBD",
            "location": "Halton Masjid, 4310 Fairview St, Burlington, ON",
            "organizer": "Halton Islamic Association (HIA)",
            "desc": text[:500],
            "website": link,
            "instagram": "https://www.instagram.com/masjidhalton/",
        })
    return items


def parse_icco_announcements(html, base_url):
    items = []
    soup = BeautifulSoup(html, "html.parser")
    articles = soup.select("article, .announcement-item, .post, [class*=announcement]")
    for art in articles:
        text = art.get_text(separator=" ", strip=True)
        title_el = art.select_one("h1, h2, h3, h4, .entry-title, .title, a")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue
        if not is_sisters_event(title) and not is_sisters_event(text[:400]):
            continue
        link_el = art.select_one("a[href]")
        link = urljoin(base_url, link_el["href"]) if link_el else base_url
        date_str = ", ".join(extract_date_candidates(text)[:3])
        items.append({
            "id": f"mg-icco-{re.sub(r'[^a-z0-9]+', '-', title.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": title[:120],
            "date": date_str or "Date TBD",
            "location": "ICCO, 2550 Dunwin Dr, Mississauga, ON",
            "organizer": "Islamic Community Centre of Ontario (ICCO)",
            "desc": text[:500],
            "website": link,
            "instagram": "https://www.instagram.com/icco_mac/",
        })
    return items


def parse_mam_home(html, base_url):
    items = []
    if not html:
        return items
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    for m in re.finditer(r"(?:Sister[^.\n]{0,80}|Women[^.\n]{0,80}|Ladies[^.\n]{0,80})", text, re.I):
        snippet = m.group(0)
        if not is_sisters_event(snippet):
            continue
        items.append({
            "id": f"mg-mam-{re.sub(r'[^a-z0-9]+', '-', snippet.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": snippet.strip()[:120],
            "date": "Date TBD",
            "location": "Muslim Association of Milton (MAM), Milton, ON",
            "organizer": "Muslim Association of Milton (MAM)",
            "desc": snippet.strip()[:500],
            "website": base_url,
        })
    return items


def parse_alfalah_events(html, base_url):
    items = []
    if not html:
        return items
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    if not is_sisters_event(text):
        return items
    for m in re.finditer(r"(?:Sisters?|Women|Ladies)[^.\n]{0,200}", text, re.I):
        snippet = m.group(0)
        if not is_sisters_event(snippet):
            continue
        items.append({
            "id": f"mg-alfalah-{re.sub(r'[^a-z0-9]+', '-', snippet.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": snippet.strip()[:120],
            "date": "Date TBD",
            "location": "Al-Falah Islamic Centre, 391 Burnhamthorpe Rd E, Oakville, ON",
            "organizer": "Al-Falah Islamic Centre",
            "desc": snippet.strip()[:500],
            "website": base_url,
        })
    return items


def parse_isna_events(html, base_url):
    items = []
    if not html:
        return items
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("article, .event, .upcoming-event, [class*=event]")
    if not cards:
        cards = soup.select("a[href*=event]")
    for card in cards:
        text = card.get_text(separator=" ", strip=True)
        title_el = card.select_one("h1, h2, h3, h4, .entry-title, .title, a")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue
        if not is_sisters_event(title) and not is_sisters_event(text[:400]):
            continue
        link_el = card.select_one("a[href]")
        link = urljoin(base_url, link_el["href"]) if link_el else base_url
        date_str = ", ".join(extract_date_candidates(text)[:3])
        items.append({
            "id": f"mg-isna-{re.sub(r'[^a-z0-9]+', '-', title.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": title[:120],
            "date": date_str or "Date TBD",
            "location": "ISNA Canada / Jami Mosque, Toronto, ON",
            "organizer": "ISNA Canada",
            "desc": text[:500],
            "website": link,
            "instagram": "https://www.instagram.com/isna_canada/",
        })
    return items


def parse_mic_home(html, base_url):
    items = []
    if not html:
        return items
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    if not is_sisters_event(text):
        return items
    for m in re.finditer(r"(?:Sisters?|Women|Ladies)[^.\n]{0,200}", text, re.I):
        snippet = m.group(0)
        if not is_sisters_event(snippet):
            continue
        items.append({
            "id": f"mg-mic-{re.sub(r'[^a-z0-9]+', '-', snippet.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": snippet.strip()[:120],
            "date": "Date TBD",
            "location": "Meadowvale Islamic Centre, 6508 Winston Churchill Blvd, Mississauga, ON",
            "organizer": "Meadowvale Islamic Centre (MIC)",
            "desc": snippet.strip()[:500],
            "website": base_url,
            "instagram": "https://www.instagram.com/meadowvaleislamiccentre/",
        })
    return items


def parse_masjidway_events(html, base_url):
    items = []
    if not html:
        return items
    soup = BeautifulSoup(html, "html.parser")
    events = soup.select(".event, [class*=event], article")
    for ev in events:
        text = ev.get_text(separator=" ", strip=True)
        title_el = ev.select_one("h1, h2, h3, h4, .title, a")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue
        if not is_sisters_event(title) and not is_sisters_event(text[:400]):
            continue
        link_el = ev.select_one("a[href]")
        link = urljoin(base_url, link_el["href"]) if link_el else base_url
        date_str = ", ".join(extract_date_candidates(text)[:3])
        items.append({
            "id": f"mg-alfarooq-{re.sub(r'[^a-z0-9]+', '-', title.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": title[:120],
            "date": date_str or "Date TBD",
            "location": "Masjid Al-Farooq, 935 Eglinton Ave W, Mississauga, ON",
            "organizer": "Masjid Al-Farooq",
            "desc": text[:500],
            "website": link,
        })
    return items


def parse_dar_home(html, base_url):
    items = []
    if not html:
        return items
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    if not is_sisters_event(text):
        return items
    for m in re.finditer(r"(?:Sisters?|Women|Ladies)[^.\n]{0,200}", text, re.I):
        snippet = m.group(0)
        if not is_sisters_event(snippet):
            continue
        items.append({
            "id": f"mg-dar-{re.sub(r'[^a-z0-9]+', '-', snippet.lower())[:40]}",
            "tag": "Mosque Gathering",
            "title": snippet.strip()[:120],
            "date": "Date TBD",
            "location": "Dar Foundation, 485 Morden Rd, Oakville, ON",
            "organizer": "Dar Foundation",
            "desc": snippet.strip()[:500],
            "website": "https://darfoundation.com",
        })
    return items


PARSERS = {
    "hia_events": parse_hia_events,
    "icco_announcements": parse_icco_announcements,
    "mam_home": parse_mam_home,
    "alfalah_events": parse_alfalah_events,
    "isna_events": parse_isna_events,
    "mic_home": parse_mic_home,
    "masjidway_events": parse_masjidway_events,
    "dar_home": parse_dar_home,
}


def main():
    dry_run = "--dry-run" in sys.argv
    print(f"[INFO] Starting mosque event scrape at {datetime.now().isoformat()}")

    existing = {}
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            try:
                existing = {item["id"]: item for item in json.load(f).get("items", [])}
            except json.JSONDecodeError:
                existing = {}

    new_items = []
    for src in MOSQUE_SOURCES:
        if not src["enabled"]:
            continue
        print(f"[INFO] Scraping {src['name']} -> {src['url']}")
        html = fetch(src["url"])
        if not html:
            continue
        parser = PARSERS.get(src["parse"])
        if not parser:
            print(f"  [WARN] No parser for {src['parse']}")
            continue
        found = parser(html, src["url"])
        print(f"  [INFO] Found {len(found)} sisters events")
        new_items.extend(found)

    new_items = dedupe(new_items, key_fn=lambda x: x["id"])
    merged = {**existing, **{item["id"]: item for item in new_items}}
    merged_list = list(merged.values())

    print(f"[INFO] Total items after merge: {len(merged_list)}")

    if dry_run:
        print("[DRY RUN] Would write:")
        for item in merged_list:
            print(f"  - {item['id']}: {item['title']}")
        return

    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump({"items": merged_list}, f, indent=2)
    print(f"[INFO] Wrote {len(merged_list)} items to {DATA_FILE}")


if __name__ == "__main__":
    main()
