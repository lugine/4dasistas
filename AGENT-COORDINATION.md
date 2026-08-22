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

## ⚠️ Live site deploys manually — this is the #1 thing to know

`4dasistas.ca` is served by a Cloudflare **Worker** named `4dasistas`
(not Cloudflare Pages, despite what the old setup steps below say).
As of 2026-08-21, pushing to `main` does **not** redeploy it automatically —
someone has to run `wrangler deploy` by hand, or connect Git integration
(one-time dashboard step, see below). **This is why fixes that get merged
into `main` don't show up on the live site**, and it's what caused the
"everything disappeared" scare on 2026-08-21 — nothing was actually
deleted, the live site was just frozen on a build from 2026-08-20.

**One-time fix (do this once, then every push auto-deploys):**
1. In the Cloudflare dashboard, go to Workers & Pages → the `4dasistas`
   Worker → **Settings → Build**.
2. Connect it to the `lugine/4dasistas` GitHub repo, branch `main`.
3. Build command: `python3 scripts/generate_calendar.py`
4. Deploy command: `npx wrangler deploy` (default — `wrangler.toml` at the
   repo root now defines the asset deploy, added 2026-08-21).
5. Save. Every future push to `main` will build + deploy within a minute
   or two, same as Cloudflare Pages used to.

**Until that's connected**, deploy manually from the repo root after any
merge to `main`:
```
python3 scripts/generate_calendar.py
npx wrangler deploy
```

---

## Current Status

**Status:** IDLE
**Last updated by:** GitHub Copilot
**Last updated:** 2026-08-22

*(Whoever starts work next: change this to IN PROGRESS, your name, the
files you're touching, and a timestamp. Change back to IDLE when done.)*

**2026-08-21 (later) — Claude (chat) — `wrangler.toml`, `.assetsignore`, `AGENT-COORDINATION.md`** — Investigated Lujane's report that 4dasistas.ca shows a stuck "Loading…" screen and that events/resources/clubs had "disappeared," with fear that an agent had deleted data. **Data was never touched** — checked `data/*.json` directly (167 items total) and full git history (only additions, never a bulk removal). The real cause: `4dasistas.ca` is served by a Cloudflare **Worker** named `4dasistas` (confirmed via the Cloudflare account's Workers list — `created_on: 2026-08-18`, `modified_on: 2026-08-20`) that has never been redeployed since 2026-08-20, so it's still running the pre-fix code from before this session's two earlier commits (31491db, 5af9156) — that's the stuck-loading crash Lujane saw, not a data loss. Confirmed live vs. repo mismatch by diffing `curl https://4dasistas.ca/` against `git show HEAD:index.html` — live is missing everything from 2026-08-20 onward, including the entire maintenance-mode feature. **This has nothing to do with Cloudflare Pages** despite `README.md`'s setup steps describing Pages — the domain was never on Pages, or was moved off it at some point; either way Pages is being phased out in favor of "Workers Builds" Git integration anyway. Added `wrangler.toml` (serves the whole repo as static assets on the existing `4dasistas` Worker, so the custom domain binding is preserved) and `.assetsignore` (keeps internal files like `workers/`, `scripts/`, `.github/` out of the public asset bundle). Added a prominent warning + one-time setup steps at the top of this file so this doesn't happen a third time. **Still needs a human to do the actual dashboard connection** (Settings → Build → connect GitHub repo) — no available tool can do that step; see instructions above.

**2026-08-21 — Claude (chat) — `index.html`, `service-worker.js`** — Root-caused "calendar stuck loading / all events, resources, clubs gone": `fetchDataWithFallback()` in `index.html` was hitting `https://4dasistas-editor.luginealdimasi.workers.dev/api/data/:key` first (a domain that doesn't exist — `net::ERR_NAME_NOT_RESOLVED`) before falling back to the local `data/*.json` files. That Worker's KV store (`workers/src/worker.js`, deployed at whatever the real `4dasistas-editor.*.workers.dev` subdomain is) is a **second, never-synced copy** of the site content, separate from the `data/*.json` files Decap CMS actually edits — two sources of truth is why content kept vanishing/reappearing depending on which agent touched what. **Fix: removed the Worker fetch entirely** — `index.html` now reads `data/*.json` directly, matching the documented Decap CMS setup in `README.md`. Also hardened `service-worker.js`: bumped cache to `v3` (so browsers with the old broken version cached drop it on next visit) and stopped it from serving the cached homepage HTML as a fallback for failed `data/*.json` fetches (was previously falling back to `caches.match('/')` for *any* failed request, which could hand back HTML where JSON was expected). Verified locally: all data loads with zero network delay, Calendar/Clubs/Resources tabs all populate correctly. **The `workers/` Cloudflare Worker + KV editor is now unused by the live site** — if it's wanted going forward as a second CMS, it needs a plan to stay in sync with `data/*.json`, not fetched-first client-side. Left `workers/` and `admin/config.yml`'s `site_url`/`display_url` (still pointing at the wrong `luginealdimasi` domain, cosmetic only, used for Decap preview links) untouched — flagging for Lujane to confirm the real production domain before anyone edits those.

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

- 2026-08-22 — GitHub Copilot — `index.html`, `data/resources.json`, `admin/config.yml` — Added Legal Services, made Resource filters symmetrical, made Mental Health a square-card list without a map, added Canadian Muslim Counselling, Ruh Care, and Salam Psychology from official websites, and corrected Majestic Thobe/Sitti map coordinates.
- 2026-08-22 — GitHub Copilot — `index.html`, `manifest.webmanifest`, `assets/OFFICIAL LOGO.png` — Switched browser/PWA branding to the new assets logo, replaced the footer “Not a cult. Yet.” text with the supplied logo, and matched the footer background to the logo backdrop.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/clubs.json`, `admin/config.yml` — Refined mobile homepage arrows and heading spacing, renamed the Calendar tile, made Home Screen lighter, added editable per-club calendars and a Calendar CLUBS category, made club cards open their own calendar, changed Travel to globe plus list, and restyled the globe with pastel material and dramatic colored rings.
- 2026-08-22 — GitHub Copilot — `index.html` — Fixed the Calendar Mosque Programs handoff so Resources becomes visibly active, a top-left Back to Calendar control appears, and the originating Calendar context is preserved.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/resources.json` — Made Calendar open to All Events calendar view, routed Calendar Trips to Travel, changed homepage to a responsive 2-column grid, matched search styling to buttons, tightened club spacing, and moved Orda/Dera family ownership and Menaal details into `ownedBy`.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/gatherings.json`, `data/trips.json`, `data/resources.json`, `data/smallbusinesses.json`, `admin/config.yml` — Moved ISNA Street Food Festival to Functions, split Activities and Functions, made Travel open to the Earth view, added live navigation search and resource indexing, added Mental Health and Bakeries, moved Cozy Crumb Maya, removed Small Businesses, and separated Mosque Programs from mosque locations.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/clubs.json` — Added the Travel tab, live search suggestions, circular club icons, Field club rename, FAQ label, full-width event filters, reordered footer actions, and moved mosque programming into Activities and Resources as Mosque Programs.
- 2026-08-22 — GitHub Copilot — `index.html` — Replaced the flat trip Leaflet map with an interactive Globe.gl 3D Earth view, retaining trip markers and the calendar-sized responsive container; validated JavaScript syntax and globe wiring.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/clubs.json`, `data/resources.json`, `assets/adhd.png`, `assets/FIELD.png`, `calendar.ics` — Reconciled the latest remote commits, completed the search/trip-view/mobile UI wiring, corrected the ADHD asset path, cleaned resource ownership fields, and validated the deployable site.
- 2026-08-19 — Claude (chat) — `index.html` — Fixed JS syntax error + destructuring/Promise.all positional bug from the mosqueGatherings insertion that broke all click interactions site-wide.
- 2026-08-19 — Kilo (VS Code) — `index.html`, `service-worker.js`, `manifest.webmanifest`, `app-icon.svg`, `assets/`, `data/mosquegatherings.json`, `data/smallbusinesses.json`, `admin/config.yml` — Added PWA support (installable app, service worker), new "Small Businesses" resource view + CMS collection, new mosque-specific gatherings category.
- 2026-08-19 — Claude (chat) — `index.html` — Added Home tab (landing page), Rules tab (community guidelines), Clubs changed to stacked layout.
- 2026-08-19 — Kilo (VS Code) — `index.html`, `manifest.webmanifest`, `OFFICIAL LOGO.png` — Added "Add to Home Screen" tab with instructions, wired new logo into favicon/PWA icons.
- 2026-08-19 — Kilo (VS Code) — `index.html` — Removed "Add to Home Screen" from top tabs, added tab bar background color, made headline clickable to home.
