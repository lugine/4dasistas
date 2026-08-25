# 4DASISTAS

A community calendar for Muslim women in the GTA — live at **https://4dasistas.ca**.

## How it works

- `index.html` — the entire website (vanilla HTML/CSS/JS, no build step)
- `data/*.json` — all content, one file per section
- `admin/` — Decap CMS point-and-click editor at `/admin` (DecapBridge auth,
  commits straight to this repo)
- `workers/src/worker.js` — the Cloudflare Worker that serves the site as
  static assets (`wrangler.toml`), plus `/editor` (session-gated raw JSON
  editor), `/api/data/:key`, and the daily email digest (`/api/subscribe`,
  sends via Resend on the 13:00 UTC cron)
- `scripts/generate_calendar.py` — generates `calendar.ics` from the event
  JSON files so people can subscribe in Google/Apple/Outlook Calendar
- `.github/workflows/` — daily Instagram trips scraper + calendar.ics
  regeneration on every data change

## Data files (all editable in the CMS)

| File | CMS tab |
|---|---|
| `sports.json` | Sports |
| `dayactivities.json` | Calendar Activities |
| `gatherings.json` | Calendar Functions |
| `trips.json` | Calendar Trips |
| `mosquegatherings.json` | Mosque Programs |
| `supportprograms.json` | Support Programs (feeds the Support Groups page) |
| `clubs.json` | 👯‍♀️ Gals Clubs |
| `resources.json` | 📔 Resources (cafes, shops, restaurants, health n beauty, mental health, small businesses, legal services) |
| `sitetext.json` | ✏️ Page Text |
| `maintenance.json` | 🛠️ Maintenance Mode |

## Security notes

- **`ADMIN_PASSWORD`** must be set as a Worker secret: `npx wrangler secret put ADMIN_PASSWORD`.
  Login **fails closed** — without the secret, nobody can log into `/editor`.
- **`RESEND_API_KEY`** Worker secret powers the daily "what's on today" email digest.
- **Google Maps API key** (hardcoded in `admin/index.html`) is client-side by necessity for
  the Places autocomplete widget. Restrict it in Google Cloud Console → APIs & Services → Credentials:
  1. *Application restrictions* → **HTTP referrers** → add `https://4dasistas.ca/*` and `https://www.4dasistas.ca/*`
  2. *API restrictions* → restrict to **Places API (New)** only
  3. Rotate the key if it leaks — it lives in git history

Every event needs a unique `id` (no spaces), a `title`, and an `eventDate`
(or recurring weekdays in `days`).

## ⚠️ Deploying

Pushing to `main` does **not** auto-deploy yet (see AGENT-COORDINATION.md).
Until Git integration is connected in the Cloudflare dashboard, deploy by hand:

    python3 scripts/build_content.py && python3 scripts/generate_calendar.py && npx wrangler deploy

**Tip:** set the dashboard Build command to `python3 scripts/build_content.py && python3 scripts/generate_calendar.py`
so the per-listing files in `data/calendar/` and `data/resources/` are merged into the
aggregate files the website reads on every deploy.

CMS edits commit to GitHub but won't appear on 4dasistas.ca until the deploy
above runs.

## Read this before editing

Multiple AI agents work in this repo concurrently. **Read
`AGENT-COORDINATION.md` first** — check Current Status, declare your own
IN PROGRESS, and log your change when done.
