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
**Last updated:** 2026-08-19

*(Whoever starts work next: change this to IN PROGRESS, your name, the
files you're touching, and a timestamp. Change back to IDLE when done.)*

**2026-08-19 16:12 — Kilo (VS Code) — `index.html`** — Investigating reported broken interactivity on live site. Pulled latest `origin/main`, read AGENT-COORDINATION.md, confirmed Claude (chat) already fixed the JS syntax/Promise.all bug in `b0b7a46`. Live site HTML now matches fixed local `index.html` exactly (no diff). Likely remaining issue is Cloudflare cache serving stale pre-fix version. No code changes made.

**2026-08-19 16:25 — Kilo (VS Code) — `index.html`** — Implemented side list panel in Resources map view: clicking a category marker shows all locations of that type in a left-side list. Added CSS for `.resource-map-wrapper` layout, modified `renderResourceMap()` to include side list container, marker click handlers to populate list by category, and close button. Tested JS syntax balance. Completed.

---

## Recent Activity Log

_(most recent first — add new entries to the top)_

- 2026-08-19 — Claude (chat) — `index.html` — Fixed JS syntax error + destructuring/Promise.all positional bug from the mosqueGatherings insertion that broke all click interactions site-wide.
- 2026-08-19 — Kilo (VS Code) — `index.html`, `service-worker.js`, `manifest.webmanifest`, `app-icon.svg`, `assets/`, `data/mosquegatherings.json`, `data/smallbusinesses.json`, `admin/config.yml` — Added PWA support (installable app, service worker), new "Small Businesses" resource view + CMS collection, new mosque-specific gatherings category.
- 2026-08-19 — Claude (chat) — `index.html` — Added Home tab (landing page), Rules tab (community guidelines), Clubs changed to stacked layout.
