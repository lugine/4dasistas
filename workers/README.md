# 4DASISTAS Tab Editor — Cloudflare Worker

A Cloudflare Worker that provides a simple API and admin UI for editing 4DASISTAS site content without redeploying.

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

5. (Optional) Set a custom admin password:
   ```bash
   wrangler secret put ADMIN_PASSWORD
   ```

6. (Optional) Add a route in `wrangler.toml` under `routes` to serve from your domain.

## Endpoints

- `GET /api/data/:key` — Fetch data by key
- `POST /api/data/:key` — Update data by key (requires `Authorization: Bearer <ADMIN_PASSWORD>`)
- `GET /editor` — Simple admin interface
