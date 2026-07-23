// Portal dispatcher — ek paste kiye link ko dekh kar tay karo ke OpenRent hai
// ya Rightmove, phir usi ka parser/scraper chalao.
//
// KYUN (23 Jul, Mo: "include Rightmove"): dashboard ka ek hi search bar dono
// portal ke link qubool kare. Web routes yahan se guzarti hain — unhe farq
// nahi parta ke andar kaun sa site hai. Naya portal (Zoopla) add karna =
// sirf yahan ek entry.

import { parseSearchUrl, filtersFromParams, buildUrl } from './search-url.js';
import { scrapeArea } from './scraper.js';
import {
  parseRightmoveUrl,
  filtersFromRightmoveParams,
  buildRightmoveUrl,
} from './search-url-rm.js';
import { scrapeRightmove, matchesRightmoveFilters } from './scraper-rm.js';
import { rightmoveLocationId } from './rm-location.js';

// Link se portal pehchano (host se).
export function detectPortal(url) {
  const raw = String(url || '').toLowerCase();
  if (/rightmove\.co\.uk/.test(raw)) return 'rightmove';
  if (/openrent\.co\.uk/.test(raw)) return 'openrent';
  return null;
}

/**
 * Paste kiya link parho (kaun sa bhi portal). OpenRent parser jaisa hi shape:
 *   { ok:true, search:{ source, slug, params, name, url } }  ya  { ok:false, error }
 * search.source hamesha set hota hai ('openrent' | 'rightmove').
 */
export function parseAnyUrl(url) {
  const portal = detectPortal(url);
  if (portal === 'rightmove') return parseRightmoveUrl(url);
  if (portal === 'openrent') {
    const r = parseSearchUrl(url);
    // OpenRent parser purana hai — source field add kar do (dedup/badge ke liye)
    if (r.ok && !r.search.source) r.search.source = 'openrent';
    return r;
  }
  return { ok: false, error: 'Sirf OpenRent ya Rightmove ka link chalega.' };
}

// ── Auto-cross (Mo, 23 Jul): ek link paste → bot khud doosre portal pe wohi
// search bana kar result laaye. Yahan ek parsed search se doosre portal ki
// "equivalent" search banti hai — area ka naam + beds/price le kar.

/** Kisi bhi parsed search se ek portable shape: { name, bedsMin, bedsMax, priceMax, priceMin }. */
function normalize(search) {
  const f = filtersForSearch(search);
  // Area naam. OpenRent me params.term ya name se saaf naam milta hai.
  // 🐛 FIX (23 Jul): Rightmove-origin ka auto-name "Rightmove REGION 391 · 2-4 bed"
  // hota hai — ye asli area naam NAHI. Use OpenRent ke term me daalne se bekaar
  // search banti thi. Agar Rightmove-origin ho aur saaf naam na ho to name:''
  // return karo — fanOut phir us portal ko skip kar dega (cross nahi hoga).
  if (search.source === 'rightmove') {
    const raw = String(search.name || '');
    // Rightmove auto-name me "Rightmove REGION ..." aata hai — us se cross na karo.
    if (/^rightmove\s+(region|outcode|postcode|station|street)/i.test(raw)) {
      return { name: '', ...f };
    }
    // Mo ne rename kar diya ho (saaf naam) to wahi lo.
    return { name: raw.split(',')[0].trim(), ...f };
  }
  const name = (search.params?.term || search.name || '').split(',')[0].trim();
  return { name, ...f };
}

/** OpenRent-shakl ki search banao (naam + filters se). */
function buildOpenRentSearch(n) {
  const slug = n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const params = { term: n.name, isLive: 'true' };
  if (n.bedsMin != null) params.bedrooms_min = String(n.bedsMin);
  if (n.bedsMax != null) params.bedrooms_max = String(n.bedsMax);
  if (n.priceMax != null) params.prices_max = String(n.priceMax);
  if (n.priceMin != null) params.prices_min = String(n.priceMin);
  return {
    source: 'openrent',
    slug,
    params,
    name: n.name,
    url: buildUrl(slug, params),
    _crossed: true, // bot ne khud banayi (paste nahi hui)
  };
}

/** Rightmove-shakl ki search banao (naam → locationIdentifier lookup + filters). */
async function buildRightmoveSearch(n) {
  const locId = await rightmoveLocationId(n.name);
  if (!locId) return null; // naam Rightmove pe nahi mila — is portal ko chhoro
  const params = { searchType: 'RENT', locationIdentifier: locId };
  if (n.bedsMin != null) params.minBedrooms = String(n.bedsMin);
  if (n.bedsMax != null) params.maxBedrooms = String(n.bedsMax);
  if (n.priceMax != null) params.maxPrice = String(n.priceMax);
  if (n.priceMin != null) params.minPrice = String(n.priceMin);
  return {
    source: 'rightmove',
    slug: locId,
    params,
    name: n.name, // saaf naam (Rightmove ka "REGION 391" wala nahi)
    url: buildRightmoveUrl(params),
    _crossed: true,
  };
}

/**
 * Ek parsed search (paste hui) → is ke ilawa BAQI portals ki equivalent searches.
 * Wapas: [{source, ...}] (jo ban sakein). Jo portal pe area na mile, wo chhoot jata.
 *
 * Abhi OpenRent + Rightmove (Zoopla plain-fetch pe block hai — Phase C).
 */
export async function fanOut(pasteSearch) {
  const n = normalize(pasteSearch);
  if (!n.name) return []; // naam hi nahi (Rightmove-origin bina term) — cross nahi kar sakte
  const out = [];

  if (pasteSearch.source !== 'openrent') {
    out.push(buildOpenRentSearch(n));
  }
  if (pasteSearch.source !== 'rightmove') {
    const rm = await buildRightmoveSearch(n);
    if (rm) out.push(rm);
  }
  return out;
}

/** search object (jisme source hai) → apne filter shape { bedsMin, bedsMax, priceMax, priceMin }. */
export function filtersForSearch(search) {
  if (search.source === 'rightmove') return filtersFromRightmoveParams(search.params);
  return filtersFromParams(search.params);
}

/** Ek listing filter pe poori utri? (dono portal ka same shape) */
export function matchesFilters(listing, f) {
  // Rightmove aur OpenRent ka matcher aik jaisa hai (beds/price range).
  return matchesRightmoveFilters(listing, f);
}

/**
 * Search scrape karo — portal ke hisaab se sahi scraper.
 * Return: listings array (same schema, `source` field set).
 */
export async function scrapeSearch(search) {
  if (search.source === 'rightmove') return scrapeRightmove(search);
  // OpenRent listings pe source add kar do (store/badge ke liye)
  const list = await scrapeArea(search);
  for (const l of list) if (!l.source) l.source = 'openrent';
  return list;
}
