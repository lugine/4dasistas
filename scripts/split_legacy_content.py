#!/usr/bin/env python3
"""
ONE-TIME migration: split legacy aggregate files into per-item files.

data/sports.json etc.  ->  data/calendar/<id>.json (with a section field)
data/resources.json    ->  data/resources/<id>.json

Run once:  python3 scripts/split_legacy_content.py
"""
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'data')
CAL_DIR = os.path.join(DATA, 'calendar')
RES_DIR = os.path.join(DATA, 'resources')

SECTIONS = {
    'sports.json': 'sports',
    'dayactivities.json': 'activities',
    'gatherings.json': 'functions',
    'trips.json': 'trips',
    'mosquegatherings.json': 'mosqueprograms',
    'supportprograms.json': 'supportprograms',
}


def slugify(text):
    s = re.sub(r'[^a-z0-9]+', '-', str(text).lower()).strip('-')
    return s[:80] or 'item'


os.makedirs(CAL_DIR, exist_ok=True)
os.makedirs(RES_DIR, exist_ok=True)

counts = {}
used_stems = {}

def unique_path(folder, stem):
    used = used_stems.setdefault(folder, set())
    candidate = stem
    n = 2
    while candidate in used:
        candidate = f'{stem}-{n}'
        n += 1
    used.add(candidate)
    return os.path.join(folder, candidate + '.json')

for fname, section in SECTIONS.items():
    src = os.path.join(DATA, fname)
    if not os.path.exists(src):
        print(f'skip (missing): {fname}')
        continue
    items = json.load(open(src, encoding='utf-8'))['items']
    for item in items:
        item.pop('moveTo', None)
        item['section'] = section
        stem = slugify(item.get('id') or item.get('title'))
        path = unique_path(CAL_DIR, stem)
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(item, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
    counts[fname] = len(items)

res_src = os.path.join(DATA, 'resources.json')
res_items = json.load(open(res_src, encoding='utf-8'))['items']
for item in res_items:
    stem = slugify(item.get('id') or item.get('title'))
    path = unique_path(RES_DIR, stem)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(item, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
counts['resources.json'] = len(res_items)

print(json.dumps(counts))
