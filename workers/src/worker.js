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
 *   -- Club Members Schedule (per-club private sign-in + availability) --
 *   GET    /api/clubs/:clubId/members              - Roster (name + photo, no PINs)
 *   POST   /api/clubs/:clubId/members              - Create a profile, returns a one-time PIN + session token
 *   POST   /api/clubs/:clubId/login                - Sign in with name+PIN, returns a session token
 *   GET    /api/clubs/:clubId/members/:id          - One member's public profile + availability
 *   PUT    /api/clubs/:clubId/members/:id          - Update own availability/photo (Bearer session token required)
 *   GET    /api/admin/club-members                 - All clubs' rosters (requires admin session)
 *   POST   /api/admin/club-members/:clubId/:id/reset-pin - Issue a member a new PIN (requires admin session)
 *   DELETE /api/admin/club-members/:clubId/:id     - Remove a member (requires admin session)
 *
 * Deploy:
 *   wrangler deploy
 */

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const MEMBER_SESSION_TTL = 180 * 24 * 60 * 60; // 180 days — club members stay signed in on their own device
const SUBSCRIBER_INDEX_KEY = "daily-list-subscribers";
const EVENT_FILES = ["sports", "gatherings", "dayactivities", "mosquegatherings", "trips"];

// ---- Club Members Schedule helpers ----
const CM_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CM_BLOCKS = ["morning", "afternoon", "evening", "night"];
const CM_MAX_PHOTO_LEN = 300000; // ~225KB of raw bytes once base64-decoded

const sha256Hex = async (input) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
};

const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

const sanitizeAvailability = (input) => {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const day of CM_DAYS) {
    const blocks = Array.isArray(input[day]) ? input[day].filter(b => CM_BLOCKS.includes(b)) : [];
    if (blocks.length) out[day] = [...new Set(blocks)];
  }
  return out;
};

const sanitizePhoto = (photo) => {
  if (!photo) return null;
  if (typeof photo !== "string" || !photo.startsWith("data:image/") || photo.length > CM_MAX_PHOTO_LEN) return null;
  return photo;
};

const clubMembersKey = (clubId) => `clubmembers:${clubId}`;

const readClubMembers = async (env, clubId) => {
  const raw = await env.SITE_DATA.get(clubMembersKey(clubId));
  return raw ? JSON.parse(raw) : [];
};

const writeClubMembers = async (env, clubId, members) => {
  await env.SITE_DATA.put(clubMembersKey(clubId), JSON.stringify(members));
};

const publicMember = (m) => ({ id: m.id, name: m.name, photo: m.photo || null, availability: m.availability || {} });
const publicMemberSummary = (m) => ({ id: m.id, name: m.name, photo: m.photo || null });

const createMemberSession = async (env, clubId, memberId) => {
  const token = crypto.randomUUID();
  await env.SITE_DATA.put(
    `membersession:${token}`,
    JSON.stringify({ clubId, memberId, expiresAt: Date.now() + MEMBER_SESSION_TTL * 1000 }),
    { expirationTtl: MEMBER_SESSION_TTL }
  );
  return token;
};

const verifyMemberToken = async (env, clubId, memberId, token) => {
  if (!token) return false;
  const raw = await env.SITE_DATA.get(`membersession:${token}`);
  if (!raw) return false;
  try {
    const session = JSON.parse(raw);
    return session.clubId === clubId && session.memberId === memberId;
  } catch {
    return false;
  }
};

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
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD; // REQUIRED Worker secret — auth fails closed when unset

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

    // ---- Club Members Schedule (public sign-in/profile/availability routes) ----

    const cmMembersMatch = path.match(/^\/api\/clubs\/([^/]+)\/members\/?$/);
    const cmMemberByIdMatch = path.match(/^\/api\/clubs\/([^/]+)\/members\/([^/]+)\/?$/);
    const cmLoginMatch = path.match(/^\/api\/clubs\/([^/]+)\/login\/?$/);

    if (cmMembersMatch && request.method === "GET") {
      const clubId = decodeURIComponent(cmMembersMatch[1]);
      const members = await readClubMembers(env, clubId);
      return jsonResponse({ members: members.map(publicMemberSummary) }, 200, corsHeaders);
    }

    if (cmMembersMatch && request.method === "POST") {
      const clubId = decodeURIComponent(cmMembersMatch[1]);
      let body;
      try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid request" }, 400, corsHeaders); }
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return jsonResponse({ error: "Name is required" }, 400, corsHeaders);
      const photo = sanitizePhoto(body.photo);
      const members = await readClubMembers(env, clubId);
      if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        return jsonResponse({ error: "That name is already used in this club. Pick another, or sign in if this is you." }, 409, corsHeaders);
      }
      const existingHashes = new Set(members.map(m => m.pinHash));
      let pin, pinHash;
      do { pin = randomPin(); pinHash = await sha256Hex(pin); } while (existingHashes.has(pinHash));
      const member = { id: crypto.randomUUID(), name, pinHash, photo, availability: {}, createdAt: Date.now() };
      members.push(member);
      await writeClubMembers(env, clubId, members);
      const token = await createMemberSession(env, clubId, member.id);
      return jsonResponse({ id: member.id, name: member.name, pin, token }, 201, corsHeaders);
    }

    if (cmLoginMatch && request.method === "POST") {
      const clubId = decodeURIComponent(cmLoginMatch[1]);
      let body;
      try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid request" }, 400, corsHeaders); }
      const name = String(body.name || "").trim();
      const pin = String(body.pin || "").trim();
      if (!name || !pin) return jsonResponse({ error: "Name and PIN are required" }, 400, corsHeaders);
      const members = await readClubMembers(env, clubId);
      const pinHash = await sha256Hex(pin);
      const member = members.find(m => m.name.toLowerCase() === name.toLowerCase() && m.pinHash === pinHash);
      if (!member) return jsonResponse({ error: "Name or PIN is incorrect" }, 401, corsHeaders);
      const token = await createMemberSession(env, clubId, member.id);
      return jsonResponse({ ...publicMember(member), token }, 200, corsHeaders);
    }

    if (cmMemberByIdMatch && request.method === "GET") {
      const clubId = decodeURIComponent(cmMemberByIdMatch[1]);
      const memberId = decodeURIComponent(cmMemberByIdMatch[2]);
      const members = await readClubMembers(env, clubId);
      const member = members.find(m => m.id === memberId);
      if (!member) return jsonResponse({ error: "Not found" }, 404, corsHeaders);
      return jsonResponse(publicMember(member), 200, corsHeaders);
    }

    if (cmMemberByIdMatch && request.method === "PUT") {
      const clubId = decodeURIComponent(cmMemberByIdMatch[1]);
      const memberId = decodeURIComponent(cmMemberByIdMatch[2]);
      let body;
      try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid request" }, 400, corsHeaders); }
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : String(body.token || "");
      const ok = await verifyMemberToken(env, clubId, memberId, token);
      if (!ok) return jsonResponse({ error: "Not signed in" }, 401, corsHeaders);
      const members = await readClubMembers(env, clubId);
      const member = members.find(m => m.id === memberId);
      if (!member) return jsonResponse({ error: "Not found" }, 404, corsHeaders);
      if (body.availability !== undefined) member.availability = sanitizeAvailability(body.availability);
      if (body.photo !== undefined) member.photo = sanitizePhoto(body.photo);
      await writeClubMembers(env, clubId, members);
      return jsonResponse(publicMember(member), 200, corsHeaders);
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
      // Fail closed: if the ADMIN_PASSWORD secret is not configured, never grant a session.
      if (!ADMIN_PASSWORD) {
        const headers = new Headers(corsHeaders);
        headers.set("Location", "/editor?error=2");
        return new Response(null, { status: 302, headers });
      }
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

    const requiresAuth = path === "/editor" || (path.startsWith("/api/data/") && request.method === "POST") || path.startsWith("/api/admin/club-members");

    if (requiresAuth) {
      const token = getSessionToken(request);
      const valid = await isValidSession(token);
      if (!valid) {
        if (path === "/editor") {
          const error = url.searchParams.get("error");
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
  ${error === '1' ? '<p class="error">Invalid password. Please try again.</p>' : ''}${error === '2' ? '<p class="error">Server misconfigured: the ADMIN_PASSWORD secret is not set, so nobody can log in. Set it with <code>npx wrangler secret put ADMIN_PASSWORD</code>.</p>' : ''}
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

    // Admin: manage club members / reset PINs (session-cookie gated above)
    if (path === "/api/admin/club-members" && request.method === "GET") {
      const list = await env.SITE_DATA.list({ prefix: "clubmembers:" });
      const out = {};
      for (const key of list.keys) {
        const clubId = key.name.replace("clubmembers:", "");
        out[clubId] = (await readClubMembers(env, clubId)).map(publicMemberSummary);
      }
      return jsonResponse(out, 200, corsHeaders);
    }

    const adminResetMatch = path.match(/^\/api\/admin\/club-members\/([^/]+)\/([^/]+)\/reset-pin\/?$/);
    if (adminResetMatch && request.method === "POST") {
      const clubId = decodeURIComponent(adminResetMatch[1]);
      const memberId = decodeURIComponent(adminResetMatch[2]);
      const members = await readClubMembers(env, clubId);
      const member = members.find(m => m.id === memberId);
      if (!member) return jsonResponse({ error: "Not found" }, 404, corsHeaders);
      const existingHashes = new Set(members.filter(m => m.id !== memberId).map(m => m.pinHash));
      let pin, pinHash;
      do { pin = randomPin(); pinHash = await sha256Hex(pin); } while (existingHashes.has(pinHash));
      member.pinHash = pinHash;
      await writeClubMembers(env, clubId, members);
      return jsonResponse({ pin }, 200, corsHeaders);
    }

    const adminDeleteMatch = path.match(/^\/api\/admin\/club-members\/([^/]+)\/([^/]+)\/?$/);
    if (adminDeleteMatch && request.method === "DELETE") {
      const clubId = decodeURIComponent(adminDeleteMatch[1]);
      const memberId = decodeURIComponent(adminDeleteMatch[2]);
      const members = await readClubMembers(env, clubId);
      await writeClubMembers(env, clubId, members.filter(m => m.id !== memberId));
      return jsonResponse({ ok: true }, 200, corsHeaders);
    }

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

  <hr style="margin: 40px 0;">
  <h2>Club Members Schedule — Admin</h2>
  <p style="font-size: 13px; color: #666;">View every club's member list and reset a member's PIN if they lose it (they'll need the new PIN to sign back in).</p>
  <div id="clubMembersPanel">Loading…</div>
  <script>
    function escapeCmAdmin(s) {
      const d = document.createElement('div');
      d.textContent = s == null ? '' : String(s);
      return d.innerHTML;
    }
    async function loadClubMembers() {
      const panel = document.getElementById('clubMembersPanel');
      const res = await fetch('/api/admin/club-members', { credentials: 'include' });
      if (!res.ok) { panel.textContent = 'Failed to load (' + res.status + ')'; return; }
      const data = await res.json();
      const clubIds = Object.keys(data).filter(id => data[id].length);
      if (!clubIds.length) { panel.textContent = 'No club members yet.'; return; }
      panel.innerHTML = clubIds.map(clubId => {
        const members = data[clubId];
        return '<h3>' + escapeCmAdmin(clubId) + '</h3><table style="width:100%;border-collapse:collapse;margin-bottom:20px;">' +
          members.map(m => '<tr style="border-bottom:1px solid #ddd;"><td style="padding:6px;">' +
            (m.photo ? '<img src="' + m.photo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;">' : '') +
            escapeCmAdmin(m.name) + '</td>' +
            '<td style="padding:6px;text-align:right;"><button onclick="resetClubMemberPin(\\'' + clubId + '\\',\\'' + m.id + '\\')">Reset PIN</button> ' +
            '<button onclick="removeClubMember(\\'' + clubId + '\\',\\'' + m.id + '\\')" style="background:#c00;">Remove</button></td></tr>').join('') +
          '</table>';
      }).join('');
    }
    async function resetClubMemberPin(clubId, memberId) {
      const res = await fetch('/api/admin/club-members/' + encodeURIComponent(clubId) + '/' + encodeURIComponent(memberId) + '/reset-pin', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) alert('New PIN: ' + data.pin + '\\n\\nTell this member their new PIN so they can sign back in.');
      else alert('Error: ' + (data.error || res.status));
    }
    async function removeClubMember(clubId, memberId) {
      if (!confirm('Remove this member? This cannot be undone.')) return;
      const res = await fetch('/api/admin/club-members/' + encodeURIComponent(clubId) + '/' + encodeURIComponent(memberId), { method: 'DELETE', credentials: 'include' });
      if (res.ok) loadClubMembers(); else alert('Error: ' + res.status);
    }
    loadClubMembers();
  </script>
</body>
</html>`, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    }

    // ---- Default ----

    if (env.ASSETS) return env.ASSETS.fetch(request);
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
