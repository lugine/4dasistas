# 4DASISTAS Tab Editor — Cloudflare Worker

A Cloudflare Worker that provides a secure admin panel and API for editing 4DASISTAS site content without redeploying.

Authentication is session-based. The admin password is never exposed to browsers.

## Files

- `src/worker.js` — Worker code (API + editor UI)
- `wrangler.toml` — Cloudflare Worker configuration
- `package.json` — Project metadata

## Deploy

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Create a KV namespace:
   ```bash
   cd workers
   wrangler kv namespace create SITE_DATA
   ```
   Copy the `id` from the output and paste it into `wrangler.toml`.

4. Deploy:
   ```bash
   cd workers
   wrangler deploy
   ```

5. Set the admin password (required):
   ```bash
   wrangler secret put ADMIN_PASSWORD
   ```

6. (Optional) Add a route in `wrangler.toml` under `routes` to serve from your domain.

## Endpoints

- `GET /api/data/:key` — Fetch data by key (public)
- `POST /api/data/:key` — Update data by key (requires admin session)
- `GET /editor` — Admin editor UI (requires admin session)
- `POST /login` — Authenticate with password
- `GET /logout` — End admin session
- `POST /api/subscribe` — Subscribe an email to the daily “What’s on Today” list
- `GET /api/unsubscribe?token=...` — Unsubscribe from the daily list

**Daily email setup**

The Worker sends the current local-day event list once per day through Resend. The list excludes international trips and uses the same public JSON data as the site.

1. Create a Resend account and verify the `4dasistas.ca` sending domain.
2. Set the API key: `wrangler secret put RESEND_API_KEY`.
3. Set `SITE_ORIGIN` and `FROM_EMAIL` in `workers/wrangler.toml` to the deployed site and verified sender.
4. Deploy from the repository root with `npx wrangler deploy` so the subscription API is attached to the production `4dasistas` Worker and its static assets. The `workers` directory contains the Worker source used by the root `wrangler.toml`.

The site button calls `/api/subscribe`. The root production Worker must be deployed and the domain must be proxied through Cloudflare; otherwise the site will show “Subscription is temporarily unavailable” because static hosting has no `/api/subscribe` handler.

The cron is configured for `0 13 * * *` (9:00 AM Toronto during daylight time). Cloudflare cron schedules are UTC; adjust it seasonally if a fixed local delivery time is required.

## Usage

1. Visit `/editor` in your browser.
2. Enter the admin password on the login form.
3. A session cookie is set (HTTP-only, 7 days).
4. Use the editor to view/edit data keys, or use the API directly with the session cookie.

## Security

- `ADMIN_PASSWORD` is stored as a Worker secret (`wrangler secret put`).
- Sessions are stored in KV with a 7-day TTL.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`.
- The password is never embedded in HTML, JavaScript, or the DOM.
