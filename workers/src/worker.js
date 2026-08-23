/**
 * 4DASISTAS Tab Editor Cloudflare Worker
 * 
 * Secure admin panel with session-based authentication.
 * No passwords are ever embedded in served HTML or client-side JS.
 * 
 * Endpoints:
 *   GET  /editor           - Admin editor (requires session cookie)
 *   POST /login            - Authenticate with password
 *   GET  /logout           - Destroy session
 *   GET  /api/data/:key    - Fetch data by key (public read)
 *   POST /api/data/:key    - Update data by key (requires session)
 * 
 * Deploy:
 *   wrangler deploy
 */

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const SUBSCRIBER_INDEX_KEY = "daily-list-subscribers";
const EVENT_FILES = ["sports", "gatherings", "dayactivities", "mosquegatherings", "trips"];

const jsonResponse = (body, status = 200, corsHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders },
});

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const torontoDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const weekdayForDate = (dateString) => new Date(`${dateString}T00:00:00Z`).getUTCDay();
const weekdayNumbers = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const eventIsOnDate = (item, dateString) => {
  if (item.calDate === dateString || item.eventDate === dateString) return true;
  if (!Array.isArray(item.days) || !item.days.length) return false;
  if (item.recurStart && dateString < item.recurStart) return false;
  if (item.recurEnd && dateString > item.recurEnd) return false;
  return item.days.some(day => weekdayNumbers[String(day).toLowerCase()] === weekdayForDate(dateString));
};

const readTodayEvents = async (env) => {
  const origin = env.SITE_ORIGIN || "https://4dasistas.ca";
  const dateString = torontoDate();
  const events = [];
  for (const file of EVENT_FILES) {
    const response = await fetch(`${origin}/data/${file}.json`, { cf: { cacheTtl: 60 } });
    if (!response.ok) continue;
    const data = await response.json();
    for (const item of data.items || []) {
      if (file === "trips" && item.tripType === "international") continue;
      if (eventIsOnDate(item, dateString)) events.push({ ...item, category: file });
    }
  }
  return { dateString, events };
};

export default {
  async fetch(request, env, ctx) {
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "change-me-in-production";

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/subscribe" && request.method === "POST") {
      let email;
      try { email = String((await request.json()).email || "").trim().toLowerCase(); } catch { return jsonResponse({ error: "Invalid request" }, 400, corsHeaders); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "Valid email required" }, 400, corsHeaders);
      const index = JSON.parse((await env.SITE_DATA.get(SUBSCRIBER_INDEX_KEY)) || "[]");
      const existing = index.find(subscriber => subscriber.email === email);
      if (existing) return jsonResponse({ ok: true }, 200, corsHeaders);
      const token = crypto.randomUUID();
      index.push({ email, token, createdAt: Date.now() });
      await env.SITE_DATA.put(SUBSCRIBER_INDEX_KEY, JSON.stringify(index));
      return jsonResponse({ ok: true }, 201, corsHeaders);
    }

    if (path === "/api/unsubscribe" && request.method === "GET") {
      const token = url.searchParams.get("token");
      const index = JSON.parse((await env.SITE_DATA.get(SUBSCRIBER_INDEX_KEY)) || "[]");
      const next = index.filter(subscriber => subscriber.token !== token);
      await env.SITE_DATA.put(SUBSCRIBER_INDEX_KEY, JSON.stringify(next));
      return new Response("You have been unsubscribed from the daily 4DASISTAS list.", { headers: { "Content-Type": "text/plain", ...corsHeaders } });
    }

    // ---- Auth helpers ----

    const getSessionToken = (req) => {
      const cookie = req.headers.get("Cookie") || "";
      const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
      return match ? match[1] : null;
    };

    const isValidSession = async (token) => {
      if (!token) return false;
      const raw = await env.SITE_DATA.get(`session:${token}`);
      if (!raw) return false;
      try {
        const session = JSON.parse(raw);
        if (session.expiresAt && Date.now() > session.expiresAt) {
          await env.SITE_DATA.delete(`session:${token}`);
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    const createSession = async () => {
      const token =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const session = {
        expiresAt: Date.now() + SESSION_TTL * 1000,
        createdAt: Date.now(),
      };
      await env.SITE_DATA.put(
        `session:${token}`,
        JSON.stringify(session),
        { expirationTtl: SESSION_TTL }
      );
      return token;
    };

    const setSessionCookie = (token) => {
      return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`;
    };

    const clearSessionCookie = () => {
      return "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
    };

    // ---- Login ----

    if (path === "/login" && request.method === "POST") {
      const formData = await request.formData();
      const password = formData.get("password");
      if (password && password === ADMIN_PASSWORD) {
        const token = await createSession();
        const headers = new Headers(corsHeaders);
        headers.set("Set-Cookie", setSessionCookie(token));
        headers.set("Location", "/editor");
        return new Response(null, { status: 302, headers });
      }
      const headers = new Headers(corsHeaders);
      headers.set("Location", "/editor?error=1");
      return new Response(null, { status: 302, headers });
    }

    // ---- Logout ----

    if (path === "/logout") {
      const token = getSessionToken(request);
      if (token) {
        await env.SITE_DATA.delete(`session:${token}`).catch(() => {});
      }
      const headers = new Headers(corsHeaders);
      headers.set("Set-Cookie", clearSessionCookie());
      headers.set("Location", "/editor");
      return new Response(null, { status: 302, headers });
    }

    // ---- Auth guard for editor and writes ----

    const requiresAuth = path === "/editor" || (path.startsWith("/api/data/") && request.method === "POST");

    if (requiresAuth) {
      const token = getSessionToken(request);
      const valid = await isValidSession(token);
      if (!valid) {
        if (path === "/editor") {
          const error = url.searchParams.get("error") === "1";
          const html = `<!DOCTYPE html>
<html>
<head>
  <title>4DASISTAS Editor — Login</title>
  <style>
    body { font-family: system-ui; max-width: 400px; margin: 80px auto; padding: 20px; text-align: center; }
    input { width: 100%; padding: 12px; margin: 10px 0; font-size: 16px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #373d3b; color: white; border: none; font-size: 16px; cursor: pointer; }
    .error { color: #c00; }
  </style>
</head>
<body>
  <h1>4DASISTAS Editor</h1>
  ${error ? '<p class="error">Invalid password. Please try again.</p>' : ''}
  <form method="POST" action="/login">
    <input type="password" name="password" placeholder="Admin password" required autofocus>
    <button type="submit">Login</button>
  </form>
  <p style="margin-top: 20px; font-size: 12px; color: #666;">Enter the admin password to access the editor.</p>
</body>
</html>`;
          return new Response(html, {
            headers: { "Content-Type": "text/html", ...corsHeaders },
          });
        }
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    }

    // ---- API routes ----

    if (path.startsWith("/api/data/")) {
      const key = path.replace("/api/data/", "");

      if (request.method === "GET") {
        const value = await env.SITE_DATA.get(key);
        return new Response(value || "null", {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (request.method === "POST") {
        const body = await request.text();
        await env.SITE_DATA.put(key, body);
        return new Response("OK", { headers: corsHeaders });
      }
    }

    // ---- Editor UI ----

    if (path === "/editor" || path === "/editor/") {
      return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>4DASISTAS Editor</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    textarea { width: 100%; height: 400px; font-family: monospace; }
    button { padding: 10px 20px; background: #373d3b; color: white; border: none; cursor: pointer; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    a { color: #373d3b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>4DASISTAS Tab Editor</h1>
    <a href="/logout">Logout</a>
  </div>
  <p>Select a data key to edit below.</p>
  <div style="margin-bottom: 20px;">
    <select id="keySelect" onchange="loadKey()">
      <option value="">-- Select data key --</option>
      <option value="sports">Sports</option>
      <option value="gatherings">Gatherings</option>
      <option value="dayactivities">Day Activities</option>
      <option value="trips">Trips</option>
      <option value="clubs">Clubs</option>
      <option value="organizations">Organizations</option>
      <option value="resources">Resources</option>
      <option value="smallbusinesses">Small Businesses</option>
      <option value="mosquegatherings">Mosque Gatherings</option>
    </select>
  </div>
  <textarea id="editor" placeholder="Select a key above to load data..."></textarea>
  <br><br>
  <button onclick="save()">Save</button>
  <p id="status" style="margin-top: 10px;"></p>
  <script>
    async function loadKey() {
      const key = document.getElementById('keySelect').value;
      if (!key) return;
      const res = await fetch('/api/data/' + key);
      document.getElementById('editor').value = await res.text();
      document.getElementById('status').textContent = 'Loaded: ' + key;
    }
    async function save() {
      const key = document.getElementById('keySelect').value;
      if (!key) { alert('Select a key first'); return; }
      const data = document.getElementById('editor').value;
      const res = await fetch('/api/data/' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data
      });
      if (res.ok) {
        document.getElementById('status').textContent = 'Saved!';
      } else {
        document.getElementById('status').textContent = 'Error: ' + res.status;
      }
    }
  </script>
</body>
</html>`, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    // ---- Default ----

    return new Response("4DASISTAS Worker — use /api/data/:key, /editor, /login, or /logout", {
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  },

  async scheduled(controller, env, ctx) {
    if (!env.RESEND_API_KEY) return;
    const subscribers = JSON.parse((await env.SITE_DATA.get(SUBSCRIBER_INDEX_KEY)) || "[]");
    if (!subscribers.length) return;
    const { dateString, events } = await readTodayEvents(env);
    if (!events.length) return;
    const origin = env.SITE_ORIGIN || "https://4dasistas.ca";
    const list = events.map(item => `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.date || "Today")} · ${escapeHtml(item.location || "Location TBA")}</li>`).join("");
    const subject = `What's on today at 4DASISTAS — ${dateString}`;
    for (const subscriber of subscribers) {
      const unsubscribeUrl = `${origin}/api/unsubscribe?token=${encodeURIComponent(subscriber.token)}`;
      ctx.waitUntil(fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.FROM_EMAIL || "4DASISTAS <updates@4dasistas.ca>",
          to: [subscriber.email],
          subject,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#373d3b"><h1 style="color:#caaacd">WHAT'S ON TODAY</h1><p>${escapeHtml(dateString)}</p><ul>${list}</ul><p style="color:#776867;font-size:12px">You are receiving this because you subscribed to the 4DASISTAS daily list. <a href="${unsubscribeUrl}">Unsubscribe</a></p></div>`,
        }),
      }));
    }
  },
};
