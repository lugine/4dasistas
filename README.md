# 4DASISTAS — Setup Guide

Your site pulls its content from small JSON files in `/data`, and there's
a real point-and-click editor built in at `/admin`. Here's how to get it live.

## What's in this folder

```
index.html                ← the actual website
data/                      ← all editable content, one file per section
  sports.json
  gatherings.json
  dayactivities.json
  trips.json
  clubs.json
  organizations.json
  resources.json
  mosquegatherings.json
admin/
  index.html               ← the content editor (Decap CMS)
  config.yml                ← defines the edit form fields
scripts/
  generate_calendar.py      ← generates calendar.ics from the JSON data
netlify.toml                ← not used on Cloudflare; see steps below
```

## One-time setup (about 15 minutes)

**1. Put this on GitHub**
Create a free GitHub account if you don't have one, make a new repository
(e.g. `4dasistas-site`), and upload every file in this folder to it —
keep the folder structure exactly as-is.

**2. Connect it to Cloudflare Pages**
In Cloudflare Pages, "Create a project" → "Connect to Git" → pick your repo.
Set:
- **Build command**: `python3 scripts/generate_calendar.py`
- **Build output directory**: `.` (a single dot, meaning the repo root)
Leave environment variables blank.
Deploy — you'll get a live `4dasistas.pages.dev` link.

**3. Point your domain at it**
In Cloudflare DNS for 4dasistas.ca / WHC.ca:
- Add a **CNAME** record pointing your domain/subdomain to `4dasistas.pages.dev`
  (or whatever your Pages project name is).
- Or, in Cloudflare Pages → **Custom domains**, add your domain and follow
  the verification steps.

**4. Turn on Decap CMS with Decap Bridge**
In your Cloudflare Pages project dashboard:
- Go to **Settings → Functions** and make sure Functions are enabled.
- Go to **Settings → Git integrations** (or **Deployments**) and enable
  **Decap Bridge**.
- Follow the prompts to set a bridge secret if asked.
- The bridge will create a proxy path (usually `/_bridges/decaptest` or
  similar) that lets the CMS talk to your repo through Cloudflare.

Then update `admin/config.yml` so the CMS backend points to the bridge path
instead of `testLocal`:

```yaml
backend:
  name: decaptest
  branch: main
```

**5. Start editing**
Go to `https://4dasistas.ca/admin/` (or your Pages URL + `/admin/`),
log in with your GitHub/Cloudflare identity, and you'll see a real editor —
click into any Sport, Gathering, Trip, Club, Organization, or Mosque Gathering
listing, change the text, hit **Publish**. It commits to GitHub and Cloudflare
redeploys automatically within a minute or two.

**How the calendar subscription works**
The `calendar.ics` file is generated automatically during every Cloudflare
Pages deploy from the current JSON data. When you add, edit, or remove an
event in Decap CMS and publish, the next deploy regenerates `calendar.ics`
automatically. Calendar subscribers (Google Calendar, Apple Calendar, Outlook)
will pick up the updated feed the next time they refresh.

## Notes

- Every item needs a unique **ID** field (letters/numbers/dashes, no spaces) —
  this is just an internal key, not shown on the site.
- For recurring items (like badminton), set **Recurring weekdays**. For
  one-off dated things (trips, day activities, mosque gatherings), set
  **Calendar date** instead (format: `2026-09-14`).
- For recurring events without a specific start date in the CMS, the ICS
  generator uses a stable reference date so calendar apps show the weekly
  pattern correctly.
- If you ever want a daily automatic refresh of mosque events from local
  mosque websites on top of this, there's a scraper script in
  `scripts/scrape_mosque_events.py` — this CMS and that are independent of
  each other, so you can add it anytime.
