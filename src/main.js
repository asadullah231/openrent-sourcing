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
  // ⚠️ VPS pe ye script SEEDHA mat chalao — `./run.sh` se chalao.
  // Wajah: OpenRent datacenter IPs pe 405 deta hai (test kiya, 22 Jul).
  // run.sh proxy set karta hai node chalne se PEHLE — Node ka proxy support
  // env vars sirf process shuru hote waqt parhta hai, baad me nahi.

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
    // Rightmove Phase A = READ-ONLY (23 Jul). Rightmove pe OpenRent jaisa
    // "request viewing" nahi hota — agent enquiry form/phone hoti hai. Jab tak
    // wo flow na bane, Rightmove listings sirf dashboard pe dikhti hain, contact
    // nahi jata. (source undefined = purani OpenRent listings, wo chalein.)
    .filter((l) => (l.source || 'openrent') === 'openrent')
    .filter((l) => (l.score ?? 0) >= config.viewing.minScore)
    .filter((l) => (l.viewing_status || 'new') !== 'requested');
  if (viewingCandidates.length) {
    console.log(`\n  🎯 Viewing (${config.viewing.mode}): ${viewingCandidates.length} candidate(s) ≥${config.viewing.minScore}`);

    // ⚠️ Bhejne se PEHLE lazy enrich (22 Jul, minScore 0 hone ke baad).
    //
    // Kyun: enrich sirf NAYE listings pe chalta hai. Pehle minScore 65 tha, to purani
    // listings kabhi enrich hoti hi nahi thin — zaroorat nahi thi. Ab score gate hata
    // diya (Mo: har landlord ek lead hai), to 40 aisi listings qatar me aa gayin jin
    // ke paas na address hai, na landlord ka NAAM.
    //
    // Naam ke baghair message "Hi," se shuru hota hai, "Hi Kate," ke bajaye — aur naam
    // hi wo cheez hai jo is message ko personal banati hai. Mo ki company ki taraf se
    // ja raha hai, is liye ye ahem hai.
    //
    // Sirf utni enrich karte hain jitni is run me bhejni hain (perRunCap), poori 40 nahi
    // — warna ek saath 40 requests OpenRent pe chali jatin.
    const needEnrich = viewingCandidates
      .filter((l) => !l.enriched_at || !l.landlord_name)
      .slice(0, (config.viewing.perRunCap ?? 3) + 1);
    if (needEnrich.length) {
      console.log(`  🔎 ${needEnrich.length} candidate enrich kar raha hoon (naam/address ke liye)`);
      try {
        const fresh = await enrichNew(needEnrich);
        const rescored = fresh.map(scoreListing);
        await upsert(rescored.map((l) => ({ ...l, _forceUpdate: true })));
        // in-memory bhi update karo, warna is run me purana (khali) data hi jayega
        for (const f of rescored) {
          const i = viewingCandidates.findIndex((c) => c.listing_id === f.listing_id);
          if (i !== -1) viewingCandidates[i] = { ...viewingCandidates[i], ...f };
        }
      } catch (err) {
        console.log(`  ⚠️  lazy enrich fail: ${err.message} — purane data pe hi chalta hoon`);
      }
    }

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
