# Agent Coordination — READ BEFORE EDITING

This repo is edited by multiple AI agents (Claude in chat, Kilo in VS Code,
Cline in VS Code, and a scheduled Claude Cowork task) plus Lujane directly.
To avoid silent conflicts, every agent follows this protocol.

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
- Add one entry to the top of the "Recent Activity Log": date, agent,
  files, one-line summary. Keep the last ~15 entries; trim older ones.
- Report to Lujane: files changed, commit SHA, what you tested, anything
  left open.

## Known regular actors

- **Claude (chat)** — primary builder, holds a GitHub PAT scoped to this
  repo, pushes via the GitHub API directly.
- **Kilo / Cline (VS Code)** — edit locally via Lujane's own git
  credentials.
- **Claude Cowork (scheduled task)** — runs on a timer, only ever touches
  `data/sports.json`, `data/gatherings.json`, `data/resources.json`
  (formerly also `data/organizations.json`, which was removed 2026-08-25).
  Never touches `index.html`, `admin/`, or `calendar.ics`. If you see
  unfamiliar entries in those files, that's almost certainly this task,
  not a bug.

---

## ⚠️ Live site deploys manually — this is the #1 thing to know

`4dasistas.ca` is served by a Cloudflare **Worker** named `4dasistas` (not
Cloudflare Pages). As of 2026-08-21, pushing to `main` does **not**
redeploy automatically — someone has to run `wrangler deploy` by hand, or
connect Git integration. This is what caused the "everything disappeared"
scare on 2026-08-21 — nothing was deleted, the live site was just frozen
on an old build.

**One-time fix (do this once, then every push auto-deploys):**
1. Cloudflare dashboard → Workers & Pages → `4dasistas` Worker → Settings → Build.
2. Connect the `lugine/4dasistas` GitHub repo, branch `main`.
3. Build command: `python3 scripts/generate_calendar.py`
4. Deploy command: `npx wrangler deploy` (`wrangler.toml` at repo root defines the asset deploy).
5. Save.

**Until that's connected**, deploy manually after any merge to `main`:
```
python3 scripts/generate_calendar.py
npx wrangler deploy
```

---

## Current Status

**Status:** IDLE
**Last updated by:** Cline agent (VS Code)
**Last updated:** 2026-08-25 (audit fixes round 2)

---

## Recent Activity Log

_(most recent first — add new entries to the top, trim past ~15)_

- 2026-08-25 — Cline (VS Code) — `admin/index.html` — HOTFIX (incidents): the Decap CDN pin to decap-cms@3.3.6 — a pre-existing uncommitted local edit that went out with 76d3594 — pointed at an npm version that doesn't exist → jsdelivr 404 → /admin rendered blank once Lujane deployed. Reverted to known-good unpkg ^3.0.0 (resolves to 3.15.1; verified HTTP 200 before pushing) in fb77649. Lesson recorded for all agents: never ship a changed CDN URL without curl -I'ing it first.

- 2026-08-25 — Cline (VS Code) — `workers/src/worker.js`, `index.html`, `data/sitetext.json`, `data/trips.json`, `README.md` — Audit fixes round 2 (Lujane picked all-A options): admin login now FAILS CLOSED when ADMIN_PASSWORD secret is unset (removed change-me-in-production fallback, added ?error=2 misconfiguration message), added dismissible on-page warning banner when any data/*.json fails to load (was console-only), replaced live 'Sample trips' placeholder copy in both sitetext.json and index.html fallback, backfilled tripType on all 12 untagged trips (2 domestic / 12 international), documented Google Maps API-key referrer-restriction steps + secrets in README Security notes. Mosque programs: all 21 undated entries are literally 'Date TBD' — nothing parseable into weekdays, left untouched rather than fabricating dates. Worker syntax + inline JS validated with node --check.
- 2026-08-25 — Cline (VS Code) — `BADMINTONLOGO.png` (deleted), `scripts/scrape_mosque_events.py` (deleted), `netlify.toml` (deleted), `.DS_Store` (untracked), `data/sports.json`, `data/clubs.json`, `admin/config.yml`, `README.md`, this file — Repo hygiene pass after an audit: removed orphaned root logo + dead mosque scraper script + unused Netlify config, untracked .DS_Store, stripped 4 legacy calDate:null keys (sports) and 8 empty calendarEvents keys (clubs), removed the dead nested club-calendar form from the CMS, rewrote README to match the actual Worker/Decap setup, deduped and trimmed this log to ~15 entries.
- 2026-08-25 — Cline (VS Code) — `data/resources.json`, `data/organizations.json` (deleted), `index.html`, `admin/config.yml`, `workers/src/worker.js` — Removed all 20 mosque listings and the organizations file/collection per Lujane's confirmed decision; resources now has exactly the 7 site categories. Cleaned every reference incl. worker editor dropdown; verified Promise.all destructure alignment via runtime sim. Git history retains both datasets. Flagged that Cowork's file list mentioned organizations.json.
- 2026-08-25 — Cline (VS Code) — `admin/config.yml`, `data/supportprograms.json` (new), `data/resources.json`, `index.html` — Restructured Decap CMS: Maintenance Mode, Page Text, six calendar tabs each on its own file (Sports / Calendar Activities / Calendar Functions / Calendar Trips / Mosque Programs / Support Programs) sharing ONE identical 29-field form via YAML anchor, Gals Clubs, Resources with labeled type select (Small Businesses = bakeries slug). Moved the 3 support groups into supportprograms.json; index.html tags them at load so the Support Groups page works unchanged. Fixed Healing Hearts duplicate category key.
- 2026-08-24 — Claude (chat) — `index.html`, `data/resources.json` — Merged Support Groups into Mental Health (isSupportGroup:true marker), added Mental Health Resources button on SG page; caught and fixed own mid-edit breakage before push.
- 2026-08-24 — Claude (chat) — `index.html`, `data/resources.json` — Built dedicated Support Groups page (split list/calendar view, own mini-calendar), added calDate to SG entries + Eldest Daughters event.
- 2026-08-24 — Claude (chat) — `index.html`, `data/gatherings.json`, `data/mosquegatherings.json`, `data/resources.json` — Moved ISNA Youth Book Club to functions, added ISNA High Park Picnic, removed clubs sub-category from Events calendar, created Support Groups resources category with Healing Hearts entry.
- 2026-08-24 — Claude (chat) — `data/gatherings.json` — Added AHC Community BBQ (Aug 29).
- 2026-08-24 — Claude (chat) — `data/sports.json`, `data/dayactivities.json`, `data/mosquegatherings.json` — Added 5 real events from Instagram captions; flagged 2 unverifiable ones to Lujane rather than guessing.
- 2026-08-24 — Claude (chat) — `index.html`, `data/resources.json` — Added 3 restaurants/cafes, softened calendar colors per Lujane preference, built Small Businesses grid with instagramPost embed support.
- 2026-08-24 — Claude (chat) — `index.html`, `data/resources.json`, `admin/config.yml` — Made ownedBy required, renamed Cafes chip to Cafe & Desserts, added Kunafa King + Carousel Cafe & Bistro with owner names, flagged unresolvable owners instead of guessing.
- 2026-08-23 — GitHub Copilot — `index.html` — Centered Home Screen tile, tightened Mental Health spacing, baby-blue globe container, pastel globe material, light-pink suggest button.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/resources.json` — Tightened MH cards, Legal Services list-only, separated Mosque Programs into its own Calendar category, stabilized Travel globe/list layout.
- 2026-08-22 — GitHub Copilot — `index.html` — Repaired black Travel globe (pastel material applied post-creation), restored permanent trip list, matched footer to logo background.
- 2026-08-22 — GitHub Copilot — `index.html`, `data/clubs.json` — Added Travel tab, live search suggestions, circular club icons, Field club rename, FAQ label, mosque programming split into Activities/Resources as Mosque Programs.
