// OpenRent Sourcing Bot — M1 entry point.
// Scrape Mo ke areas → fresh listings nikaalo → dedupe store me daalo → report.
// M2 me: scoring + Mo ko alert. M3 me: auto viewing request.

import 'dotenv/config';
import { config } from './config.js';
import { scrapeAll } from './scraper.js';
import { enrichNew } from './enrich.js';
import { scoreListing } from './score.js';
import { sendAlert, sendError } from './alert.js';
import { processViewings } from './viewing.js';
import { login } from './auth.js';
import { upsert, count, updateStatus } from './store.js';

function withinWorkingHours() {
  const h = new Date().getHours();
  const [start, end] = config.cadence.workingHours;
  return h >= start && h < end;
}

async function runOnce() {
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

  if (!added.length) return;

  // Sirf naye listings enrich karo (purane dobara fetch na hon)
  const enriched = await enrichNew(added);
  // Score do
  const scored = enriched.map(scoreListing);
  // Enriched + scored store me merge
  await upsert(scored.map((l) => ({ ...l, _forceUpdate: true })));

  for (const l of scored.slice(0, 10)) {
    const rr = l.response_rate != null ? `${l.response_rate}%` : 'n/a';
    console.log(`    + [${l.score}] ${l.listing_id} | £${l.price}/mo | ${l.beds}bed | ${l.hours_live}h | rr:${rr} | ${l.address || l.url}`);
  }
  if (scored.length > 10) console.log(`    ... +${scored.length - 10} more`);

  // Alert: sirf threshold ke upar wale naye listings (ye sab pehli baar dekhe gaye = duplicate-alert nahi)
  const worthy = scored.filter((l) => l.score >= config.alertThreshold).sort((a, b) => b.score - a.score);
  console.log(`  Above threshold (${config.alertThreshold}): ${worthy.length}`);
  if (worthy.length) {
    const result = await sendAlert(worthy);
    console.log(`  📧 Alert: ${result.sent ? 'SENT id=' + result.id : result.reason}`);
  }

  // ── M3: viewing requests (shadow/live per config) ──
  // Score gate minScore > alertThreshold, isliye sirf top listings yahan aate hain.
  const viewingCandidates = scored.filter((l) => l.score >= config.viewing.minScore);
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
