// Mo ek OpenRent search link paste karta hai (apna banaya hua search), aur
// order ke fields wahi se nikal ate hain — dobara type karne ki zaroorat
// nahi. Parsing wahi module use karti hai jo "Find Properties" khud use
// karta hai (@bot/search-url.js) — do jagah alag parsing likhne se drift ka
// khatra hota (13 Aug: "just link paste karo, order ready ho jaye" directive).
//
// Ye sirf PARSE karta hai, order banata nahi — form ko prefill karta hai
// taake Asad council/client aur order rate (jo link me kabhi nahi hota)
// dekh kar ek click me confirm kar sake.

import { parseSearchUrl, filtersFromParams } from '@bot/search-url.js';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request not valid.' }, { status: 400 });
  }

  const url = String(body?.url || '').trim();
  if (!url) return Response.json({ error: 'Paste an OpenRent search link first.' }, { status: 400 });

  const parsed = parseSearchUrl(url);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const { params, name } = parsed.search;
  const f = filtersFromParams(params);

  // Area = link ka poora 'term' (e.g. "Bexley, Greater London") agar mila,
  // warna slug se nikla naam. order-search.js isi field ko OpenRent search
  // me wapas bhejta hai, is liye original term jitna sahi ho utna behtar.
  const area = String(params.term || name || '').trim();

  return Response.json({
    ok: true,
    order: {
      area,
      bedrooms: f.bedsMin ?? '',
      bedrooms_max: f.bedsMax ?? '',
      max_rent: f.priceMax ?? '',
      min_rent: f.priceMin ?? '',
      notes: `From pasted search link: ${parsed.search.url}`,
    },
  });
}
