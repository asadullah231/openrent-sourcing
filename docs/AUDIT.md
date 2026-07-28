# AUDIT — OpenRent Sourcing (Mo)

Honest state-of-the-code audit against the *goals* in the prompt pack, but graded
on **our real stack** (Next.js 15 + plain JS + NocoDB + plain-HTTP bot), single
client (Mo), not a multi-user SaaS. No app code changed to write this.

> **Reading note.** The prompt pack assumes Prisma/TypeScript/Inngest/multi-tenant.
> Several of its asks are already solved here in a simpler form (scoring, dedup,
> templates, alerts, safety rails). Where that's true I say so — building the
> "SaaS" version would be re-work, not progress.

---

## Grades

### 1. Reliability — **C**
- `main.js` wraps scrape + viewing in try/catch and emails on failure
  (`sendError`) — good. But there is **no retry/backoff** in the OpenRent
  plain-HTTP path (`scraper.js`, `auth.js`, `viewing.js`); a transient 5xx just
  fails the step. (The retry/backoff we added lives in the car-arbitrage `vps/`
  scraper, not here.)
- Session: `auth.js` re-logs in every run; an expired/blocked session becomes a
  mid-run throw, not a clean pause. No `needs_reauth` state.
- No dead-letter / failed-queue: a listing that fails to send is not recorded as
  a retryable failure — it's just not `requested`, so next run tries it blindly again.
- **Evidence:** `src/main.js:38-46` (scrape catch), `src/viewing.js` (no retry
  around the POST), `src/auth.js` (login per run).

### 2. Observability — **D**
- If Mo asks "why did only 4 of my 15 go out today?", the app **cannot answer
  cleanly**. The send **log** table (`kind='sent'`) shows *what sent*, but not
  *why the rest didn't* (cap? score gate? shared-room filter? enrich fail?).
  Those reasons are `console.log`-only on the VPS, lost after the run.
- No `runs` table: no per-run record of found/sent/failed/skipped with reasons.
- **Evidence:** `src/main.js:70-95` logs counts to stdout only; `src/viewing.js`
  skip reasons never persisted.

### 3. Data model — **C-**
- Dedup **is** done, by `listing_id`, correctly (`store.js upsert`, PROTECTED_ON_PATCH
  stops status clobber). Better than the pack assumes.
- BUT: `viewing_status` is a **free string**, not an enum/state machine; mutated in
  ≥4 files. No `listing_events` history. No DB-level unique constraint (code-only).
  A listing in two saved searches is currently one row (good) but the search→listing
  link is implicit (`area` string match), not a join.
- **Evidence:** `src/store.js:38-45` (protected patch), `src/viewing.js` +
  `web/lib/data.js` + `web/app/api/listings/action/route.js` all set `viewing_status`.

### 4. Concurrency — **D**
- **Cap race is real.** `viewing.js sentToday()` and `api/listings/action` both
  read-then-write the daily counter with no lock. Cron + manual "Send now"
  overlapping can push past 15.
- Two overlapping bot runs (n8n misfire, or manual + cron) would double-process the
  same candidates — idempotency on `requested` helps, but the read-modify-write
  window is unguarded.
- No concurrency key / single-flight. (The car-arbitrage sibling has a `loop.js`
  busy-guard; OpenRent doesn't.)
- **Evidence:** `src/viewing.js sentToday()`, `web/app/api/listings/action/route.js:74-90`.

### 5. Security — **C** (context: single account, so blast radius is small)
- One OpenRent account (Mo's). No multi-tenant isolation needed — the pack's
  "user A vs user B" section **does not apply**. Grading on what matters here:
- Creds in VPS `.env`, **not encrypted at rest**, re-login per run (no stored
  session token to leak). NocoDB token is the crown jewel — it's in `.env` and in
  Vercel env; ensure it's never returned to the client (dashboard reads go through
  server components / route handlers — spot-check passed, but no systematic audit).
- **Evidence:** `.env` (plaintext creds), `src/auth.js`.

### 6. Frontend — **B-**
- Genuinely decent now: folder view has search, status tabs, price filter, sort,
  table/card/**kanban**, saved views, per-room notes, analytics strip (added 28 Jul).
  This already covers big chunks of the pack's Prompt 4/5/8.
- Gaps: loading/empty/error states are inconsistent across pages; mobile kanban
  drag is weak (touch); no command palette; filters aren't URL-persisted (so a
  filtered view isn't a shareable link).
- **Evidence:** `web/components/folder-rooms.js` (strong), other pages vary.

### 7. Performance — **C+**
- `lib/data.js` and `store.js` both `fetchAll()` — paginate NocoDB up to 20×1000.
  Every dashboard page load pulls **all** listings then filters client-side. Fine
  at current volume, will drag past a few thousand rows.
- No cursor pagination, no server-side filtering. Map isn't lazy-loaded off other routes.
- **Evidence:** `web/lib/data.js:21-33` `fetchAll`, `web/app/searches/view/page.js`
  pulls all then filters.

---

## Roadmap (sorted by impact ÷ effort — our stack, not the pack's)

| # | Item | Effort | Impact | Why |
|---|------|:--:|:--:|-----|
| 1 | **Cap lock (single source of truth)** | S | High | One `sentToday`+reserve path both callers use; kills the over-cap race. Small, protects Mo's account. |
| 2 | **State machine in `lib/listing-state.js`** | S | High | One place defines legal `viewing_status` transitions; illegal throws. Foundation for everything below. |
| 3 | **`runs` + richer `events` logging** | M | High | Persist per-run found/sent/failed/**skip-reason**. Answers "why only 4?". Reuses the existing log table + a new settings/table blob. |
| 4 | **Retry+backoff in OpenRent HTTP path** | S | High | Port the pattern we already wrote for the car scraper into `scraper.js`/`viewing.js`. Transient 5xx no longer loses a run. |
| 5 | **`needs_reauth` clean pause** | S | Med | Verify session before a batch; on auth fail, pause + banner + alert instead of mid-run throw. |
| 6 | **/runs history UI** | M | Med | Table of recent runs + per-run event timeline + "retry failed". Depends on #3. |
| 7 | **Scoring surfaced in UI** | S | Med | `score.js` already computes score+reasons; show the breakdown on hover (the pack's Prompt 6 is mostly *done* server-side). |
| 8 | **URL-persisted filters (shareable views)** | M | Med | Move folder filter state into the URL; saved views become links. No nuqs needed — plain `useSearchParams`. |
| 9 | **Server-side listing filter + pagination** | M | Low(now) | Only matters past a few thousand rows; NocoDB `where=` supports it. Defer until volume grows. |
| 10 | **Message template A/B + reply tracking** | L | Med | `message-template.js` exists; add variants + record replies → real analytics. Bigger lift. |
| 11 | **Notification rules + PWA push/Telegram** | L | Med | `alert.js` does email; generalise to rules + channels. Nice, not urgent for one user. |
| 12 | **Repo hygiene: delete committed `run-*.log`** | S | Low | Cleanliness; they shouldn't be in git. |

**Explicitly NOT recommended** (pack asks, wrong for us): Prisma migration,
TypeScript conversion, Inngest, shadcn/TanStack rewrite, multi-tenant isolation
tests. Each is days-to-weeks of rework on a working single-user system for no
user-visible gain.

---

## The 3 things I would fix first, and why

1. **Cap lock (#1).** It's the only bug here that can *harm Mo* — exceeding the
   daily request cap on his real OpenRent account risks his standing on the
   platform. Small fix, highest stakes.
2. **State machine (#2).** Cheap, and it's the foundation the pack is right about:
   once `viewing_status` transitions live in one file and illegal moves throw, every
   later feature (runs UI, kanban server-side, retry) stops introducing status bugs.
3. **Run + skip-reason logging (#3).** Turns the bot from a black box into something
   Mo (and we) can actually debug: "4 of 15 sent — 6 below score gate, 3 shared-room
   filtered, 2 enrich-failed." That single answer is most of the pack's observability
   ask, at a fraction of the cost.
