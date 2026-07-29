// One-off scrape-only (Mo, 29 Jul): scrape + score + save, NO viewing/messages.
// Working-hours bypass — folder abhi bharne ke liye. Koi asli message nahi jata.
import 'dotenv/config';
import { hydrateConfig, config } from './config.js';
import { scrapeAll } from './scraper.js';
import { enrichNew } from './enrich.js';
import { scoreListing } from './score.js';
import { upsert } from './store.js';

await hydrateConfig();
console.log(`scrape-only — areas: ${config.areas.map(a => a.name).join(', ')}`);
let listings = await scrapeAll();
console.log(`scraped (after filters): ${listings.length}`);
const fresh = listings.filter(l => l.hours_live != null && l.hours_live <= config.freshWithinHours);
const { added, total } = await upsert(fresh);
console.log(`fresh: ${fresh.length} | NEW saved: ${added.length} | store total: ${total}`);
if (added.length) {
  const enriched = await enrichNew(added);
  const scored = enriched.map(scoreListing);
  await upsert(scored.map(l => ({ ...l, _forceUpdate: true })));
  console.log(`enriched + scored: ${scored.length}`);
}
console.log('DONE — no messages sent (scrape-only).');
