#!/usr/bin/env python3
"""
Generate calendar.ics from 4DASISTAS JSON data files.

Reads data/sports.json, data/gatherings.json, data/dayactivities.json,
data/mosquegatherings.json, and data/trips.json, then writes calendar.ics.

Usage:
  python3 scripts/generate_calendar.py [--dry-run]

Configure GitHub Actions to run this on data file changes.
"""

import json
import os
import re
import sys
from datetime import datetime, date

try:
    from dateutil.relativedelta import relativedelta
except ImportError:
    from datetime import timedelta
    class relativedelta:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
        def __radd__(self, other):
            d = other
            for k, v in self.kwargs.items():
                if k == 'months':
                    month = d.month - 1 + v
                    year = d.year + (month // 12)
                    month = (month % 12) + 1
                    day = min(d.day, [31,29 if year%4==0 and (year%100!=0 or year%400==0) else 28,31,30,31,30,31,31,30,31,30,31][month-1])
                    d = d.replace(year=year, month=month, day=day)
            return d

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(BASE_DIR, "calendar.ics")

DATA_FILES = [
    "sports.json",
    "gatherings.json",
    "dayactivities.json",
    "mosquegatherings.json",
    "trips.json",
]

DAY_MAP = {
    "sun": "SU", "sunday": "SU",
    "mon": "MO", "monday": "MO",
    "tue": "TU", "tuesday": "TU",
    "wed": "WE", "wednesday": "WE",
    "thu": "TH", "thursday": "TH",
    "fri": "FR", "friday": "FR",
    "sat": "SA", "saturday": "SA",
}


def escape_ics(text):
    """Escape text for ICS format."""
    if not text:
        return ""
    text = str(text)
    text = text.replace("\\", "\\\\")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    text = text.replace("\n", "\\n")
    return text


def parse_date(date_str):
    """Parse a date string like '2026-07-26' or 'July 26th, 2026' into YYYY-MM-DD."""
    if not date_str:
        return None
    date_str = str(date_str).strip().replace('–', '-').replace('—', '-')
    # Try ISO format first
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    month_map = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "may": "05", "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    }

    # Try formats like "July 26th, 2026", "July 26, 2026", or date ranges like "June 28 - July 5, 2026"
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|\s+to\s+|\s+\-\s+|\s+through\s+)?(?:[A-Za-z]+\s+)?(\d{1,2})?(?:st|nd|rd|th)?[,\s]*(\d{4})", date_str)
    if m:
        month_name = m.group(1).lower()[:3]
        month = month_map.get(month_name)
        if month:
            day = m.group(2).zfill(2)
            year = m.group(4)
            if month and day:
                return f"{year}-{month}-{day}"

    # Try month-only formats like "October 2026"
    m = re.search(r"([A-Za-z]+)\s+(\d{4})", date_str)
    if m:
        month_name = m.group(1).lower()[:3]
        month = month_map.get(month_name)
        if month:
            return f"{m.group(2)}-{month}-01"

    # Try plain "July 26th" without year
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?", date_str)
    if m:
        month_name = m.group(1).lower()[:3]
        month = month_map.get(month_name)
        if month:
            return f"{datetime.now().year}-{month}-{m.group(2).zfill(2)}"

    return None


def make_uid(item_id, title):
    """Create a stable UID for an event."""
    slug = (item_id or title or "event").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return f"{slug}@4dasistas.ca"


def dedupe_items(items):
    """Remove repeated records for the same event title and start date."""
    aliases = {"muslimah market bazaar workshops": "muslimah market"}
    seen = set()
    unique = []
    for item in items:
        title = re.sub(r"[^a-z0-9 ]", "", str(item.get("title", "")).lower())
        title = re.sub(r"\s+", " ", title).strip()
        title = aliases.get(title, title)
        start = item.get("calDate") or item.get("eventDate") or item.get("date", "")
        key = (title, str(start))
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def build_description(item):
    """Build the DESCRIPTION field from item fields."""
    parts = []
    for key in ["date", "time", "price", "registration", "organizer", "contact", "website", "instagram", "whatsapp", "desc"]:
        val = item.get(key)
        if val:
            label = key.capitalize() + ":"
            parts.append(f"{label} {val}")
    return "\\n".join(parts)


def event_to_ics(item, category):
    """Convert a JSON item to an ICS VEVENT string."""
    uid = make_uid(item.get("id"), item.get("title"))
    now = datetime.utcnow()
    dtstamp = now.strftime("%Y%m%dT%H%M%SZ")

    # Determine start date
    cal_date = item.get("calDate") or item.get("eventDate")
    if not cal_date:
        return None
    cal_date = parse_date(cal_date)
    if not cal_date:
        return None

    lines = ["BEGIN:VEVENT"]
    lines.append(f"UID:{uid}")
    lines.append(f"DTSTAMP:{dtstamp}")

    # Recurring vs one-time
    days = item.get("days", [])
    if days and len(days) > 0:
        byday = ",".join(DAY_MAP.get(d.lower(), d.upper()) for d in days if DAY_MAP.get(d.lower()))
        if byday:
            lines.append(f"DTSTART;VALUE=DATE:{cal_date.replace('-', '')}")
            lines.append(f"RRULE:FREQ=WEEKLY;BYDAY={byday}")
    else:
        lines.append(f"DTSTART;VALUE=DATE:{cal_date.replace('-', '')}")
        # If there's an end date in the date field, try to parse it
        date_str = item.get("date", "")
        end_match = re.search(r"(\d{4})-(\d{2})-(\d{2})", date_str)
        if end_match:
            end_date = f"{end_match.group(1)}-{end_match.group(2)}-{end_match.group(3)}"
            if end_date != cal_date:
                lines.append(f"DTEND;VALUE=DATE:{end_date.replace('-', '')}")

    title = escape_ics(item.get("title", "Event"))
    lines.append(f"SUMMARY:{title}")

    desc = escape_ics(build_description(item))
    if desc:
        lines.append(f"DESCRIPTION:{desc}")

    location = escape_ics(item.get("location", ""))
    if location:
        lines.append(f"LOCATION:{location}")

    lines.append(f"CATEGORIES:{category}")
    lines.append("END:VEVENT")
    return "\n".join(lines)


def generate_ics(dry_run=False):
    """Generate calendar.ics from all data files."""
    events = []

    for filename in DATA_FILES:
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            print(f"  Skipping missing file: {filename}")
            continue
        with open(filepath, "r") as f:
            data = json.load(f)
        items = dedupe_items(data.get("items", []))
        category = filename.replace(".json", "").capitalize()
        if category == "Mosquegatherings":
            category = "Mosque Gatherings"
        elif category == "Dayactivities":
            category = "Day Activities"
        elif category == "Trips":
            category = "Trips"

        for item in items:
            ics = event_to_ics(item, category)
            if ics:
                events.append(ics)

    now = datetime.utcnow()
    prodid = f"-//4DASISTAS//Community Calendar//EN"
    calname = "4DASISTAS Community Calendar"

    ics_content = "\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{prodid}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{calname}",
        "X-WR-TIMEZONE:America/Toronto",
    ] + events + [
        "END:VCALENDAR",
    ])

    if dry_run:
        print(f"Would write {len(events)} events to {OUTPUT_FILE}")
        print("First 500 chars:")
        print(ics_content[:500])
    else:
        with open(OUTPUT_FILE, "w") as f:
            f.write(ics_content)
            f.write("\n")
        print(f"Generated {OUTPUT_FILE} with {len(events)} events")


def main():
    dry_run = "--dry-run" in sys.argv
    print(f"4DASISTAS Calendar Generator — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    if dry_run:
        print("DRY RUN MODE — no files will be modified")
    generate_ics(dry_run=dry_run)


if __name__ == "__main__":
    main()
