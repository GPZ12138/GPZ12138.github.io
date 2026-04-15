# `pg-analytics` — Cloudflare Worker backend

The site's admin dashboard works out-of-the-box using only browser
`localStorage`, but that means you **only see visits from the browser you
are currently looking at**. To aggregate visits from every real visitor
across every device, deploy this tiny Cloudflare Worker. Free tier is
more than enough for a personal site.

## One-time setup (≈ 5 minutes)

Prereqs: a free Cloudflare account and Node 18+.

```bash
# 1. install wrangler
npm install -g wrangler
wrangler login                         # opens a browser to authorize

# 2. create the KV namespace that stores visits
cd worker
wrangler kv:namespace create VISITS_KV
# copy the printed `id` into wrangler.toml (replace REPLACE_WITH_KV_NAMESPACE_ID)

# 3. set the admin read token (any long random string)
wrangler secret put ADMIN_TOKEN
# paste a random token when prompted; save it in secrets/ADMIN_CREDENTIALS.md

# 4. deploy
wrangler deploy
# note the URL it prints — e.g. https://pg-analytics.<you>.workers.dev
```

## Wire the site to the worker

Edit `admin/admin.js` (or create `admin/admin.local.js` alongside it and
include it via a `<script>` tag in `admin/index.html`) and set:

```js
window.PG_ANALYTICS_BACKEND    = "https://pg-analytics.<you>.workers.dev";
window.PG_ANALYTICS_ADMIN_TOKEN = "<the ADMIN_TOKEN value>";
```

Also set the same backend URL for the tracker itself, so new visits are
forwarded to the worker. Inline at the top of the main `index.html`:

```html
<script>window.PG_ANALYTICS_BACKEND = "https://pg-analytics.<you>.workers.dev";</script>
<script src="analytics.js?v=1" defer></script>
```

After the next deploy + a fresh page load, every real visit lands in KV
within seconds. Reload the admin dashboard — `data source` now reads
`Cloudflare Worker + localStorage` and totals cover all visitors.

## Endpoints

| Method | Path     | Auth                  | Response                                   |
|-------:|----------|-----------------------|--------------------------------------------|
| POST   | /beacon  | none (public write)   | `ok`                                       |
| GET    | /visits  | `X-Admin-Token` header | JSON array of visits, newest first         |
| GET    | /stats   | `X-Admin-Token` header | pre-aggregated KPIs + top countries/refs   |

`/beacon` is intentionally open — the tracker needs to POST from any
visitor's browser — but the data it stores is only useful to you, and
the read endpoints are admin-only.

## Data retention

Each visit is stored with a 1-year TTL. After that Cloudflare expires
the key automatically. To wipe everything immediately:

```bash
wrangler kv:key list --binding VISITS_KV | jq -r '.[].name' \
  | xargs -I{} wrangler kv:key delete --binding VISITS_KV {}
```

## Privacy / GDPR posture

- The client tracker (`analytics.js`) respects `navigator.doNotTrack`.
- No third-party analytics; all data lives in your Cloudflare account.
- No cookies are set. IDs are `localStorage` / `sessionStorage` values
  scoped to the site origin.
- Client-side IP geolocation uses `ipwho.is` (stated privacy policy:
  https://ipwho.is/).

## Local dev

```bash
wrangler dev
curl http://localhost:8787/beacon -X POST \
  -H "Content-Type: application/json" \
  -d '{"id":"t1","ts":"2026-04-15T12:00:00Z","visitor":"vA","session":"sA","path":"/","ua":"local"}'
curl http://localhost:8787/visits -H "X-Admin-Token: $YOUR_TOKEN"
```
