/**
 * 4DASISTAS Tab Editor Cloudflare Worker
 * 
 * Provides a simple API for editing site content without redeploying.
 * Endpoints:
 *   GET  /api/data/:key    - Fetch data by key (e.g., "trips", "events")
 *   POST /api/data/:key    - Update data by key (requires auth)
 *   GET  /editor           - Simple admin interface
 * 
 * Deploy:
 *   wrangler deploy
 */

export default {
  async fetch(request, env, ctx) {
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "change-me-in-production";
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API routes
    if (path.startsWith("/api/data/")) {
      const key = path.replace("/api/data/", "");
      
      if (request.method === "GET") {
        const value = await env.SITE_DATA.get(key);
        return new Response(value || "null", {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      
      if (request.method === "POST") {
        // Simple auth check
        const auth = request.headers.get("Authorization");
        if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
          return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }
        
        const body = await request.text();
        await env.SITE_DATA.put(key, body);
        return new Response("OK", { headers: corsHeaders });
      }
    }

    // Simple editor interface
    if (path === "/editor" || path === "/editor/") {
      return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>4DASISTAS Editor</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    textarea { width: 100%; height: 400px; font-family: monospace; }
    button { padding: 10px 20px; background: #373d3b; color: white; border: none; cursor: pointer; }
  </style>
</head>
<body>
  <h1>4DASISTAS Tab Editor</h1>
  <p>This is a simple editor interface. In production, connect this to the KV store.</p>
  <textarea id="editor" placeholder="JSON data will appear here..."></textarea>
  <br><br>
  <button onclick="save()">Save</button>
  <script>
    async function load() {
      const res = await fetch('/api/data/trips');
      document.getElementById('editor').value = await res.text();
    }
    async function save() {
      const data = document.getElementById('editor').value;
      await fetch('/api/data/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${ADMIN_PASSWORD}' },
        body: data
      });
      alert('Saved!');
    }
    load();
  </script>
</body>
</html>`, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    // Default response
    return new Response("4DASISTAS Worker — use /api/data/:key or /editor", {
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  },
};
