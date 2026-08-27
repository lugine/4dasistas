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
3. Build command: `python3 scripts/build_content.py && python3 scripts/generate_calendar.py`
   **(both scripts, in that order — build_content.py merges the per-entry
   `data/calendar/*.json` / `data/resources/*.json` files the CMS writes
   into the aggregate `data/*.json` files this site actually reads. Skip
   it and every new CMS entry silently never shows up on the live site —
   this is exactly what happened 2026-08-25, see the log entry below.)**
4. Deploy command: `npx wrangler deploy` (`wrangler.toml` at repo root defines the asset deploy).
5. Save.

**Until that's connected**, deploy manually after any merge to `main`:
```
python3 scripts/build_content.py
python3 scripts/generate_calendar.py
npx wrangler deploy
```

---

## Current Status

**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-27 (3-day mobile view)

**2026-08-27 (3-day mobile view) — Claude (chat) — `index.html`** — Made mobile Week view show 3 days at once instead of 2. Root cause: .week-day-col had a fixed 150px width regardless of screen size. Added a mobile-only override narrowing it to 105px (desktop untouched). Confirmed .today-event already has a block-layout override specifically for week-day-col context on mobile, so the narrower column doesn't fight with a fixed-width sub-element.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-27 (swipe simplified)

**2026-08-27 (swipe simplified) — Claude (chat) — `index.html`** — Lujane reported the animated swipe I just built caused runaway repeated jumps ('keeps going and going'). Found the actual bug: the previous version used a 180ms setTimeout before updating state, creating a window where a second quick swipe (very likely, given the first gave no clear feedback) could schedule an overlapping second state update, stacking jumps. Reverted to a simple, immediate (no-delay) swipe with no CSS drag animation - removes that whole bug class. Also fixed the step size: swipe now always moves by exactly 1 day regardless of Day/Week view mode (was jumping 7 days at once in week view, which is what actually prompted her original report - she wanted to see 'just the next two days', not skip a whole week). Arrow buttons still use the day/week-aware step size, unchanged, since that wasn't part of the complaint.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-27 (slider swipe)

**2026-08-27 (slider swipe) — Claude (chat) — `index.html`** — Fixed the What's On Today/Week swipe feeling broken (swipe would show a flash of movement then snap back with no clear feedback). Root cause: there was no touchmove handling at all - nothing visually happened until touchend, when a full silent re-render occurred if the threshold was met, or literally nothing if not - the 'movement then snap back' Lujane described was likely the browser's own default touch-bounce filling that gap. Built a real drag-following slider: live transform+opacity feedback during touchmove (locked to horizontal only, so vertical page scroll still works normally), smooth animated snap-back if released short of the 45px threshold, smooth slide-out-and-refresh if the swipe completes. Not yet live-tested on an actual phone - flagged to Lujane to verify on her device given touch gesture behavior is hard to fully validate without one.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-27 (location display bug)

**2026-08-27 (location display bug) — Claude (chat) — `admin/index.html`** — Investigated Lujane's report of location/time appearing to reset when reopening entries. Checked raw data for 2 recently-edited entries directly (pickleball-pilates, she-travels-hike) - location AND time were both genuinely saved correctly, no real data loss confirmed. Found and fixed the actual cause for location: my custom Google Places widget was swapping to a freshly-created, empty search box once Google Maps finished loading, hiding the input that correctly displayed the saved value underneath - a real display bug I introduced, not a save failure. Fixed by always showing 'Currently saved: X' clearly regardless of load state. Did not find evidence of a similar bug affecting Time specifically (uses Decap's native datetime widget, unrelated to my custom code, and the 2 checked entries had correct time values) - if Lujane still sees time resetting after this fix, need a specific entry ID to investigate further.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-26 (sport sub-filter cross-list)

**2026-08-26 (sport sub-filter cross-list) — Claude (chat) — `index.html`, `admin/config.yml`, `data/calendar/pickleball-pilates.json`** — Found the actual cause of the weird 'pickleball, pilates' combined filter chip: someone put both sport names as one comma-separated string directly into Sport Key, which only supports a single value and drives the sub-filter chip list directly from raw values. This is a genuinely different mechanism from the top-level alsoShowIn cross-listing built earlier (that's for Sports vs Activities vs Trips etc, not for sub-filters WITHIN Sports like Pickleball vs Pilates). Built the missing piece: new alsoSportKeys field (simple string list) for sub-filter-level cross-listing. Fixed the specific event (sportKey:pickleball, alsoSportKeys:[pilates]) - now shows as two clean separate chips with the event appearing under both. Tested via runtime simulation before pushing - confirmed correct chip generation and correct filtering in both directions.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-26 (week panel horizontal)

**2026-08-26 (week panel horizontal) — Claude (chat) — `index.html`** — Lujane wanted the new Week view redesigned from a vertical stacked list into a horizontal panel of day columns. Replaced `.week-day-group` (stacked, full-width) with `.week-panel` (flex row, `overflow-x:auto` for mobile/narrow screens) containing 7 `.week-day-col` items, each a fixed 150px column with a compact heading (weekday + short date) and a narrow-friendly stacked event-card style (reused the existing mobile breakpoint's block layout for `.today-event`, scoped to `.week-day-col` instead of a media query). Marked today's own column with `.is-today` (rose-colored heading) so it's easy to spot in the strip. Verified in-browser at 1280px: renders as one flex row, 7 columns, all visible without needing to scroll at that width.


**2026-08-26 (day/week/month view) — Claude (chat) — `index.html`** — Added a View selector (Day / Week / Month) to the Home page's "What's On Today" section, placed left of the existing Sort-by dropdown per Lujane's request. Day = existing single-day behavior, unchanged. Week = new `homepageWeekDays()` groups the next 7 days into stacked day-sections (each with its own mini heading + event list, empty-state per day), heading shows the date range ("Aug 26 – Sep 1, 2026"), and the ‹/› buttons + swipe gesture step by 7 days instead of 1 while in this mode. Month doesn't persist as a state value at all - selecting it just calls the existing `goToTab('events')`, which already sets `view:'calendar'` on its own, so it's a one-way jump to the real calendar tab, not a third rendering mode to maintain here. Verified all three in-browser: week shows 7 groups with correct range label, next/prev step by 7 in week mode, switching to month lands on `{tab:'events', view:'calendar'}`, switching back to day correctly clears the week groups.

**2026-08-26 (globe root cause) — Claude (chat) — `data/calendar/*.json` (5 individual files)** — MAJOR ARCHITECTURE DISCOVERY: `data/calendar/` contains 140 individual per-event JSON files - this is the REAL source of truth, and trips.json/sports.json/etc are auto-regenerated FROM these files (confirmed: after fixing the 5 source files here, trips.json already reflected the fix without me touching it). This explains why my earlier direct trips.json coordinate fixes silently reverted - I was editing a generated artifact, not the source. ALL future data fixes must edit data/calendar/{id}.json, not the legacy per-category files directly. Fixed 5 trips missing coordinates at the true source: macedonia-kosovo, kazakhstan-deen-dunya-retreats, morocco-sisters-retreat-1, lake-muskoka-writers-retreat (Lujane's newest trip - confirmed via commit history this is what prompted her report), and a-deen-retreat-experience (Yunnan). ROOT CAUSE of why coordinates keep going missing: confirmed the Google Places Autocomplete widget only fills the location TEXT field - it does not and structurally cannot auto-populate the separate lat/lng number fields (Decap custom widgets can only control their own field's value, verified via Decap's own docs - no supported mechanism for one widget to write sibling fields without a much larger schema migration to an object-type field, which would break the plain-string location field used everywhere across 150+ existing entries). Told Lujane honestly this is a real technical constraint, not something I'm choosing not to fix. Recommended a website-side safety net (visibly flag trips missing coordinates rather than let them silently disappear from the globe) as a next step if this keeps recurring.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-26 (organizer field)

**2026-08-26 (organizer field) — Claude (chat) — `index.html`, `admin/config.yml`** — Added new optional 'organizedBy' field right under Title in CMS, across all 6 event collections. Displays in italics directly under the event title on the website - added consistently in all 4 places titles show (main list cards, calendar day popup, event detail page, today-list), with size scaled appropriately for each context's density. Kept the old separate 'organizer'+'contact' fact-line field intact for backward compatibility with existing entries that use it (e.g. ISNA badminton) - this is a genuinely new, additional field, not a replacement.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-26 (boundary restored)

**2026-08-26 (boundary restored) — Claude (chat) — `index.html`** — Re-added the August 2026 minimum-month boundary on the main calendar (this existed early in the project but was silently lost during a later refactor). Correctly attached the disable/guard to id='nextMonth', since that's the button that now goes backward after the recent arrow-direction swap - double-checked the actual current click handlers before touching anything, given how easy it would have been to attach this to the wrong (confusingly-named) button.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-26 (end time)

**2026-08-26 (end time) — Claude (chat) — `index.html`, `admin/config.yml`** — Added End Time and All Day fields right after Time, across all 5 event collections that have Time (sports/activities/functions/mosqueprograms/supportprograms). Trips does not have a Time field at all currently, so it was excluded - flagged to Lujane in case that's wanted too. Updated eventTimeLabel/eventTimeMinutes to show a proper range ('6:00 PM – 8:00 PM') when endTime is set, and 'All day' when allDay is checked. Hit one real push conflict mid-task (another commit landed between fetch and push) - re-fetched fresh and reapplied cleanly per protocol rather than force-pushing over it.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-25 (arrow + globe)

**2026-08-25 (arrow + globe) — Claude (chat) — `index.html`, `data/trips.json`, `admin/config.yml`** — Reversed the main calendar's month arrow direction per Lujane's request. Also fixed globe pins: found 4 trips missing coordinates, not just the 2 mentioned (Macedonia, Yunnan China, Kazakhstan, Morocco - the latter 3 have flag-emoji IDs suggesting automated/scheduled-task additions). REAL root cause found: the trips CMS form never had lat/lng fields at all - nobody using the actual CMS interface has ever had a way to enter coordinates, which is why this keeps recurring. Added required Latitude/Longitude number fields to the trips CMS collection with a hint on how to find them via Google Maps. Honest caveat: this only enforces the requirement for anyone using the actual CMS form - if the scheduled task or a future direct API push bypasses the form, coordinates could still go missing. Recommend I personally validate coordinate completeness whenever pushing trips.json going forward.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-25 (virtual fix)

**2026-08-25 (virtual fix) — Claude (chat) — `index.html`, `data/dayactivities.json`** — Fixed virtual events showing 'Location TBA' on the calendar day popup and today-list (2 real code spots that never checked the virtual flag - the event detail page already did this correctly, which is why the bug wasn't caught earlier). Added a shared locationLabel() helper, used consistently now. Also found the actual data bug: Daff Workshop had no virtual field saved at all despite Lujane setting it in DecapBridge - set virtual:true directly. Worth watching if this recurs elsewhere (CMS boolean not saving), or if it was a one-off.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-25 (label fix)

**2026-08-25 (label fix) — Claude (chat) — `admin/config.yml`** — Fixed the confusing CMS category dropdown that showed the internal 'bakeries' key instead of 'Small Businesses' (Lujane couldn't find it as an option, understandably). Used Decap's label/value option syntax to show the friendly name while keeping the underlying data value (bakeries) unchanged - no data migration needed, purely a CMS display fix. Applied via the shared YAML anchor, confirmed it propagated to all 7 resource collections in one edit.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-25 (cross-listing)

**2026-08-25 (cross-listing) — Claude (chat) — `index.html`, `admin/config.yml`** — Built event cross-listing feature per Lujane's request: a single event can now appear in multiple category calendars (e.g. Hike showing in both Sports and Activities) via new alsoShowIn field, no min/max limit. On 'All Events' it still shows exactly once with one consistent color (its home category's color) - EVENT_ITEMS was already a flat merge of home arrays so this needed no change. Added the field to the CMS across all 6 event collections (sports/activities/functions/trips/mosqueprograms/supportprograms) via safe YAML parse-and-rewrite rather than manual duplication. Tested via runtime simulation before pushing - confirmed cross-listed item appears in both target category views, exactly once on All Events, with correct single color. Also confirmed comma-separated tag text (e.g. 'Pilates, Pickleball') already works today with zero code changes needed, since Tag is just a plain string field.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-25 (muslimfest fix)

**2026-08-25 (muslimfest fix) — Claude (chat) — `data/sports.json`** — Fixed MuslimFest showing only 1 of 3 days on the calendar. Root cause: multi-day support already exists (calDate+endDate expansion, likely built by Kilo), but the entry only had eventDate set (auto-derives calDate) with no endDate at all - editing the description text to say 'Aug 28-30' doesn't touch the actual endDate field that drives calendar placement. Added endDate:2026-08-30. Confirmed the CMS already has a dedicated End Date field for this (noted in config.yml's field list) - Lujane needs to use that specific field, not just the description text, for future multi-day events.


**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-25 (final)

**Status:** IDLE
**Last updated by:** Claude (chat)
**Last updated:** 2026-08-26 (arrow direction)

**2026-08-26 (arrow direction) — Claude (chat) — `index.html`** — Lujane reported the right-hand (›) button on the main calendar didn't advance to future months. Confirmed the two month-nav buttons were completely swapped: `id="prevMonth"` (‹, left) was incrementing the month, `id="nextMonth"` (›, right) was decrementing — this matches an earlier log entry ("boundary restored," 2026-08-26) that had already adapted the August-2026 minimum-month disabled-state to this swap rather than fixing the swap itself. Swapped the click handlers back (and moved the `atMinBoundary` disabled attribute to the left/`prevMonth` button, since going backward is what should be blocked) so left = past, right = future, matching visual convention. Left the Support Groups mini-calendar (`sgPrevMonth`/`sgNextMonth`) untouched — checked it first and it was never affected by this bug. Verified in-browser: clicking › moves Aug 2026 → Sep 2026, clicking ‹ twice from Sep 2026 lands back on Aug 2026 and then correctly disables.

**2026-08-25 (final) — Claude (chat) — `admin/config.yml`, `index.html`** — Switched the Time field's CMS picker on all 5 collections that have one (sports/activities/functions/mosqueprograms/supportprograms; trips has no time field) from 24-hour to a 12-hour AM/PM dropdown, per Lujane's request. Changed only `time_format` (the widget's input UI, `HH:mm` → `"h:mm A"`) and left `format` as `HH:mm` (the stored value) untouched, so the stored data shape doesn't change at all and nothing elsewhere needed updating for that half of it. While checking how `time` gets displayed, found `eventTimeLabel()` in `index.html` was returning the raw stored 24-hour string straight to visitors (e.g. "14:00" instead of "2:00 PM") — fixed by adding `formatTime12h()` and routing display through it; `eventTimeMinutes()` (used for sort order) was untouched since it already parsed hours/minutes numerically and didn't care about AM/PM. Verified: `formatTime12h` unit-tested against midnight/noon/single-digit-hour edge cases, and confirmed in-browser that a real item's stored `"12:00"` now renders as `"12:00 PM"`.

**2026-08-25 (yet even later) — Claude (chat) — `.github/workflows/regenerate-calendar.yml`, `index.html`** — Two urgent fixes. (1) **Root-caused "new events still don't show up, AGAIN"**: confirmed via the live site that 3 newly-submitted events (Autumn En Plein Air, Medieval Painting, Oil Pastel Art Therapy) had valid, correctly-formatted `.json` source files in `data/calendar/` — my earlier `extension: json` fix was working — but the aggregate `data/dayactivities.json` on the live site hadn't updated at all. Traced this to `regenerate-calendar.yml`: it only watched `data/*.json` (the aggregate files, one level too shallow to ever match anything Decap actually writes to `data/calendar/**`/`data/resources/**`) and only ran `generate_calendar.py`, never `build_content.py`. **This means my previous "fix" for the divorce-support-group bug only appeared to work because I manually ran build_content.py and committed the rebuilt aggregate myself in that commit** — the pipeline itself was never actually rebuilding anything from fresh CMS submissions. This is now fixed at the git level (not dependent on trusting an unverifiable Cloudflare dashboard setting): the workflow watches the right paths and runs `build_content.py` before `generate_calendar.py`, committing both the aggregates and calendar.ics back to main automatically on every Decap submission. (2) **Search dropdown "blocking the view"**: clicking a search suggestion navigates to the event detail page correctly, but the suggestions panel (position:fixed, z-index:9998, added in an earlier "search panel fix") never closes, since it's technically a click *inside* `#globalSearchShell` so the existing outside-click-to-close handler skips it — it was permanently visible on top of whatever you navigated to afterward. Added an explicit hide in the `[data-id]` click handler when the clicked trigger is a `.search-suggestion`. Verified both fixes: confirmed via MutationObserver that the panel now actually closes on selection (initial test gave a false negative from a stale HTTP-cached response in my local test server, not a real bug — resolved with a fresh cache-busted load), and confirmed `build_content.py` + `generate_calendar.py` run cleanly together (event count 92→105 after rebuild, one remaining pre-existing dateless item still warns as expected).

**2026-08-25 (yet later) — Claude (chat) — `admin/config.yml`, `index.html`, `scripts/build_content.py`, `scripts/generate_calendar.py`, `data/calendar/mental-khalil-navigating-divorce-support-group.json`** — Four fixes from Lujane's report. (1) Added a "This is a virtual/online event" checkbox (`virtual`, boolean) next to Location on all 6 calendar collections; `renderDetail()` in `index.html` shows "📍 Virtual event" instead of a bare location line and skips the Google Maps embed/link when set. (2) **Found `e.link` (the CMS's single "Link" field, added when calendar forms were slimmed down) was never read anywhere in `index.html`** — every event's link silently went nowhere no matter what an editor entered. Added rendering for it in `renderDetail()`, auto-labeled "Join WhatsApp Group" / "View on Instagram" / "More Info" by sniffing the URL. (3) Date range text showed `"Tuesday, September 1, 2026 – September 1, 2026"` for single-day events — the range-append check used `endDate >= eventDate` instead of `>`, so an endDate equal to eventDate (common when editors fill both fields for a one-day event) still triggered the " – " suffix. Changed to `>`. (4) **Root-caused "support divorce group not showing up every Monday":** `mental-khalil-navigating-divorce-support-group.json` had no `days`, `eventDate`, or `calDate` at all — just a free-text `date` string — so it could never render, despite `eventDate` being `required: true` in the schema (it predates the folder-collection migration and was carried over as-is). Added `days: ["mon"]` + `time`. **To catch this class of bug going forward**, added a build-time warning in `build_content.py` for any item with none of days/eventDate/calDate — running it immediately surfaced **23 other already-broken items** (mostly `mg-hia-*` Mosque Program entries, plus a few Trips/Activities/Gatherings) with the exact same problem; did not fabricate dates for these since I have no source data for them — flagging for Lujane to either supply real dates/recurrence or intentionally leave them undated (in which case they should probably move out of the calendar-backed collections entirely). Separately, **found and fixed a second, wider-reaching bug** in `generate_calendar.py`: `event_to_ics()` returned `None` (dropping the event) for ANY `days`-only recurring item with no `calDate`/`eventDate` at all — this affected the badminton entries too (e.g. `bad-thu.json`/"ISNA Badminton" has never had a `calDate`), meaning **purely-recurring events with no explicit start date have likely never appeared in the downloadable `.ics` feed** even though they show correctly in the site's own JS month-grid. Fixed by anchoring `DTSTART` on a stable computed reference date (nearest occurrence of the item's first weekday after a fixed 2024-01-01 epoch, so re-runs are deterministic) when no explicit date exists. Also found `supportprograms.json` was missing entirely from `generate_calendar.py`'s `DATA_FILES` list — added it, with a "Support Programs" category label. Regenerating with all fixes went from 92 to 102 events. Verified end-to-end in-browser (`renderDetail()` output text + HTML) and via `calendar.ics` content for all 4 original asks plus both extra bugs found.

**2026-08-25 (even later) — Claude (chat) — `admin/config.yml`, `index.html`, `scripts/generate_calendar.py`** — Added support for events that occur on multiple non-consecutive days (e.g. a 3-part workshop series), not just a single date or a continuous eventDate→endDate range. New optional `extraDates` field (list of date pickers) added to all 6 calendar-type folder collections in `admin/config.yml`. Frontend: `occurrencesInMonth()` in `index.html` now merges these extra dates into whatever the event's normal date logic (weekly `days` recurrence or `calDate`/`endDate` range) already produces, so the month grid shows the event pip on every date; also fixed `isPastItem()` to check `extraDates` too, so an event with a past main date but a future extra date still shows under "Upcoming" instead of being hardcoded past. Backend: `generate_calendar.py` emits an `RDATE;VALUE=DATE:...` line per event with extraDates, so the downloadable `.ics` feed picks up the same non-consecutive occurrences (tested with a throwaway `data/calendar/*.json` entry with 3 dates spanning 3 weeks — confirmed correct in both the month-grid JS and the generated `.ics`, then deleted the test entry and regenerated clean). No changes needed to `build_content.py` — it passes the field through untouched.

**2026-08-25 (later) — Claude (chat) — `admin/config.yml`, `wrangler.toml`, `data/calendar/*.json` (8 new), 8 stray `.md` files deleted** — Root-caused Lujane's report that "many submitted events won't show up on the calendar" (Islamic Biomorphic Art Workshop, Masks n Mane, Sip n Paint, Muslim Film Fest, plus 4 more found while investigating: 3x Boxing Program Launch dates, Macedonia & Kosovo trip). Cause: none of the 13 new folder collections in `admin/config.yml` (from today's earlier folder-collection migration) set `extension`/`format`, so Decap defaults new entries to Markdown (frontmatter + empty body) instead of the `.json` shape `scripts/build_content.py` reads (`load_folder()` explicitly skips anything not ending `.json`) — every *new* entry created since the migration was silently invisible to the site, while edits to pre-existing `.json` entries kept working fine, which is why this looked intermittent rather than totally broken. Fixed by adding `extension: json` + `format: json` to all 13 folder collections (6 `data/calendar`, 7 `data/resources`), and converting the 8 stray `.md` files to matching `.json` (same frontmatter fields, no data lost) then deleting the originals. Ran `build_content.py` — all 8 now appear in the aggregate files with zero warnings — then `generate_calendar.py`, confirmed all 8 titles present in `calendar.ics`. **Also fixed a second, compounding issue**: `wrangler.toml`'s header comment and this file's own "one-time fix" instructions above still said the Cloudflare dashboard Build command should be just `python3 scripts/generate_calendar.py` — missing `build_content.py` entirely, so even correctly-formatted future entries would never reach the aggregate files on deploy. Updated both to the two-script command. **Lujane still needs to verify in the Cloudflare dashboard (Settings → Build) that the actual configured Build command matches** — I can't check or change dashboard settings myself, only what's in this repo.

**2026-08-25 (folder-collection migration) — Cline (VS Code) — `admin/config.yml`, `data/calendar/**` + `data/resources/**` (new, 254 files), regenerated `data/*.json` aggregates, `scripts/build_content.py` (new), `scripts/split_legacy_content.py` (one-time, kept for reference), DELETED `scripts/apply_event_moves.py` + `apply-event-moves.yml`, `README.md`** — Migrated all calendar sections + Resources to Decap FOLDER collections: every listing is now its own small JSON file (data/calendar/<slug>.json with a section field; data/resources/<slug>.json with category), and each CMS tab is a filtered view of those folders. This delivers Lujane's asks natively: per-type filtered tabs in Resources (7) and Sports via its own tab + sportKey field search/sort, native sortable_fields sorting (eventDate/title) in every tab, NO id field anywhere (identifier is the title-derived filename; build injects stable ids from stored/filename), tag auto-fills from title for Activities/Functions, and changing an item's Calendar-tab/Type dropdown OFFICIALLY relocates it - replacing the deleted moveTo machinery. scripts/build_content.py merges folders into the legacy aggregate files the frontend reads (frontend untouched); split_legacy_content.py was the one-time migration (kept for reference). Counts verified lossless vs git HEAD incl. id-set equality for all seven datasets after fixing a slug-collision bug in the splitter. Build command is now: python3 scripts/build_content.py && python3 scripts/generate_calendar.py && npx wrangler deploy (README updated). Validated: YAML parse, 13 folder collections w/ correct filters+defaults+sortable+summary and no id/moveTo fields, jsdom suite 11/11 on rebuilt aggregates, node --check.

---

## Recent Activity Log

_(most recent first — add new entries to the top, trim past ~15)_

- 2026-08-25 — Cline (VS Code) — `admin/config.yml`, `index.html`, `scripts/generate_calendar.py` — Eight-change batch: (1) NEW Time field (datetime widget, HH:mm picker) on every calendar tab EXCEPT Trips; site now displays it (eventTimeLabel/Minutes prefer item.time). (2) REMOVED 'Custom date text' field from all forms - calendar picker is the only date entry; legacy date values in existing data still display untouched. (3) Location is now sufficient: detail-page Google map embed already geocodes from the location text, so mapsUrl/lat/lng fields removed from ALL event forms (Resources keeps lat/lng - its map pins need them). (4) FORM SLIMMING per Lujane spec: removed Organizer/Contact/Price/Registration/Registration-deadline/Hijab-off/City/partner+partner-IG and the four separate link boxes; kept ONE 'Link (Instagram or WhatsApp)' box; Trip-type stays only on Calendar Trips, Sport-key only on Sports. Always-kept set: section dropdown, Title, Event date, End date, Time (non-trips), Recurring weekdays/starts/ends, Location, Link, Description. (5) Home-tab overlap fix: Add-to-Homescreen row gets .bottom-row margin/clear so it never touches What's-On-Today regardless of list length. (6) NEW End date field on ALL six tabs; frontend expands multi-day ranges across month grids (occurrencesInMonth) and shows range text ('Sept 5 – Sep 7'); generate_calendar.py emits proper exclusive DTEND in calendar.ics (fixture-tested Sept 5–7 → DTEND 20260908). (7) Past months browsable again - removed MIN_YEAR floor + disabled prev-button. (8) Day-cell taps: pips are pointer-events:none so tapping anywhere (even on a pip) opens that day's full schedule popup; event details open from inside the popup. Validated: node --check, python compile, ICS fixture test, jsdom suite 11/11 on rebuilt data.

- 2026-08-25 — Cline (VS Code) — `index.html`, `admin/config.yml`, `data/gatherings.json`, `data/mosquegatherings.json`, `scripts/apply_event_moves.py` (new), `.github/workflows/apply-event-moves.yml` (new), `README.md` — Four changes: (1) Mental Health grid's 'View Support Groups →' button now centered across the page (wrapped in .mh-support-cta, spans full grid row); (2) wording sweep — all 9 'Gathering' tags → 'Function' and all 39 'Mosque Gathering' tags → 'Mosque Program' so Decap's Tag fields match site vocabulary (internal file/variable names untouched); (3) NEW official event-type moves: identical moveTo select added to all six calendar forms; editors pick a target tab, and scripts/apply_event_moves.py (run by the new Apply-event-tab-moves Action on every data push, plus recommended as part of the dashboard Build command) relocates the item between files, clears the field, dedupes by id - fixture-tested incl. idempotency; (4) README documents the updated build command. Validated: JSON/YAML parse, 6x moveTo present, node --check, jsdom MH-button check.

- 2026-08-25 — Cline (VS Code) — `index.html` — Four UI fixes from Lujane's list: (1) Home tab — 'Add this to your Home Screen' tile moved BELOW the What's On Today section as a centered full-width tile; (2) Support Groups page — List-only/Calendar-only/Both toggle removed, page always shows list beside mini-calendar (sgView state/handlers/CSS deleted); (3) Search suggestions now render position:fixed anchored under the search input at z-index 9998 so the sticky nav can no longer cover or clip them on desktop or mobile, plus hide-on-scroll; (4) Footer gained a TikTok pill button (@4dasistas) styled to match WhatsApp/Instagram buttons, footer-btns wrap on mobile. Validated via jsdom runtime suite 13/13 (home order, SG panes always visible with calendar content, suggestions fixed-positioned, TikTok href/icon) + node --check.

- 2026-08-25 — Cline (VS Code) — `index.html` — New "Event types ▾" multi-select dropdown beside the List/Calendar toggle on the Calendar tab: checkboxes for Sports / Activities / Functions / Trips / Mosque Programs / Support Groups (any combination, no min/max), themed to site palette (lilac accents, per-type colored dots matching category chips). Union-filters through itemsForCategoryBase so BOTH list and calendar views respect it; sub-filter rows step aside with a note while active; calendar scope-note lists chosen types; chip clicks and Calendar re-entry clear selection; selection persists in URL hash (#…&types=). All/Clear shortcuts; outside-click closes panel. Tested via full jsdom runtime simulation — 15/15 assertions passed (boot, tab nav, panel open, single+multi selection, union counts 14→17, badge counts, list+calendar rendering under filter, clear action, chip reset, hash write/restore) + node --check syntax validation.

- 2026-08-25 — Cline (VS Code) — `admin/index.html` — Rolled Decap pin 3.15.1 → 3.14.1: Lujane reported ALL widget:date fields (eventDate/recurStart/recurEnd) missing from forms while string/select fields rendered — and the 3.15.1 bundle logs an internally inconsistent version set (cms-app 3.15.1 + cms-core 3.17.1), pointing at a mid-year core refactor breaking date-control registration. 3.14.1 (June build) predates it and is verified serving HTTP 200. Also: symptom pattern equally matches browsers still caching the OLD anchored config.yml — Lujane must deploy latest AND clear site data (or test incognito) before judging.

- 2026-08-25 — Cline (VS Code) — `_headers` (new), `admin/index.html` — CMS cache-hardening after Lujane still saw stale widget errors post-fix: added Cloudflare `_headers` making /admin/config.yml + admin pages `no-store` (browser HTTP cache was able to serve the OLD anchored config even after server-side fix — Decap fetches config without cache-busting), and pinned decap script to exact 3.15.1 (verified HTTP 200) instead of floating ^3.0.0 so the bundle can never drift under us again. The admin/uploads 404s in console are expected/handled Decap probing for the not-yet-existing media folder — harmless.

- 2026-08-25 — Cline (VS Code) — `admin/config.yml` — FIX for 'No control for widget date' on every CMS form: Decap 3.15.x mis-builds forms when config.yml uses shared YAML-anchor field blocks or {label,value} select options. Regenerated config with literal per-collection copies of the identical 29-field form + plain-string select options (hint documents friendly names). Verified: no anchor syntax, six forms byte-equal, YAML valid. NOTE FOR ALL AGENTS: do not reintroduce anchors or labeled select options in this file — they break widget rendering on the current Decap version.

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
