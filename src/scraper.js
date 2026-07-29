// OpenRent search scraper — plain HTTP, no browser.
// M0 recon: search page HTML me parallel JS arrays hote hain jinme poore area ka data hota hai
// (ek GET = 1500+ properties). Naya listing = hoursLive < freshWithinHours.

import { config } from './config.js';
import { buildUrl, filtersFromParams } from './search-url.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randDelay([min, max]) {
  return Math.floor(min + Math.random() * (max - min));
}

// Search page ke embedded JS array ko values me parse karo:  var NAME = [a, b, c];
function parseArray(html, name) {
  const re = new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\]');
  const m = html.match(re);
  if (!m) return null;
  return m[1]
    .split(',')
    .map((x) => x.trim().replace(/^["']|["']$/g, ''))
    .filter((x) => x.length > 0);
}

// Ek "search" ka URL banao.
//
// Do shakal chalti hain (22 Jul):
//   NAYA  — Mo ka paste kiya link: { slug, params:{...} }. Params jaise ke waise.
//   PURANA — hard-coded area:      { slug, term }. Filters config se lagte hain.
//
// Purane ko is liye zinda rakha ke NocoDB me abhi bhi wahi pari hain. Jab Mo
// pehla link paste karega, wo khud naye format me badal jayengi — us se pehle
// bot ka chalna band nahi hona chahiye.
function buildSearchUrl(search, filters) {
  if (search.params) return buildUrl(search.slug, search.params);

  const params = new URLSearchParams();
  if (search.term) params.set('term', search.term);
  if (filters.bedsMin != null) params.set('beds_min', String(filters.bedsMin));
  if (filters.bedsMax != null) params.set('beds_max', String(filters.bedsMax));
  if (filters.priceMax != null) params.set('prices_max', String(filters.priceMax));
  if (filters.priceMin != null) params.set('prices_min', String(filters.priceMin));
  params.set('isLive', 'true'); // afiodorov se: sirf live listings, dead hata do
  return `${config.base}/properties-to-rent/${search.slug}?${params.toString()}`;
}

/**
 * Is search pe kaunse filter lagenge.
 *
 * Qanoon: LINK JEETEGA. Agar Mo ke link me bedrooms_min=2 hai, to wahi chalega,
 * chahe settings page pe kuch aur likha ho. Wajah: Mo ne wo search OpenRent pe
 * apni aankhon se banai hai — us ka matlab wo asal me wahi chahta hai. Do jagah
 * do number hon to Mo ko kabhi samajh nahi aayega ke kaunsa chala.
 * Jo link me nahi diya (jaise max rent), wo settings se le lo.
 */
function filtersFor(search) {
  // NAYA (Mo, 28 Jul): agar search ke apne `filters` hain (dashboard "New Search"
  // form ne set kiye — beds + max rent), to WAHI jeette. Ye Mo ki soch-samajh ke
  // saath chuni gayi requirement hai (borough ka LHA+incentive max), config default
  // nahi. Sirf jo form ne diya wo override kare, baaki config se.
  if (search.filters && typeof search.filters === 'object') {
    const out = { ...config.filters };
    for (const [k, v] of Object.entries(search.filters)) if (v != null) out[k] = v;
    return out;
  }
  if (!search.params) return config.filters;
  const fromLink = filtersFromParams(search.params);
  const out = { ...config.filters };
  for (const [k, v] of Object.entries(fromLink)) if (v != null) out[k] = v;
  return out;
}

// Transient network fail pe retry (timeout/reset). 3 tries, backoff. Hard-fail se bachata hai.
export async function fetchWithRetry(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(20000), ...opts });
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(1500 * (i + 1)); // 1.5s, 3s backoff
    }
  }
  throw lastErr;
}

// Ek search scrape karo → listing objects ka array (poora area, phir hum fresh filter karenge)
export async function scrapeArea(area) {
  const url = buildSearchUrl(area, filtersFor(area));
  const res = await fetchWithRetry(url, {
    headers: {
      'User-Agent': config.userAgent,
      'Accept-Language': 'en-GB,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  // 429 = rate limited (Scrapy repo se seekha) — ye asal warning hai, ruk jao
  if (res.status === 429) {
    throw new Error(`RATE LIMITED (429) for ${area.name} — cadence slow karo / ruko`);
  }
  if (!res.ok) {
    throw new Error(`OpenRent search ${res.status} for ${area.name}`);
  }
  const html = await res.text();

  const ids = parseArray(html, 'PROPERTYIDS');
  if (!ids || ids.length === 0) {
    // Zero ids = ya to area khaali, ya (khatarnak) OpenRent ne page badla / block kiya.
    throw new Error(`No PROPERTYIDS parsed for ${area.name} — page shape badla ya block?`);
  }

  const prices = parseArray(html, 'prices') || [];
  const bedrooms = parseArray(html, 'bedrooms') || [];
  const bathrooms = parseArray(html, 'bathrooms') || [];
  const hoursLive = parseArray(html, 'hoursLive') || [];
  const lats = parseArray(html, 'PROPERTYLISTLATITUDES') || [];
  const lngs = parseArray(html, 'PROPERTYLISTLONGITUDES') || [];
  const bills = parseArray(html, 'bills') || [];
  const furnished = parseArray(html, 'furnished') || [];
  const availableFrom = parseArray(html, 'availableFrom') || [];
  const minTenancy = parseArray(html, 'minimumTenancy') || [];

  const now = new Date().toISOString();
  return ids.map((id, i) => ({
    listing_id: id,
    url: `${config.base}/${id}`,
    price: prices[i] ? Number(prices[i]) : null,
    beds: bedrooms[i] ? Number(bedrooms[i]) : null,
    baths: bathrooms[i] ? Number(bathrooms[i]) : null,
    hours_live: hoursLive[i] ? Number(hoursLive[i]) : null,
    lat: lats[i] ? Number(lats[i]) : null,
    lng: lngs[i] ? Number(lngs[i]) : null,
    bills_included: bills[i] === '1',
    furnished: furnished[i] === '1',
    available_from_days: availableFrom[i] ? Number(availableFrom[i]) : null,
    min_tenancy_months: minTenancy[i] ? Number(minTenancy[i]) : null,
    area: area.name,
    scraped_at: now,
    // M2 enrich karega: title, address, response_rate. M2/M3: viewing_status.
    title: null,
    response_rate: null,
    viewing_status: 'new',
  }));
}

// ⚠️ M1 sabaq: OpenRent ke beds_min/beds_max URL params results FILTER NAHI karte
// (page poore area ki saari properties deta hai, filter client-side JS se hota hai).
// Isliye hum apni taraf se filter lagate hain — OpenRent ke param pe bharosa nahi.
function matchesFilters(l, f) {
  if (f.bedsMin != null && (l.beds == null || l.beds < f.bedsMin)) return false;
  if (f.bedsMax != null && (l.beds == null || l.beds > f.bedsMax)) return false;
  if (f.priceMax != null && (l.price == null || l.price > f.priceMax)) return false;
  // priceMin (Mo, 28 Jul): social-housing flow me har borough+bed ka apna max rent
  // (LHA+incentive) hota hai; kabhi min bhi. Us se neeche/upar wale skip.
  if (f.priceMin != null && (l.price == null || l.price < f.priceMin)) return false;
  return true;
}

// Sab searches scrape karo, human delay ke sath. Fresh filter caller pe.
//
// `enabled: false` wali chhor do — Mo dashboard se kisi search ko band kar sakta
// hai bina delete kiye (mausam ke hisab se area on/off karna aam baat hai).
//
// Ek search fail ho to poora run nahi girta (22 Jul). Pehle ek kharab link poore
// cron ko le doobta tha — yani Tower Hamlets ki listings sirf is liye ruk jatin
// ke Hackney ka link ghalat tha. Ab wo ek chhoot jati hai, baqi chalti rehti hain.
export async function scrapeAll() {
  // Portal dispatcher yahan lazy-import — warna scraper.js ↔ scraper-rm.js ka
  // circular import ban jata (scraper-rm.js is file se fetchWithRetry leti hai).
  const { scrapeSearch, filtersForSearch, matchesFilters: matchAny } = await import('./portals.js');

  const all = [];
  const errors = [];
  const searches = (config.areas || []).filter((a) => a.enabled !== false);

  for (const search of searches) {
    try {
      // Portal ke hisaab se sahi scraper (OpenRent ya Rightmove).
      const listings = await scrapeSearch(search);
      // Apna hard filter — portal ke URL param pe bharosa nahi.
      const f = search.source ? filtersForSearch(search) : filtersFor(search);
      const match = search.source ? matchAny : matchesFilters;
      all.push(...listings.filter((l) => match(l, f)));
    } catch (err) {
      errors.push(`${search.name || search.slug}: ${err.message}`);
      console.error(`  ⚠️  ${search.name || search.slug} fail — ${err.message}`);
    }
    await sleep(randDelay(config.cadence.perRequestDelayMs));
  }

  // Sab ki sab fail = asli masla (block, net down, page badal gaya). Ab chup
  // nahi rehna — warna "0 listings" aur "sab kuch toota hua" ek jaise lagte hain.
  if (searches.length && errors.length === searches.length) {
    throw new Error(`Saari ${searches.length} searches fail ho gayin:\n${errors.join('\n')}`);
  }
  return all;
}
