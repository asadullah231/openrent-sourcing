# OpenRent Sourcing Bot

Property sourcing automation for OpenRent. Watches saved areas, scores new listings, alerts, and (opt-in) sends viewing requests automatically. SaaS shape: each user runs on their own login/session.

## How it works

```
cron → scrape (search page embedded arrays) → dedupe → enrich (title, response rate, deposit, EPC)
     → score (response rate, freshness, proximity, price, EPC) → email alert
     → viewing request (shadow: draft only · live: auto-send, with safety rails)
```

No browser / no proxies needed — OpenRent read side is plain HTTP.

## Structure

- `src/` — the bot
  - `scraper.js` — search page → listing objects (`isLive`, 429-aware)
  - `enrich.js` — listing detail (title, address, response rate, deposit, furnishing, EPC)
  - `score.js` — 0-100 score + reason
  - `alert.js` — Resend email (deals table)
  - `auth.js` — login + `.ASPXAUTH` session persist
  - `viewing.js` — viewing request builder + safety rails (shadow/live, cap, kill switch, idempotent)
  - `store.js` — local JSON store + dedupe (NocoDB-ready)
  - `config.js` — reads `data/settings.json` (dashboard-editable)
- `web/` — Next.js control-panel dashboard (listings, viewing queue, settings)
- `data/settings.json` — the control panel: areas, filters, template, mode, cap, kill switch

## Run

```bash
npm install
node src/main.js --once      # one pass
node src/main.js             # loop with human jitter

cd web && npm install && npm run dev   # dashboard at localhost:3000
```

## Safety

- `viewing.mode: 'shadow'` builds requests but **never sends** — flip to `'live'` only after review.
- Viewing form is one-shot per property; sends are idempotent and capped.
- Credentials live in `.env` (gitignored). User's listings/session are gitignored too.

Env: `OPENRENT_EMAIL`, `OPENRENT_PASSWORD`, `RESEND_API_KEY`.
