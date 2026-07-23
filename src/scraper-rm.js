// Rightmove search scraper — plain HTTP, no browser, no login.
//
// M0 recon (23 Jul, live probe): Rightmove ek Next.js app hai. Search page ke
// HTML me `<script id="__NEXT_DATA__">` ke andar POORA JSON hota hai —
// props.pageProps.searchResults.properties me har listing ka
// id, bedrooms, price, address, photo, agent phone, "new/reduced" date.
// Ek GET = 25 listings; index=24,48... se aage ke page.
//
// OpenRent scraper (scraper.js) jaisa hi shape/behaviour rakha hai, taake web
// route dono ko ek jaise treat kare aur listings same schema me store hon
// (bas `source: 'rightmove'`).

import { config } from './config.js';
import { buildRightmoveUrl, filtersFromRightmoveParams } from './search-url-rm.js';
import { fetchWithRetry } from './scraper.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randDelay([min, max]) {
  return Math.floor(min + Math.random() * (max - min));
}

// Rightmove listing card image ko full-res-ish bana lo (thumb → bara).
function bestImage(p) {
  const img =
    p.propertyImages?.mainImageSrc ||
    p.propertyImages?.images?.[0]?.srcUrl ||
    p.images?.[0]?.srcUrl ||
    null;
  return img || null;
}

// firstVisibleDate / listingUpdate se "kitne ghante purani" nikaalo — OpenRent
// ke hours_live jaisa. Rightmove "new" ya "reduced" ka signal listingUpdate me
// deta hai; hum listing ke asli visible hone ka waqt istemaal karte hain.
function hoursLiveFrom(p) {
  const iso =
    p.listingUpdate?.listingUpdateReason === 'new'
      ? p.listingUpdate?.listingUpdateDate
      : p.firstVisibleDate || p.listingUpdate?.listingUpdateDate;
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 3.6e6));
}

// __NEXT_DATA__ ka JSON nikaalo aur properties + resultCount wapas do.
function parseNextData(html) {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const sr = data?.props?.pageProps?.searchResults;
  if (!sr || !Array.isArray(sr.properties)) return null;
  return { properties: sr.properties, resultCount: sr.resultCount };
}

// Ek Rightmove property object → hamara standard listing shape.
function toListing(p, areaName, now) {
  return {
    listing_id: `rm-${p.id}`, // OpenRent id se kabhi na takraye
    source: 'rightmove',
    url: p.propertyUrl ? `https://www.rightmove.co.uk${p.propertyUrl}` : null,
    price: p.price?.amount != null ? Number(p.price.amount) : null,
    beds: p.bedrooms != null ? Number(p.bedrooms) : null,
    baths: p.bathrooms != null ? Number(p.bathrooms) : null,
    hours_live: hoursLiveFrom(p),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    bills_included: false, // Rightmove card pe reliably nahi milta
    furnished: null,
    available_from_days: null,
    min_tenancy_months: null,
    area: areaName,
    scraped_at: now,
    // Rightmove card pe pehle se photo + address + agent hote hain — enrich ki
    // zaroorat nahi (OpenRent ke bar-aks). Isliye seedhe bhar dete hain.
    title: p.propertySubType || null,
    address: p.displayAddress || null,
    image: bestImage(p),
    agent_name: p.customer?.branchDisplayName || null,
    agent_phone: p.customer?.contactTelephone || null,
    response_rate: null,
    viewing_status: 'new',
  };
}

/**
 * Ek Rightmove search scrape karo → listing objects (poora area, fresh filter caller pe).
 *
 * `area` = { source:'rightmove', slug:locationIdentifier, params, name }.
 * OpenRent ke scrapeArea jaisa hi signature/return, taake web route ek hi tarah bulaaye.
 *
 * Kitne page: pehle `maxPages` (default 3 = ~72 listings). Poore 13k kabhi nahi —
 * (a) Mo ko taaza upar wali chahiye, (b) 500 requests = block/ban ka nyota.
 */
export async function scrapeRightmove(area, { maxPages = 3 } = {}) {
  const now = new Date().toISOString();
  const params = { ...area.params };
  const all = [];
  let resultCount = null;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) params.index = String(page * 24);
    else delete params.index;

    const url = buildRightmoveUrl(params);
    const res = await fetchWithRetry(url, {
      headers: {
        'User-Agent': config.userAgent,
        'Accept-Language': 'en-GB,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (res.status === 429) {
      throw new Error(`RATE LIMITED (429) for ${area.name} — cadence slow karo / ruko`);
    }
    if (!res.ok) {
      // Pehla page fail = asli masla. Baad ke page fail ho to jo mila woh de do.
      if (page === 0) throw new Error(`Rightmove search ${res.status} for ${area.name}`);
      break;
    }

    const html = await res.text();
    const parsed = parseNextData(html);
    if (!parsed) {
      if (page === 0) {
        throw new Error(`No __NEXT_DATA__ parsed for ${area.name} — page shape badla ya block?`);
      }
      break;
    }

    // resultCount kabhi "4,132" (string, commas) hota hai — number bana lo.
    if (resultCount == null && parsed.resultCount != null) {
      const n = Number(String(parsed.resultCount).replace(/,/g, ''));
      resultCount = Number.isFinite(n) ? n : null;
    }
    all.push(...parsed.properties.map((p) => toListing(p, area.name, now)));

    // Aage koi page hi nahi bacha? ruk jao.
    if (parsed.properties.length < 24) break;

    if (page < maxPages - 1) await sleep(randDelay(config.cadence.perRequestDelayMs));
  }

  all._resultCount = resultCount; // total (dashboard "OpenRent returned N" jaisa dikhane ko)
  return all;
}

/** Apna hard filter — Rightmove ke params pe bharosa na kar ke, ek hi jagah sach. */
export function matchesRightmoveFilters(l, f) {
  if (f.bedsMin != null && (l.beds == null || l.beds < f.bedsMin)) return false;
  if (f.bedsMax != null && (l.beds == null || l.beds > f.bedsMax)) return false;
  if (f.priceMax != null && (l.price == null || l.price > f.priceMax)) return false;
  if (f.priceMin != null && (l.price == null || l.price < f.priceMin)) return false;
  return true;
}

export { filtersFromRightmoveParams };
