// OpenRent Sourcing Bot — M1 entry point.
// Scrape Mo ke areas → fresh listings nikaalo → dedupe store me daalo → report.
// M2 me: scoring + Mo ko alert. M3 me: auto viewing request.

import 'dotenv/config';
import { config, hydrateConfig } from './config.js';
import { scrapeAll } from './scraper.js';
import { enrichNew } from './enrich.js';
import { scoreListing } from './score.js';
import { sendAlert, sendError } from './alert.js';
import { processViewings } from './viewing.js';
import { login } from './auth.js';
import { upsert, count, updateStatus, all } from './store.js';

function withinWorkingHours() {
  const h = new Date().getHours();
  const [start, end] = config.cadence.workingHours;
  return h >= start && h < end;
}

async function runOnce() {
  // Mo ki dashboard settings NocoDB se lo — bina iske bot defaults pe chalta rahega
  // aur dashboard pe kiye gaye changes ignore ho jayenge.
  await hydrateConfig();

  const stamp = new Date().toLocaleString('en-GB');
  console.log(`\n[${stamp}] OpenRent scrape start (areas: ${config.areas.map((a) => a.name).join(', ')})`);

  if (!withinWorkingHours()) {
    console.log('  Outside working hours — skip (insaani pattern).');
    return;
  }

  let listings;
  try {
    listings = await scrapeAll();
  } catch (err) {
    console.error(`  ❌ SCRAPE FAILED: ${err.message}`);
    await sendError(`OpenRent scrape failed: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const fresh = listings.filter(
    (l) => l.hours_live != null && l.hours_live <= config.freshWithinHours
  );

  // Dedupe pehle store me daalo (raw), phir SIRF naye ko enrich karo — purane dobara fetch na hon.
  const { added, total, seenBefore } = await upsert(fresh);

  console.log(`  Scraped: ${listings.length} | fresh (<${config.freshWithinHours}h): ${fresh.length}`);
  console.log(`  NEW saved: ${added.length} | already-seen skipped: ${seenBefore} | store total: ${total}`);

  // Naye listings ho to enrich + score + alert (sirf naye pe alert = spam nahi)
  if (added.length) {
    const enriched = await enrichNew(added);
    const scored = enriched.map(scoreListing);
    await upsert(scored.map((l) => ({ ...l, _forceUpdate: true })));

    for (const l of scored.slice(0, 10)) {
      const rr = l.response_rate != null ? `${l.response_rate}%` : 'n/a';
      console.log(`    + [${l.score}] ${l.listing_id} | £${l.price}/mo | ${l.beds}bed | ${l.hours_live}h | rr:${rr} | ${l.address || l.url}`);
    }
    if (scored.length > 10) console.log(`    ... +${scored.length - 10} more`);

    const worthy = scored.filter((l) => l.score >= config.alertThreshold).sort((a, b) => b.score - a.score);
    console.log(`  Above threshold (${config.alertThreshold}): ${worthy.length}`);
    if (worthy.length) {
      const result = await sendAlert(worthy);
      console.log(`  📧 Alert: ${result.sent ? 'SENT id=' + result.id : result.reason}`);
    }
  }

  // ── M3: viewing requests ──
  // Candidates STORE se (sirf is run ke naye nahi) — jo eligible hain aur abhi tak
  // request nahi gayi, un pe chale. Idempotent status hi double se bachata hai.
  const allStored = await all();
  const viewingCandidates = allStored
    .filter((l) => (l.score ?? 0) >= config.viewing.minScore)
    .filter((l) => (l.viewing_status || 'new') !== 'requested');
  if (viewingCandidates.length) {
    console.log(`\n  🎯 Viewing (${config.viewing.mode}): ${viewingCandidates.length} candidate(s) ≥${config.viewing.minScore}`);
    try {
      const jar = await login();
      const vr = await processViewings(viewingCandidates, jar, updateStatus);
      console.log(`  Viewing result: built=${vr.built} drafted=${vr.drafted} sent=${vr.sent} skipped=${vr.skipped} capped=${vr.capped}`);
    } catch (err) {
      console.error(`  ❌ VIEWING FAILED: ${err.message}`);
      await sendError(`OpenRent viewing step failed: ${err.message}`);
    }
  }
}

const once = process.argv.includes('--once');

if (once) {
  await runOnce();
} else {
  // Simple loop with human jitter. Cron pe daalna ho to isko --once se chalao.
  console.log(`Loop mode: every ~${config.cadence.baseIntervalMin}min ±${config.cadence.jitterMin}. Ctrl+C to stop.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await runOnce();
    const jitter = (Math.random() * 2 - 1) * config.cadence.jitterMin;
    const waitMs = (config.cadence.baseIntervalMin + jitter) * 60_000;
    console.log(`  next run in ${Math.round(waitMs / 60000)} min`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

export { runOnce, count };
