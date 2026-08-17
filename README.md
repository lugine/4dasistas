# 4DASISTAS — Setup Guide

Your site now pulls its content from small JSON files in `/data`, and there's
a real point-and-click editor built in at `/admin`. Here's how to get it live.

## What's in this folder

```
index.html          ← the actual website
data/                ← all editable content, one file per section
  sports.json
  gatherings.json
  dayactivities.json
  trips.json
  clubs.json
  organizations.json
  resources.json
admin/
  index.html         ← the content editor (Decap CMS)
  config.yml          ← defines the edit form fields — don't need to touch this
```

## One-time setup (about 15 minutes)

**1. Put this on GitHub**
Create a free GitHub account if you don't have one, make a new repository
(e.g. `4dasistas-site`), and upload every file in this folder to it —
keep the folder structure exactly as-is.

**2. Connect it to Netlify**
In Netlify, "Add new site" → "Import from Git" → pick this repo.
Leave the build settings blank (no build command, publish directory = root `/`).
Deploy — you'll get a live `something.netlify.app` link.

**3. Point 4dasistas.ca / WHC.ca at it**
Same DNS steps as before — add Netlify's A/CNAME records in WHC's DNS panel.

**4. Turn on the editor**
In your Netlify site dashboard:
- Go to **Site configuration → Identity** → click **Enable Identity**
- Under Identity → **Registration**, set it to **Invite only** (so random
  people can't sign up as editors)
- Under Identity → **Services → Git Gateway**, click **Enable Git Gateway**
- Still in Identity, click **Invite users** and invite your own email —
  you'll get an email to set a password

**5. Start editing**
Go to `https://4dasistas.ca/admin/` (or your Netlify URL + `/admin/`),
log in with the account you just invited, and you'll see a real editor —
click into any Sport, Gathering, Trip, Club, Organization, or Shop/Food
listing, change the text, hit **Publish**. It commits to GitHub and Netlify
redeploys automatically within a minute or two.

## Notes

- Every item needs a unique **ID** field (letters/numbers/dashes, no spaces) —
  this is just an internal key, not shown on the site.
- For recurring items (like badminton), set **Recurring weekdays**. For
  one-off dated things (trips, day activities), set **Calendar date** instead
  (format: `2026-09-14`).
- If you ever want a daily automatic refresh of org info from Instagram on
  top of this, that's the Claude Cowork scheduled-task setup we talked about
  earlier — this CMS and that are independent of each other, so you can add
  it anytime.
