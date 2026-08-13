// Order → OpenRent search — PRD Phase 1 ka "Find Properties" dil.
//
// PRD section 4: "user should not have to re-enter the same requirements
// manually" — order ke fields se search parameters KHUD bante hain.
//
// Ye bilkul wahi tareeqa hai jo dashboard ke "New Search" form ka hai
// (web/app/api/search/save-filter/route.js) — wahi slug, wahi params, wahi
// filters shape. Naya format IJAAD nahi kiya, warna scraper ke sath mismatch
// ka khatra hota. Search object seedha portals.js ke scrapeSearch() me jata hai.

import { buildUrl } from './search-url.js';

/**
 * Order row → OpenRent search object (portals.js ke scrapeSearch ke liye).
 * Return: { ok:true, search } ya { ok:false, error } (area missing waghera).
 */
export function orderToSearch(order) {
  const location = String(order?.area || '').trim();
  if (!location) return { ok: false, error: 'Order has no area. Add one before searching.' };

  const slug = location.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) return { ok: false, error: 'Order area did not resolve to a searchable location.' };

  const bedsMin = num(order.bedrooms);
  const bedsMax = num(order.bedrooms_max);
  const priceMin = num(order.min_rent);
  const priceMax = num(order.max_rent);

  // filters = asli hard gate (bot URL params pe bharosa nahi karta — 22 Jul
  // ka test: OpenRent server-side filter NAHI karta). params sirf URL ke liye.
  const filters = {};
  if (bedsMin != null) filters.bedsMin = bedsMin;
  if (bedsMax != null) filters.bedsMax = bedsMax;
  if (priceMin != null) filters.priceMin = priceMin;
  // ⚠️ priceMax filters me JAAN BOOJH KAR NAHI — over-budget lane ke liye
  // scrape me sab aane do; budget ka hard/lane faisla order-match.js karta hai
  // (warna "Show over-budget" mode ke liye kuch bachta hi nahi).

  const params = { term: location, isLive: 'true' };
  if (bedsMin != null) params.bedrooms_min = String(bedsMin);
  if (bedsMax != null) params.bedrooms_max = String(bedsMax);
  if (priceMin != null) params.prices_min = String(priceMin);
  // priceMax URL me bhi nahi — upar wali wajah (waise bhi server ignore karta hai).

  const shortLoc = location.split(',')[0].trim();
  return {
    ok: true,
    search: {
      source: 'openrent',
      slug,
      // ⚠️ name SAAF location hi rahe — scrapeArea listings ka `area` isi se
      // bharta hai, aur wo cards pe address ke fallback me dikhta hai. Order
      // ka hawala yahan daala to har card pe "Order ORD-0001 — ..." chhap jata.
      name: shortLoc,
      displayLocation: shortLoc,
      params,
      filters,
      url: buildUrl(slug, params),
      _fromOrder: true, // settings.areas me kabhi save nahi hota — sirf on-demand
    },
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : null;
}
