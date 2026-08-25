#!/usr/bin/env python3
"""
Build the aggregate data/*.json files from per-item CMS content folders.

Reads:   data/calendar/<slug>.json   (each has a "section" field)
         data/resources/<slug>.json  (each has a "category" field)
Writes:  data/sports.json, dayactivities.json, gatherings.json, trips.json,
         mosquegatherings.json, supportprograms.json, resources.json

Also auto-fills `tag` with the event title for Activities/Functions items
that have no tag, so editors never need to maintain tags manually.

Run on every build:  python3 scripts/build_content.py
"""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'data')
CAL_DIR = os.path.join(DATA, 'calendar')
RES_DIR = os.path.join(DATA, 'resources')

# section -> legacy aggregate filename (what the website + calendar read)
SECTION_FILES = {
    'sports': 'sports.json',
    'activities': 'dayactivities.json',
    'functions': 'gatherings.json',
    'trips': 'trips.json',
    'mosqueprograms': 'mosquegatherings.json',
    'supportprograms': 'supportprograms.json',
}

AUTO_TAG_SECTIONS = {'activities', 'functions'}


def load_folder(folder):
    if not os.path.isdir(folder):
        return []
    out = []
    for name in sorted(os.listdir(folder)):
        if not name.endswith('.json'):
            continue
        with open(os.path.join(folder, name), encoding='utf-8') as fh:
            item = json.load(fh)
        # Keep the item's existing id when present (migrated content); fall
        # back to the filename stem so brand-new CMS entries get one.
        if not item.get('id'):
            item['id'] = os.path.splitext(name)[0]
        out.append(item)
    return out


def main():
    cal_items = load_folder(CAL_DIR)
    buckets = {sec: [] for sec in SECTION_FILES}
    for item in cal_items:
        sec = item.get('section')
        if sec not in buckets:
            print(f'WARNING: unknown section {sec!r} on {item.get("id")}')
            continue
        if sec in AUTO_TAG_SECTIONS and not item.get('tag'):
            item['tag'] = item.get('title') or ''
        buckets[sec].append(item)

    for sec, fname in SECTION_FILES.items():
        items = sorted(buckets[sec], key=lambda i: str(i.get('id')))
        with open(os.path.join(DATA, fname), 'w', encoding='utf-8') as fh:
            json.dump({'items': items}, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
        print(f'{fname}: {len(items)} items')

    res_items = load_folder(RES_DIR)
    res_items.sort(key=lambda i: str(i.get('id')))
    with open(os.path.join(DATA, 'resources.json'), 'w', encoding='utf-8') as fh:
        json.dump({'items': res_items}, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
    print(f'resources.json: {len(res_items)} items')


if __name__ == '__main__':
    main()
