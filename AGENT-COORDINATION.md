# Agent Coordination — READ BEFORE EDITING

This repo is edited by multiple AI agents (Claude in chat, Kilo in VS Code,
and a scheduled Claude Cowork task) plus Lujane directly. To avoid silent
conflicts, every agent — regardless of which tool it is — follows this
protocol.

## Before you touch anything

1. **Pull `main` fresh.** Never work from a copy fetched earlier in your
   own session — another agent may have committed since then.
2. **Read the "Current Status" section below.** If another agent shows
   `IN PROGRESS` on a file you need to touch, stop and flag it to Lujane
   instead of editing anyway.
3. **Update "Current Status" to declare yourself IN PROGRESS** before you
   start editing, listing exactly which files.

## While working

- Keep changes small and scoped to the actual task. Don't refactor,
  rename, or restructure things that weren't asked for.
- Don't touch another agent's in-progress files.
- Test before committing (JSON validity, JS syntax, YAML validity —
  whichever applies).

## After committing

- Update "Current Status" back to `IDLE`.
- Add one line to the "Recent Activity Log" below: date, agent, files,
  one-line summary. Keep the last ~15 entries; trim older ones.
- Report to Lujane: files changed, commit SHA, what you tested, anything
  left open.

## Known regular actors

- **Claude (chat)** — primary builder, holds a GitHub PAT scoped to this
  repo, pushes via the GitHub API directly.
- **Kilo (VS Code)** — edits locally via Lujane's own git credentials.
- **Claude Cowork (scheduled task)** — runs on a timer, only ever touches
  `data/sports.json`, `data/gatherings.json`, `data/organizations.json`,
  `data/resources.json`. Never touches `index.html`, `admin/`, or
  `calendar.ics`. If you see unfamiliar entries in those 4 files, that's
  almost certainly this task, not a bug.

---

## Current Status

**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-20

*(Whoever starts work next: change this to IN PROGRESS, your name, the
files you're touching, and a timestamp. Change back to IDLE when done.)*

**2026-08-20 — Claude (chat) — manual research run (data/trips.json, data/organizations.json)** — Since the automated scheduled task's GitHub write access is confirmed broken (known Anthropic bug, issue anthropics/claude-ai-mcp#822 — reads succeed, writes 403), ran the same research manually via web search instead. Checked ~8 of the 24 known accounts (no Instagram browsing available in this session, website/search only). Found several already covered by an earlier successful automated run (OnePath Travel, Sisters Getaway, another MWTG trip already present) — good sign that run worked at least once. Added: 1 new trip (MWTG Jordan) + 1 new organization (Sister's Circle TO), both verified via official websites. Explicitly did NOT add @muslim.hikers despite it being a real account — confirmed UK-based (Active Inclusion Network), not GTA-relevant. ~16 of 24 accounts + small business research still not covered this pass — recommend another manual run to continue, or fixing the scheduled task per the linked bug.

**2026-08-20 — Claude (chat) — `data/maintenance.json`, `index.html`, `admin/config.yml`** — Added a self-contained maintenance mode: a full-screen "be right back" overlay that's deliberately isolated from the rest of the app code (so it still works even if something else breaks), plus a one-click CMS toggle to turn it on/off. Tested with a runtime DOM simulation, confirmed no crash and correct default-hidden state.

**2026-08-19 (later) — Claude (chat) — `admin/config.yml`** — Fixed a YAML indentation bug (2 lines with 15 spaces instead of 14 in the trips collection) that broke the entire CMS config parser. Confirmed valid YAML after fix, pushed as commit 312d084530e3.

**2026-08-19 16:12 — Kilo (VS Code) — `index.html`** — Investigating reported broken interactivity on live site. Pulled latest `origin/main`, read AGENT-COORDINATION.md, confirmed Claude (chat) already fixed the JS syntax/Promise.all bug in `b0b7a46`. Live site HTML now matches fixed local `index.html` exactly (no diff). Likely remaining issue is Cloudflare cache serving stale pre-fix version. No code changes made.

**2026-08-19 16:25 — Kilo (VS Code) — `index.html`** — Implemented side list panel in Resources map view: clicking a category marker shows all locations of that type in a left-side list. Added CSS for `.resource-map-wrapper` layout, modified `renderResourceMap()` to include side list container, marker click handlers to populate list by category, and close button. Tested JS syntax balance. Completed.

**2026-08-19 19:30 — Kilo (VS Code) — `index.html`, `manifest.webmanifest`, `OFFICIAL LOGO.png`** — Added "Add to Home Screen" tab and instructions page. Wired repo logo into Chrome tab icon, Apple touch icons, and PWA manifest. Added home tile for homescreen instructions. Updated icon references to use `OFFICIAL LOGO.png`.

**2026-08-19 19:50 — Kilo (VS Code) — `index.html`** — Removed "Add to Home Screen" from top horizontal tabs, added colored background bar behind tab navigation, made 4DASISTAS headline clickable to return to homepage. Completed.

**2026-08-20 — Kilo (VS Code) — `index.html`, `data/resources.json`, `data/trips.json`, `scripts/generate_calendar.py`, `scripts/scrape_instagram_trips.py`, `calendar.ics`, `.github/workflows/regenerate-calendar.yml`, `.github/workflows/daily-instagram-scrape.yml`, `workers/src/worker.js`, `workers/wrangler.toml`, `workers/package.json`, `workers/README.md`, `AGENT-COORDINATION.md`** — Completed calendar subscription selection page with category checkboxes and client-side ICS download. Added Beauty & Care resource category with 3 entries. Reordered Resources view toggle to List | Small Businesses | Map (map default). Added 5 trips from IG accounts (ISNA Food Festival, MWTG Oman, OnePath Kyrgyzstan, Sakinah Cappadocia, Sisters Getaway Morocco). Added SEO meta/OG tags and canonical URL. Added desktop layout media query (min-width: 768px). Added alternate calendar row banner colors (row-even/row-odd). Created scripts/generate_calendar.py to auto-generate calendar.ics from JSON data files (12 events). Created GitHub Action to regenerate calendar.ics on data changes and daily schedule. Created daily Instagram scraping script with GitHub Actions workflow. Created Cloudflare Worker tab editor (workers.dev) with KV store binding and simple admin UI at /editor. Validated JS and JSON. Pushed to origin/main.

---

## Recent Activity Log

_(most recent first — add new entries to the top)_

- 2026-08-19 — Claude (chat) — `index.html` — Fixed JS syntax error + destructuring/Promise.all positional bug from the mosqueGatherings insertion that broke all click interactions site-wide.
- 2026-08-19 — Kilo (VS Code) — `index.html`, `service-worker.js`, `manifest.webmanifest`, `app-icon.svg`, `assets/`, `data/mosquegatherings.json`, `data/smallbusinesses.json`, `admin/config.yml` — Added PWA support (installable app, service worker), new "Small Businesses" resource view + CMS collection, new mosque-specific gatherings category.
- 2026-08-19 — Claude (chat) — `index.html` — Added Home tab (landing page), Rules tab (community guidelines), Clubs changed to stacked layout.
- 2026-08-19 — Kilo (VS Code) — `index.html`, `manifest.webmanifest`, `OFFICIAL LOGO.png` — Added "Add to Home Screen" tab with instructions, wired new logo into favicon/PWA icons.
- 2026-08-19 — Kilo (VS Code) — `index.html` — Removed "Add to Home Screen" from top tabs, added tab bar background color, made headline clickable to home.
