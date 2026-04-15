/* Cloudflare Worker — analytics collector for Peizhong Gao's site.
 *
 * Endpoints:
 *   POST /beacon             — called by analytics.js on every page load.
 *                              Body: JSON visit object.
 *   GET  /visits             — protected by X-Admin-Token header.
 *                              Returns { count, visits: [...] }.
 *   GET  /stats              — protected by X-Admin-Token header.
 *                              Returns precomputed aggregates.
 *
 * Deployment (see worker/README.md for the 5-minute walkthrough):
 *   wrangler kv:namespace create VISITS_KV
 *   wrangler secret put ADMIN_TOKEN
 *   wrangler deploy
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  "Access-Control-Max-Age": "86400",
};

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  });

const text = (body, status = 200) =>
  new Response(body, { status, headers: { ...CORS, "Content-Type": "text/plain" } });

const sanitize = (value, maxLen = 2048) => {
  if (value == null) return null;
  const s = String(value);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const requireAdmin = (req, env) => {
  const tok = req.headers.get("X-Admin-Token");
  return tok && env.ADMIN_TOKEN && tok === env.ADMIN_TOKEN;
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // --- Beacon: record a visit -----------------------------------
    if (url.pathname === "/beacon" && req.method === "POST") {
      let body;
      try { body = await req.json(); } catch { return text("bad json", 400); }

      // Enrich with request-side signals
      const cfCountry = req.headers.get("CF-IPCountry") || null;
      const cfIp      = req.headers.get("CF-Connecting-IP") || null;
      const cfCity    = req.cf?.city || null;
      const cfRegion  = req.cf?.region || null;
      const cfAsn     = req.cf?.asn || null;
      const cfAsOrg   = req.cf?.asOrganization || null;

      const visit = {
        id:          sanitize(body.id, 64) || crypto.randomUUID(),
        ts:          sanitize(body.ts, 40) || new Date().toISOString(),
        visitor:     sanitize(body.visitor, 64) || null,
        session:     sanitize(body.session, 64) || null,
        isNewSession: Boolean(body.isNewSession),
        path:        sanitize(body.path, 512) || "/",
        referrer:    sanitize(body.referrer, 512),
        ua:          sanitize(body.ua, 512),
        lang:        sanitize(body.lang, 32),
        screen:      sanitize(body.screen, 32),
        tzOffsetMin: Number.isFinite(+body.tzOffsetMin) ? +body.tzOffsetMin : null,
        // client-side geolocation (ipwho.is)
        ip:          sanitize(body.ip, 64),
        country:     sanitize(body.country, 64),
        countryCode: sanitize(body.countryCode, 8),
        region:      sanitize(body.region, 64),
        city:        sanitize(body.city, 64),
        asn:         sanitize(body.asn, 32),
        org:         sanitize(body.org, 128),
        isp:         sanitize(body.isp, 128),
        timezone:    sanitize(body.timezone, 64),
        // server-side (Cloudflare)
        ip_cf:       cfIp,
        country_cf:  cfCountry,
        city_cf:     cfCity,
        region_cf:   cfRegion,
        asn_cf:      cfAsn,
        asorg_cf:    cfAsOrg,
        _recv:       new Date().toISOString(),
      };

      const key = `visit:${visit.ts}:${visit.id}`;
      try {
        await env.VISITS_KV.put(key, JSON.stringify(visit), {
          expirationTtl: 60 * 60 * 24 * 365,   // keep for 1 year
        });
      } catch (err) {
        return text("kv-error", 500);
      }
      return text("ok");
    }

    // --- List visits (admin-only) ---------------------------------
    if (url.pathname === "/visits" && req.method === "GET") {
      if (!requireAdmin(req, env)) return text("unauthorized", 401);

      const limit = Math.min(1000, Number(url.searchParams.get("limit")) || 500);
      const list = await env.VISITS_KV.list({ prefix: "visit:", limit });
      const visits = [];
      for (const { name } of list.keys) {
        const raw = await env.VISITS_KV.get(name);
        if (raw) {
          try { visits.push(JSON.parse(raw)); } catch {}
        }
      }
      visits.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
      return json(visits);
    }

    // --- Precomputed stats (admin-only) ---------------------------
    if (url.pathname === "/stats" && req.method === "GET") {
      if (!requireAdmin(req, env)) return text("unauthorized", 401);

      const list = await env.VISITS_KV.list({ prefix: "visit:", limit: 1000 });
      const visits = [];
      for (const { name } of list.keys) {
        const raw = await env.VISITS_KV.get(name);
        if (raw) { try { visits.push(JSON.parse(raw)); } catch {} }
      }

      const uniq = (arr, key) => new Set(arr.map((v) => v?.[key]).filter(Boolean)).size;
      const countBy = (fn) => {
        const m = new Map();
        visits.forEach((v) => { const k = fn(v); if (k) m.set(k, (m.get(k) || 0) + 1); });
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      };

      const now = Date.now(), DAY = 86400000;
      const since = (cutoff) =>
        visits.filter((v) => v.ts && Date.parse(v.ts) >= cutoff).length;
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);

      return json({
        total:         visits.length,
        visitors:      uniq(visits, "visitor"),
        sessions:      uniq(visits, "session"),
        countries:     uniq(visits, "country"),
        today:         since(today.getTime()),
        last7d:        since(now - 7 * DAY),
        last30d:       since(now - 30 * DAY),
        topCountries:  countBy((v) => v.country || v.country_cf).slice(0, 10),
        topReferrers:  countBy((v) => { try { return v.referrer ? new URL(v.referrer).hostname : "(direct)"; } catch { return "(direct)"; } }).slice(0, 10),
        generated_at:  new Date().toISOString(),
      });
    }

    // --- Default -------------------------------------------------
    return json(
      { service: "pg-analytics", endpoints: ["POST /beacon", "GET /visits", "GET /stats"] },
      404
    );
  },
};
