// Portal dispatcher — ek paste kiye link ko dekh kar tay karo ke OpenRent hai
// ya Rightmove, phir usi ka parser/scraper chalao.
//
// KYUN (23 Jul, Mo: "include Rightmove"): dashboard ka ek hi search bar dono
// portal ke link qubool kare. Web routes yahan se guzarti hain — unhe farq
// nahi parta ke andar kaun sa site hai. Naya portal (Zoopla) add karna =
// sirf yahan ek entry.

import { parseSearchUrl, filtersFromParams } from './search-url.js';
import { scrapeArea } from './scraper.js';
import {
  parseRightmoveUrl,
  filtersFromRightmoveParams,
} from './search-url-rm.js';
import { scrapeRightmove, matchesRightmoveFilters } from './scraper-rm.js';

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
