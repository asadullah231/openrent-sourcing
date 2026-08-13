# CLAUDE.md — OpenRent Sourcing (Mo)

Property sourcing bot + control dashboard for a single client, **Mo**. The bot
scrapes OpenRent (and read-only Rightmove) saved searches, scores fresh listings,
and sends viewing requests from **Mo's own OpenRent account**. The dashboard
(Vercel) is where Mo controls searches, filters, folders, outreach, and the
kill switch.

> This is NOT a generic multi-user SaaS. One client, one OpenRent account. Any
> prompt/plan that assumes Prisma, TypeScript, Inngest, per-user tenant isolation,
> or a SQL ORM is describing a **different** app — translate its *idea* to this
> stack, don't graft its stack on.

---

## Repo layout (monorepo, two deploy targets)

```
openrent-sourcing/
├── src/                  # THE BOT — plain Node.js (ESM), runs on Hostinger VPS
│   ├── main.js           #   pipeline orchestrator (scrape→dedupe→enrich→score→alert→viewing)
│   ├── config.js         #   sync `config` object, hydrated from NocoDB settings each run
│   ├── scraper.js        #   OpenRent search scrape (plain HTTP)
│   ├── scraper-rm.js     #   Rightmove scrape (READ-ONLY — no outreach)
│   ├── search-url*.js    #   parse a pasted OpenRent/Rightmove search URL → params
│   ├── rm-location.js    #   Rightmove location resolver
│   ├── portals.js        #   portal (openrent|rightmove) helpers
│   ├── enrich.js         #   lazy per-listing enrich (landlord name, address, response rate)
│   ├── score.js          #   SCORING ENGINE — 0-100 from weighted signals (already exists)
│   ├── message-template.js #  outreach message builder w/ {{variable}} interpolation (exists)
│   ├── viewing.js        #   M3 — send viewing request; SAFETY rails (cap, idempotent, shadow)
│   ├── auth.js           #   OpenRent login → cookie jar; authFetch()
│   ├── alert.js          #   email alert (worthy listings) + error alert (exists)
│   └── store.js          #   NocoDB listings table — upsert/dedupe by listing_id
├── web/                  # THE DASHBOARD — Next.js 15 App Router (deployed on Vercel)
│   ├── app/              #   pages: / (search), /outreach, /searches, /searches/view,
│   │                     #          /map, /queue, /sent, /listing/[id], /settings
│   ├── app/api/          #   route handlers: /listings, /listings/action, /outreach/run,
│   │                     #                   /search, /search/save, /settings, /drafts
│   ├── lib/data.js       #   NocoDB read/write for the dashboard (mirrors bot's store.js)
│   └── components/       #   plain React + inline styles (NO shadcn); folder-rooms.js etc.
├── run.sh                # VPS runner — sets proxy env BEFORE node, then `node src/main.js --once`
└── .env                  # NocoDB creds + table IDs + proxy (NEVER commit real values)
```

The `vps/` Patchright scrapers referenced elsewhere belong to the **car-arbitrage**
sibling project, not this repo. This repo's OpenRent scrape is plain HTTP (`src/scraper.js`).

---

## Tech stack (exact)

**Dashboard (`web/`)** — `"type": "module"`
- Next.js **^15.1.0**, **App Router**
- React **^19.0.0** / react-dom ^19
- **Plain JavaScript** (no TypeScript)
- **Tailwind ^3.4.17** is installed, but components mostly use **inline styles + CSS vars**
  (`var(--brass)`, `var(--surface)`, `var(--paper)`, `var(--mist)`, `var(--green)`, `var(--rust)`)
- `next-themes` (light/dark), `lucide-react` (icons)
- Map: `leaflet` + `react-leaflet` + `leaflet.markercluster`
- **No shadcn/ui, no TanStack Table, no nuqs, no ORM.** State = React `useState`/`useMemo`.

**Bot (`src/`)**
- Plain Node.js ESM, `engines.node >= 20`. Only dep: `dotenv`.
- No browser automation here (plain `fetch`). Login via cookie jar (`auth.js`).

**Database: NocoDB** (v2 REST API, `xc-token` header). No SQL access, no migrations.
Three tables, all keyed by env var IDs. "Schema changes" = adding fields in the
NocoDB UI, or (preferred for small data) storing structured blobs in the settings row.

**Hosting**
- Dashboard → Vercel (branch **`main`**; every push auto-deploys — SHIP RULE)
- Bot → Hostinger VPS `187.127.75.106`, triggered by **n8n** via `./run.sh`
- VPS SSH port is closed externally — run VPS commands through the n8n SSH-node
  credential `grMG9FFshdYwLVc7`, not direct ssh.

---

## Data flow (end to end)

1. **Mo pastes an OpenRent search URL** on `/` (or manages saved searches on `/searches`).
   → `web/app/api/search/save` writes it into the **settings** row's `areas[]`
   (JSON blob), deduped by `areaKey()` (source|slug|sorted-params).
2. **Bot run** (`run.sh` → `main.js --once`): `hydrateConfig()` pulls settings from
   NocoDB into the sync `config` object.
3. **Scrape** (`scraper.js`) each enabled area → raw listings. Fresh = `hours_live ≤ freshWithinHours` (default 24).
4. **Dedupe + store** (`store.js upsert`): keyed by **`listing_id`**. Existing rows
   keep their `viewing_status`/enrichment (PROTECTED_ON_PATCH guards them); only new rows insert.
5. **Enrich + score new** (`enrich.js` → `score.js`): landlord name, address, response
   rate; `scoreListing()` → 0-100 + reasons. Written back with `_forceUpdate` (patch).
6. **Alert** (`alert.js`): listings with `score ≥ alertThreshold` emailed to Mo.
7. **Viewing** (`viewing.js processViewings`): candidates from the **whole store**
   (not just this run) where `source=openrent`, `score ≥ viewing.minScore`, and
   `viewing_status ≠ requested`. Status set to `requested` **before** the POST
   (idempotency — OpenRent allows one request per property, no undo).
8. **Dashboard** reads it all back via `lib/data.js` and renders folders, queue, sent.

**Dashboard-driven send:** Mo can select rooms in a folder → `/api/listings/action`
marks them `viewing_status:'queued'` and pings the n8n outreach webhook; the bot's
next run sends queued listings with priority (they bypass the score gate).

---

## Listing "lifecycle" TODAY (the weak point — see AUDIT)

There is **no real state machine**. `viewing_status` is a free-string field with
these values seen in code: `new` (default), `queued`, `requested`, `hidden`.
Transitions are set ad-hoc across `viewing.js`, `store.js`, `lib/data.js`, and
`api/listings/action`. No event history table beyond the send **log** table
(`kind='draft'|'sent'` rows). This is Prompt 2's target.

---

## Cron / jobs / cap enforcement

- **Trigger:** n8n schedule → SSH-node → `cd /opt/openrent-sourcing && ./run.sh`.
  (A `loop.js`-style always-on runner exists in the car-arbitrage sibling; OpenRent
  currently relies on the n8n schedule + `--once`.)
- **Daily cap:** enforced in **application code**, two places — must stay in sync:
  - Bot: `src/viewing.js` `sentToday()` counts today's `kind='sent', mode='live'`
    log rows; `processViewings` stops at `config.viewing.dailyCap`.
  - Dashboard: `web/app/api/listings/action` recomputes `room = cap - sentToday`
    before queueing a manual send.
  - **Default cap = 15** (`viewing.dailyCap` in settings). ⚠️ The generic prompt
    pack says 18 — ours is 15.
- **Cap race condition:** a manual "Send" racing the cron run can exceed the cap
  because both read-then-write the counter without a lock. (Known — AUDIT item.)

---

## Database schema (NocoDB)

**listings** (`NOCODB_OR_LISTINGS_TABLE_ID`) — one row per `listing_id`
- `listing_id` (dedupe key), `source` ('openrent'|'rightmove', default openrent)
- `url`, `title`, `address`, `postcode`, `price`, `beds`, `area`
- `images` (JSON string), `image`, `lat`, `lng`, `distance_km`
- `hours_live`, `response_rate`, `landlord_name`, `enriched_at`
- `score`, `score_reasons`
- `viewing_status` ('new'|'queued'|'requested'|'hidden'), `requested_at`, `sent_message`
- `Id` (NocoDB internal PK — needed for PATCH), `CreatedAt`, `scraped_at`

**settings** (`NOCODB_OR_SETTINGS_TABLE_ID`) — a **single row** `key='main'`,
`value` = one big JSON blob: `{ areas[], filters, viewing{mode,autopilot,dailyCap,
minScore,perRunCap}, freshWithinHours, alertThreshold, roomNotes{}, savedViews... }`

**log** (`NOCODB_OR_LOG_TABLE_ID`) — outreach audit, one row per attempt
- `listing_id`, `kind` ('draft'|'sent'), `mode` ('shadow'|'live'), `message`,
  `day` (YYYY-MM-DD), `sent_at`/`created_at`

No foreign keys, no join tables, no unique constraint enforced by the DB —
`listing_id` uniqueness is enforced by `upsert()` in code only.

---

## OpenRent credentials / session

Single account (Mo's). Login in `src/auth.js` → in-memory cookie jar per run
(not persisted, no encryption-at-rest layer — re-login each run). No per-user
credential storage because there is one user. Creds come from `.env` on the VPS.

---

## Environment variables

| Var | What |
|---|---|
| `NOCODB_BASE_URL` | NocoDB instance URL |
| `NOCODB_TOKEN` | NocoDB API token (`xc-token`) |
| `NOCODB_OR_LISTINGS_TABLE_ID` | listings table |
| `NOCODB_OR_SETTINGS_TABLE_ID` | settings (single `main` row) |
| `NOCODB_OR_LOG_TABLE_ID` | outreach log (drafts + sends) |
| `PROXY_IPS`,`PROXY_PORT`,`PROXY_USER`,`PROXY_PASS` | VPS proxy (OpenRent 405s from datacenter IPs) |
| `N8N_OUTREACH_WEBHOOK` | dashboard → bot "send now" trigger (optional; falls back to settings) |
| OpenRent login creds | in VPS `.env` (used by `auth.js`) |

Secrets live in `D:/Projects/.secrets/master.env` — never commit, never echo.

---

## Commands

```bash
# Dashboard (web/)
cd web && npm run dev            # next dev
cd web && npm run build          # next build (run before every commit)
cd web && npm run lint           # next lint
# No typecheck (plain JS). No test script in web/ yet.

# Bot (repo root)
npm run scrape                   # node src/main.js  (loop mode)
npm run test                     # node src/main.js --once  (single run — NOT a test suite)
./run.sh                         # VPS: sets proxy, runs one --once pass
```

⚠️ There is **no real test suite** and **no typecheck** (plain JS). The prompt-pack
instruction "run `npm run typecheck && npm run build`" only half-applies: `build`
works, `typecheck` does not exist.

---

## Known weak points (blunt — expanded in docs/AUDIT.md)

- **No state machine.** `viewing_status` is a free string mutated in ≥4 files
  (`viewing.js`, `store.js`, `lib/data.js`, `api/listings/action/route.js`).
  Illegal transitions are possible; nothing throws.
- **Cap race.** Manual send + cron read-then-write the daily counter with no lock
  (`viewing.js sentToday` + `api/listings/action`). Cap can be exceeded.
- **Thin event history.** Only send attempts are logged; queue/hide/skip/expire
  and failures-with-error are not captured as events.
- **No dedup constraint at the DB.** `listing_id` uniqueness is code-only; a
  concurrent double-insert could duplicate.
- **Two cap enforcers, one setting.** Bot and dashboard each recompute the cap;
  they can disagree.
- **Session re-login every run**, not verified before a batch; an expired/blocked
  session surfaces as a mid-run failure, not a clean `needs_reauth` pause.
- **Repo root littered** with `run-*.log` debug files committed to git.

## Phase 1 — Orders (sourcing platform, 13 Aug)

PRD ka Foundation phase: **Order system ka markaz hai, property nahi.**
NocoDB pe hi (koi Postgres/Prisma NAHI — Asad ka faisla, migration baad me).

Do nayi tables (base py6zb9g3mctigb1):
- `openrent_orders` (m3jsbx9q3isf7yf) — council/client requirement + budget + rate
- `openrent_order_properties` (mfw5ojxvcub97uy) — order↔listing match rows:
  score breakdown, profitability, shortlist_status, `rejected` (yaadasht flag),
  `listing_snapshot` (JSON — Find ke results BOT KE STORE ME NAHI jate, /api/search
  wala usool; snapshot yahin rehta hai)

Naye env vars (root .env + web/.env.local + **Vercel me add karna lazmi**):
`NOCODB_OR_ORDERS_TABLE_ID`, `NOCODB_OR_ORDER_PROPS_TABLE_ID`

Naye modules (bot ke protected files CHHUE NAHI):
- `src/order-match.js` — hard filters. Usool: sirf CONFIRMED violation pe reject;
  unknown data (enrich pending) pass hota hai, score me "unverified" penalty.
  Over-budget = alag lane, normal match score KABHI nahi (PRD hard rule).
- `src/score.js` — `scoreAgainstOrder()` ADD hua (scoreListing untouched).
  PRD weights: budget 30 / location 25 / beds 15 / type 10 / avail 10 / furn 5 / EPC 5.
- `src/profitability.js` — rate − rent − agent_fee − other_costs. Costs order me
  na hon to 0 + `costs_specified:false` → UI "before costs" dikhata hai.
- `src/order-search.js` — order → OpenRent search object (save-filter wala pattern).
- `web/lib/orders.js` + `/api/orders*` + `/orders` pages.

**Enrich strategy (mehnga sabaq, Bromley test):** sab se sasti "2-4 bed" listings
(£500-900) taqreeban SAB "Room in a Shared House" nikleen. Is liye:
1. Enrich order = budget ke QAREEB pehle (price DESC), junk aakhir me.
2. Enrich-discovered rejects `rejected:true` row ke tor pe SAVE hote hain —
   agli run title prior-merge se utha kar pehle pass me reject karti hai.
   Har run coverage JAMA hoti hai (Bromley: run 1 = 2 verified, run 4 = 4/4
   verified + 106 junk yaadasht me). Listing OpenRent se hate to stale-cleanup
   row khud urata hai (shortlisted kabhi nahi urti).

## CRM Foundation — Sourcing Leads (13 Aug)

Phase 1 ke upar CRM lens (commit `5a2ced8`). Product ab "OpenRent Sourcing CRM":

- **Sourcing Lead = `order_properties` row hi** — koi nayi table nahi. 4 nayi
  columns: `lead_status` (12-stage pipeline: new→matched→shortlisted→
  ready_to_contact→contacted→awaiting_response→interested→viewing→negotiation→
  deal→won/lost), `outreach_status`, `next_action_date`, `loss_reason`.
  `shortlist_status` purana lens hai — `lib/leads.js` dono sync rakhta hai.
  Lead ref derived: `OP-{rowId}` (column nahi).
- **`openrent_activities`** (`NOCODB_OR_ACTIVITIES_TABLE_ID=m5drw7uwh378vi3`) —
  SIRF insaani kaam store hota hai (outreach log, status change, note,
  shortlist, per-run search summary). "Property discovered / Match calculated"
  store NAHI hote — `derivedLeadEvents()` lead row se banata hai (warna har
  Find run 100+ kachra rows likhta).
- **Outreach = OpenRent ke andar, manually.** Email composer jaan-boojh kar
  nahi banaya — "Open OpenRent" kholta hai, user wahan message bhejta hai,
  phir "Log outreach" yahan record karta hai (type/notes/next follow-up).
  Automated send abhi bhi Phase 3 hai.
- Pages: `/dashboard` (funnel + priority actions), `/leads` (CRM table,
  over-budget default hidden), `/leads/[id]` (workbench), `/properties`
  (dedupe by listing_id — ek property kai orders se match ho sakti hai),
  order detail pe funnel strip.
- Lib: `web/lib/leads.js` (model + funnel counts), `web/lib/activities.js`.
  APIs: `/api/leads/[id]` (PATCH), `/[id]/outreach`, `/[id]/note`.
- Phase 2 me banenge: Landlords/Agents records, Kanban, tasks table.
  Khali placeholder pages nav me NAHI rakhe.
