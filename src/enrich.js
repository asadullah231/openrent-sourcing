// Listing detail enrichment — title, address, landlord response rate.
// Search arrays me ye nahi hote; listing page se aate hain (server-rendered, koi protection nahi).
// M2 me scoring isi response_rate ko use karega. Sirf naye listings pe chalao (rate-limit dost).

import { config } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extract(html, re, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : null;
}

export async function enrichListing(listing) {
  const res = await fetch(listing.url, {
    headers: {
      'User-Agent': config.userAgent,
      'Accept-Language': 'en-GB,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) return { ...listing, enrich_error: res.status };
  const html = await res.text();

  // Title me address chhupa hai: "London - 2 Bed Flat, Bresslaw Court, E3 - To Rent Now for £3,500.00 p/m"
  const rawTitle = extract(html, /<title>(.*?)<\/title>/s);
  const title = rawTitle ? rawTitle.replace(/\s+/g, ' ').replace(/ \| OpenRent.*$/, '').trim() : null;

  // Response Rate: <dt>Response Rate:</dt> <dd> 100% ...
  const rrText = extract(html, /Response Rate:.*?<dd[^>]*>\s*([\d]+)%/s);
  const responseRate = rrText ? Number(rrText) : null;

  // Detail table: <td class="fw-medium">LABEL</td> <td>VALUE</td>
  // (Scrapy repo se seekha: deposit, furnishing, tenancy quality signals hain)
  const tableField = (label) =>
    extract(html, new RegExp(`<td[^>]*>${label}</td>\\s*<td[^>]*>([^<]+)</td>`, 'i'));
  const depositRaw = tableField('Deposit');
  // £ HTML entity ke roop me aata hai (&#xA3;) — usko bhi saaf karo
  const deposit = depositRaw ? Number(depositRaw.replace(/&#x[0-9a-f]+;|[£,\s]/gi, '')) || null : null;
  const furnishing = tableField('Furnishing'); // Furnished / Unfurnished
  const availableRaw = extract(html, /Available From<\/td>\s*<td[^>]*>([^<]+)</i) || tableField('Available');

  // EPC rating: sirf tab hi jab asli A-G grade table me ho. OpenRent aksar sirf EPC "link"
  // deta hai (grade nahi) — us case me null (jhoota grade nahi banate).
  const epc = tableField('EPC Rating') || tableField('EPC') || null;

  // Postcode area title se (aakhri "- To Rent" se pehle wala segment)
  const address = title ? title.replace(/ - To Rent.*$/i, '').replace(/^London - /, '').trim() : null;

  return {
    ...listing,
    title,
    address,
    response_rate: responseRate,
    deposit,
    furnishing,
    available: availableRaw ? availableRaw.trim() : null,
    epc,
    enriched_at: new Date().toISOString(),
  };
}

// Naye listings ka array enrich karo, human delay ke sath.
export async function enrichNew(listings) {
  const out = [];
  for (const l of listings) {
    out.push(await enrichListing(l));
    const [min, max] = config.cadence.perRequestDelayMs;
    await sleep(Math.floor(min + Math.random() * (max - min)));
  }
  return out;
}
