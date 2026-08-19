#!/usr/bin/env python3
"""
Generate calendar.ics from the site's event JSON data files.
Run this during the Netlify build so the ICS feed stays in sync with CMS changes.
"""

import json
import os
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(BASE_DIR, "calendar.ics")

EVENT_SOURCES = [
    ("sports.json", "Sports"),
    ("gatherings.json", "Gatherings"),
    ("dayactivities.json", "Day Activities"),
    ("trips.json", "Trips"),
    ("mosquegatherings.json", "Mosque Gatherings"),
]

DAY_MAP = {
    "sun": "SU",
    "mon": "MO",
    "tue": "TU",
    "wed": "WE",
    "thu": "TH",
    "fri": "FR",
    "sat": "SA",
}

STABLE_START_DATES = {
    "mon": "20240101",
    "tue": "20240102",
    "wed": "20240103",
    "thu": "20240104",
    "fri": "20240105",
    "sat": "20240106",
    "sun": "20240107",
}


def escape_ics(text):
    if text is None:
        return ""
    text = str(text)
    text = text.replace("\\", "\\\\")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    text = text.replace("\n", "\\n")
    text = text.replace("\r", "")
    return text


def load_events():
    events = []
    for filename, category in EVENT_SOURCES:
        path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for item in data.get("items", []):
            events.append((item, category))
    return events


def generate_uid(item, category):
    event_id = item.get("id")
    if not event_id:
        title = item.get("title", "event")
        event_id = title.lower().replace(" ", "-").replace(",", "").replace("'", "")[:40]
    return f"{event_id}@4dasistas.ca"


def format_dtstamp():
    now = datetime.now(timezone.utc)
    return now.strftime("%Y%m%dT%H%M%SZ")


def format_date(date_str):
    if not date_str:
        return None
    date_str = str(date_str).strip()
    if len(date_str) >= 10 and date_str[4] == "-" and date_str[7] == "-":
        return date_str.replace("-", "")[:8]
    return None


def build_rrule(item):
    days = item.get("days", [])
    if not days:
        return None
    byday = ",".join(DAY_MAP[d] for d in days if d in DAY_MAP)
    if not byday:
        return None
    parts = [f"FREQ=WEEKLY;BYDAY={byday}"]
    recur_end = item.get("recurEnd")
    if recur_end:
        date = format_date(recur_end)
        if date:
            parts.append(f"UNTIL={date}")
    return ";".join(parts)


def get_dtstart(item):
    cal_date = item.get("calDate") or item.get("eventDate")
    if cal_date:
        return format_date(cal_date)
    days = item.get("days", [])
    if days:
        first_day = days[0].lower()
        return STABLE_START_DATES.get(first_day)
    return None


def event_to_ics(item, category):
    lines = []
    lines.append("BEGIN:VEVENT")

    uid = generate_uid(item, category)
    lines.append(f"UID:{uid}")

    dtstamp = format_dtstamp()
    lines.append(f"DTSTAMP:{dtstamp}")

    dtstart = get_dtstart(item)
    if dtstart:
        lines.append(f"DTSTART;VALUE=DATE:{dtstart}")

    rrule = build_rrule(item)
    if rrule:
        lines.append(f"RRULE:{rrule}")

    summary = escape_ics(item.get("title", ""))
    if summary:
        lines.append(f"SUMMARY:{summary}")

    description_parts = []
    date_text = item.get("date")
    if date_text:
        description_parts.append(str(date_text).strip())
    price = item.get("price")
    if price:
        description_parts.append(f"Price: {price}")
    registration = item.get("registrationDeadline") or item.get("registration")
    if registration:
        description_parts.append(f"Registration: {registration}")
    organizer = item.get("organizer")
    if organizer:
        contact = item.get("contact")
        if contact:
            description_parts.append(f"Organizer: {organizer} · {contact}")
        else:
            description_parts.append(f"Organizer: {organizer}")
    desc = item.get("desc")
    if desc:
        description_parts.append(str(desc).strip())
    whatsapp = item.get("whatsapp")
    if whatsapp:
        description_parts.append(f"WhatsApp: {whatsapp}")

    full_desc = "\n".join(description_parts)
    lines.append(f"DESCRIPTION:{escape_ics(full_desc)}")

    location = item.get("location")
    if location:
        lines.append(f"LOCATION:{escape_ics(location)}")

    lines.append(f"CATEGORIES:{escape_ics(category)}")

    lines.append("END:VEVENT")
    return "\n".join(lines)


def main():
    events = load_events()
    if not events:
        print("No events found.", file=sys.stderr)
        sys.exit(1)

    now = datetime.now(timezone.utc)
    dtstamp = now.strftime("%Y%m%dT%H%M%SZ")

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//4DASISTAS//Community Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:4DASISTAS Community Calendar",
        "X-WR-TIMEZONE:America/Toronto",
    ]

    for item, category in events:
        ics_lines.append(event_to_ics(item, category))

    ics_lines.append("END:VCALENDAR")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(ics_lines) + "\n")

    print(f"Generated {OUTPUT_FILE} with {len(events)} events.")


if __name__ == "__main__":
    main()
