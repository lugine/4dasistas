#!/usr/bin/env python3
"""
Apply CMS 'moveTo' relocations between calendar tabs.

Editors can set the "Move this event to another tab?" field on any listing;
this script performs the official move: it removes the item from its current
data file and appends it to the target one, then clears the field. Run on
every build/commit so moves land automatically:

    python3 scripts/apply_event_moves.py [--dir PATH]

Safe to run repeatedly - idempotent, and exits 0 with no changes when there
is nothing to move.
"""
import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
DATA_DIR = os.path.join(BASE_DIR, 'data')
if '--dir' in args:
    DATA_DIR = args[args.index('--dir') + 1]

# section key -> data file (mirrors the six CMS calendar tabs)
SECTION_FILES = {
    'sports': 'sports.json',
    'activities': 'dayactivities.json',
    'functions': 'gatherings.json',
    'trips': 'trips.json',
    'mosqueprograms': 'mosquegatherings.json',
    'supportprograms': 'supportprograms.json',
}
FILE_SECTION = {v: k for k, v in SECTION_FILES.items()}


def load(fname):
    with open(os.path.join(DATA_DIR, fname), encoding='utf-8') as fh:
        return json.load(fh)


def save(fname, data):
    with open(os.path.join(DATA_DIR, fname), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write('\n')


def main():
    if not os.path.isdir(DATA_DIR):
        print(f'data dir not found: {DATA_DIR}')
        return 1
    moved = []
    for fname, section in FILE_SECTION.items():
        path = os.path.join(DATA_DIR, fname)
        if not os.path.exists(path):
            continue
        data = load(fname)
        changed = False
        keep = []
        for item in data.get('items', []):
            target = item.get('moveTo')
            if target and target in SECTION_FILES and target != section:
                item.pop('moveTo', None)
                moved.append((item.get('id', '?'), section, target))
                target_file = SECTION_FILES[target]
                target_data = load(target_file) if os.path.exists(os.path.join(DATA_DIR, target_file)) else {'items': []}
                existing_ids = {i.get('id') for i in target_data.get('items', [])}
                if item.get('id') not in existing_ids:
                    target_data['items'].append(item)
                    save(target_file, target_data)
                changed = True
            else:
                if 'moveTo' in item:
                    # blank / unknown value: just clean the field up
                    del item['moveTo']
                    changed = True
                keep.append(item)
        if changed:
            data['items'] = keep
            save(fname, data)
    if moved:
        for item_id, src, dst in moved:
            print(f'moved {item_id}: {src} -> {dst}')
    else:
        print('no pending event moves')
    return 0


if __name__ == '__main__':
    sys.exit(main())
