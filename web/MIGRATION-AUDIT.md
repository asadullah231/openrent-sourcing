# Migration Audit — openrent-sourcing-web → Cloudflare Workers (@opennextjs/cloudflare)

**Audited:** 2026-07-28 · **Verdict: MODERATE** (easy mechanics, one real operational risk) · Analysis only, no code changed.

---

## 1. Versions

| Item | Value | Notes |
|---|---|---|
| Next.js | `^15.1.0` | Check `package-lock.json` for the installed minor; bump to latest 15.x before migrating. |
| React / ReactDOM | `^19.0.0` | |
| Node engines | web: *not declared*; bot root `package.json`: `>=20` | Fine — adapter tooling needs Node ≥ 20. |
| Router | **App Router only** | Everything under `app/`; no `pages/`. |
| Runtime config | None | No `export const runtime` anywhere. |

**Adapter compatibility:** `@opennextjs/cloudflare` v1.x fully supports Next 15 / React 19 App Router. Requires `wrangler` ≥ 4, `nodejs_compat` flag, `compatibility_date ≥ 2024-09-23`.

## 2. Blockers

**No hard blockers, two things to verify:**

- **Node.js APIs in the web app itself:** none — `app/`, `lib/`, `components/`, `middleware.js` are all `fetch()`-based (NocoDB REST in [lib/data.js](lib/data.js), n8n webhook in the outreach/action routes).
- **⚠️ Bot code imported into the server bundle:** [app/api/search/route.js](app/api/search/route.js) imports `@bot/portals.js` and `@bot/enrich.js` — i.e. `../src/*` from *outside* the web app root (alias in [jsconfig.json](jsconfig.json)). The full import chain (`portals` → `scraper`, `scraper-rm`, `rm-location`, `search-url*`, `config`; `enrich` → `scraper`, `config`) was checked: **all plain `fetch()`, no Node APIs.** But `src/auth.js` uses `node:fs` / `node:path` — it is currently *not* in the web chain (only `main.js`/`viewing.js` import it). Any future import of `auth.js`, `store.js`, `alert.js`, or `viewing.js` from a route would need review. Worth a lint rule or comment.
- **Node Middleware (Next 15.2+):** not used — [middleware.js](middleware.js) is a trivial Edge-style redirect (`/login` → `/`). Supported. (If you later bump to Next 15.2+ do **not** add `runtime: 'nodejs'` to middleware — that is the known adapter gap.)
- **`export const maxDuration = 30`** in the search route is a Vercel-ism; Workers ignores it (harmless). Workers has no 10 s/30 s wall-clock cap — the limit is CPU time (default 30 s on paid), and this route is I/O-bound scraping, so it's actually *better off* on Workers.
- **Native binaries / full Node runtime:** none. Scraper is "plain HTTP, no browser" (no Playwright/Puppeteer). Leaflet/react-leaflet are client-only → static chunks, not the worker.
- **next/image:** not used anywhere (plain `<img>`). No loader work needed.

### ⚠️ The one real risk: scraping through Cloudflare egress

`/api/search` scrapes OpenRent and Rightmove server-side, and the enrich step fires up to 12 parallel listing-page fetches against OpenRent. Today those requests originate from Vercel IPs and work. From Workers they originate from **Cloudflare's egress ranges**, which anti-bot layers treat differently — Rightmove especially may start serving 403/challenge pages. **Test `/api/search` from a deployed worker *first*, before committing to the cutover.** If blocked, options: route scraping through the existing bot/VPS (n8n webhook → return results), or keep only this route elsewhere. This is the reason for the MODERATE rating.

## 3. Size risk

- Current build: `.next/server` = **1.8 MB**, `.next/static` = 1.2 MB (uncompressed). Static assets are served from Workers Assets and don't count toward the limit.
- Expected worker bundle (Next 15 runtime + routes + bot modules): **~5–7 MB raw ≈ 1.5–2.5 MiB gzipped**. Limits (post-gzip): 3 MiB free / 10 MiB paid.
- **Fits paid easily; might even squeeze under free** — but the free plan's 10 ms CPU/request makes SSR impractical, so plan on Workers Paid ($5/mo).
- Heaviest deps: `lucide-react` (33 MB on disk, tree-shaken — fine), `leaflet` + `react-leaflet` + `leaflet.markercluster` (client-only — fine). Nothing to trim server-side.
- Housekeeping (not size-relevant, just hygiene): the app root is littered with `build*.log`, `*.html` mockups, and `shot-*.png` — they're outside the build graph but shouldn't ship in git either.
- Measure the real number with `npx opennextjs-cloudflare build` then `npx wrangler deploy --dry-run`.

## 4. Memory risk (128 MB vs Vercel's 1024 MB)

- **`fetchAll()` in [lib/data.js:21](lib/data.js:21)** pulls up to **20,000 rows** per table into memory. Several paths call it multiple times per request:
  - `getListing()` → listings + drafts log + sent log (3 full-table loads, sequential).
  - `getHealth()` → listings + settings + sent log.
  - `patchListings()` → full listings table just to build an id map.
  With current table sizes (hundreds of listings, not thousands) this is nowhere near 128 MB; at the 20k-row cap with image JSON blobs per row it could reach a few tens of MB — still OK, but the pattern is O(table) per request. Post-migration improvement: use NocoDB `where=` filters instead of client-side `fetchAll().filter()`.
- **`/api/search`** holds all scraped portal results + 12 enriched listings in memory and deliberately slims the response — bounded and fine.
- No image manipulation, no file processing.
- Subrequest counts (Workers cap: 1000/request on paid): worst case here is ~20 pages × 3 tables + 12 enrich + portal scrapes ≈ well under 100. Fine.

## 5. Vercel lock-in

- **`@vercel/*` packages / Blob / KV / Postgres:** none (backend is external NocoDB; alerts via Resend from the *bot*, not this app).
- **ISR / `revalidate`:** none — every page and API route is `force-dynamic`. → **No KV/R2 incremental-cache binding needed.**
- **Cron jobs:** no `vercel.json` — no crons in this app (the 30-min scrape cron is the bot/n8n, outside the dashboard).
- **Env vars referenced by the deployed web code** (port all of these):

  | Variable | Where used | Type |
  |---|---|---|
  | `NOCODB_BASE_URL` | lib/data.js, src/config.js | var/secret-ish |
  | `NOCODB_TOKEN` | lib/data.js, src/config.js | **secret** |
  | `NOCODB_OR_LISTINGS_TABLE_ID` | lib/data.js | var |
  | `NOCODB_OR_SETTINGS_TABLE_ID` | lib/data.js, src/config.js (via search route import chain) | var |
  | `NOCODB_OR_LOG_TABLE_ID` | lib/data.js | var |
  | `N8N_OUTREACH_WEBHOOK` | api/outreach/run, api/listings/action | **secret** |

  Bot-only vars that do **not** need porting to the worker: `RESEND_API_KEY`, `OPENRENT_EMAIL`, `OPENRENT_PASSWORD` (used by `alert.js`/`auth.js`, which are outside the web import chain).

  With a recent `compatibility_date`, `process.env` is auto-populated from vars/secrets under `nodejs_compat` — no code changes.

## 6. Migration plan

**Difficulty: MODERATE.** The Next.js mechanics are easy (no Node APIs, no ISR, no next/image, no crons, trivial middleware, small bundle). The rating is driven by one thing: server-side scraping of OpenRent/Rightmove may behave differently from Cloudflare egress IPs. Validate that first — if it passes, this is effectively EASY.

### Ordered checklist

1. **De-risk first:** deploy a throwaway worker (steps 2–7 on a test name) and hit `/api/search` with a real OpenRent + Rightmove URL. If either portal blocks Cloudflare egress, decide the fallback (proxy scrape through the VPS bot / n8n) before proceeding.
2. `npm i next@15` (latest 15.x) and `npm i -D @opennextjs/cloudflare@latest wrangler@latest`.
3. Create `open-next.config.ts`:
   ```ts
   import { defineCloudflareConfig } from "@opennextjs/cloudflare";
   export default defineCloudflareConfig();
   ```
4. Create `wrangler.jsonc` (below).
5. Add to `next.config.mjs`:
   ```js
   import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
   initOpenNextCloudflareForDev();
   ```
6. Add scripts:
   ```json
   "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
   "deploy":  "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
   ```
   and `.open-next/` to `.gitignore`.
7. Confirm the `@bot/*` alias resolves in the OpenNext build (it bundles by import graph, so `../src/*` files are included — but verify `opennextjs-cloudflare build` succeeds since the files sit outside the app root).
8. Set env: non-secrets in `vars`; `wrangler secret put NOCODB_TOKEN` and `N8N_OUTREACH_WEBHOOK` (+ `NOCODB_BASE_URL` if preferred as secret).
9. `npm run preview` — test: dashboard listings, map page, paste-a-link search (both portals), queue/hide bulk actions, settings save (merge logic), outreach trigger.
10. `npx wrangler deploy --dry-run` — confirm gzip size < 10 MiB (expect ~2 MiB).
11. Deploy on Workers Paid, attach domain, smoke-test, flip DNS, pause/delete the Vercel project. The mode-change lockout in `api/settings` is code-level, so it carries over unchanged.

### wrangler.jsonc

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "openrent-sourcing-web",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "vars": {
    "NOCODB_OR_LISTINGS_TABLE_ID": "…",
    "NOCODB_OR_SETTINGS_TABLE_ID": "…",
    "NOCODB_OR_LOG_TABLE_ID": "…"
  }
  // Secrets (wrangler secret put): NOCODB_BASE_URL, NOCODB_TOKEN, N8N_OUTREACH_WEBHOOK
  // No KV/R2 bindings needed: every route is force-dynamic, no ISR/revalidate.
}
```
