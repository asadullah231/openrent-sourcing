// OpenRent search scraper — plain HTTP, no browser.
// M0 recon: search page HTML me parallel JS arrays hote hain jinme poore area ka data hota hai
// (ek GET = 1500+ properties). Naya listing = hoursLive < freshWithinHours.

import { config } from './config.js';

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

function buildSearchUrl(area, filters) {
  const params = new URLSearchParams();
  params.set('term', area.term);
  if (filters.bedsMin != null) params.set('beds_min', String(filters.bedsMin));
  if (filters.bedsMax != null) params.set('beds_max', String(filters.bedsMax));
  if (filters.priceMax != null) params.set('prices_max', String(filters.priceMax));
  params.set('isLive', 'true'); // afiodorov se: sirf live listings, dead hata do
  return `${config.base}/properties-to-rent/${area.slug}?${params.toString()}`;
}

// Ek area scrape karo → listing objects ka array (poora area, phir hum fresh filter karenge)
export async function scrapeArea(area) {
  const url = buildSearchUrl(area, config.filters);
  const res = await fetch(url, {
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
  return true;
}

// Sab areas scrape karo, human delay ke sath. Fresh filter caller pe.
export async function scrapeAll() {
  const all = [];
  for (const area of config.areas) {
    const listings = await scrapeArea(area);
    // Apna hard filter — OpenRent ke URL param pe depend nahi.
    all.push(...listings.filter((l) => matchesFilters(l, config.filters)));
    await sleep(randDelay(config.cadence.perRequestDelayMs));
  }
  return all;
}
