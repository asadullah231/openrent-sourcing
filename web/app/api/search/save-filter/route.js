import { getSettings, saveSettings, areaKey } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * "New Search" form se ek OpenRent search save karo (Mo, 28 Jul).
 *
 * KYUN alag route (paste-link wala /api/search/save chhoda nahi):
 *   Mo ka asli flow (Social Housing Excel se): wo link paste nahi karta. Wo ek
 *   requirement pe kaam karta hai — borough + beds (2-4) + max rent (LHA+incentive
 *   se, har borough+bed ka apna). To dashboard pe wo form bharta hai, hum us se
 *   seedha OpenRent search banate hain. Koi URL parse nahi.
 *
 *   SIRF OpenRent (Mo ne kaha is baar Rightmove/Zoopla nahi) — is liye yahan koi
 *   fanOut/auto-cross NAHI. Ek form = ek OpenRent search.
 *
 * POST body: { location, bedsMin, bedsMax, priceMin, priceMax }
 *   - location  : "Bexley", "Bromley", postcode — required
 *   - bedsMin/Max: number (default 2-4)
 *   - priceMin  : optional (rent is se neeche skip)
 *   - priceMax  : max rent (LHA+incentive) — is se upar wale skip
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request not valid.' }, { status: 400 });
  }

  const location = String(body?.location || '').trim();
  if (!location) {
    return Response.json({ error: 'Enter a location (borough or postcode).' }, { status: 400 });
  }

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== '' && v != null ? n : null;
  };
  const bedsMin = num(body?.bedsMin);
  const bedsMax = num(body?.bedsMax);
  const priceMin = num(body?.priceMin);
  const priceMax = num(body?.priceMax);
  const radius = num(body?.radius); // km — OpenRent 'area' param (0 = this area only)

  if (bedsMin != null && bedsMax != null && bedsMin > bedsMax) {
    return Response.json({ error: 'Min beds cannot be more than max beds.' }, { status: 400 });
  }
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return Response.json({ error: 'Min rent cannot be more than max rent.' }, { status: 400 });
  }

  // Location naam → OpenRent slug (bilkul portals.js jaisa: lowercase, spaces→'-').
  const slug = location.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    return Response.json({ error: 'That location did not resolve. Try a borough name or postcode.' }, { status: 400 });
  }

  // OpenRent search object. `filters` hi asli hard-gate hai (bot URL param pe bharosa
  // nahi karta — 22 Jul test: OpenRent server-side filter nahi karta). params sirf
  // scrape URL banane ko.
  const filters = {};
  if (bedsMin != null) filters.bedsMin = bedsMin;
  if (bedsMax != null) filters.bedsMax = bedsMax;
  if (priceMin != null) filters.priceMin = priceMin;
  if (priceMax != null) filters.priceMax = priceMax;

  const params = { term: location, isLive: 'true' };
  if (bedsMin != null) params.bedrooms_min = String(bedsMin);
  if (bedsMax != null) params.bedrooms_max = String(bedsMax);
  if (priceMin != null) params.prices_min = String(priceMin);
  if (priceMax != null) params.prices_max = String(priceMax);
  // Radius: OpenRent ka 'area' param = kitne km/miles door tak dhoonde (km unit
  // OpenRent ka default). 0 ya null = sirf yehi area (param na daalo).
  if (radius != null && radius > 0) params.area = String(radius);

  // Folder ka SAAF naam (Mo, 29 Jul): beds + location, jaise "2-4 Bed, Bexley"
  // ya "1 Bed, Bexley". Pehle sirf location aata tha; ab beds bhi taake folder
  // se hi saaf pata chale kya search hai.
  let bedLabel = '';
  if (bedsMin != null && bedsMax != null) bedLabel = bedsMin === bedsMax ? `${bedsMin} Bed` : `${bedsMin}-${bedsMax} Bed`;
  else if (bedsMin != null) bedLabel = `${bedsMin}+ Bed`;
  else if (bedsMax != null) bedLabel = `Up to ${bedsMax} Bed`;
  // Location ka pehla saaf hissa ("Bexley, Greater London" → "Bexley").
  const shortLoc = location.split(',')[0].trim();
  const name = bedLabel ? `${bedLabel}, ${shortLoc}` : shortLoc;

  const search = {
    source: 'openrent',
    slug,
    name,
    displayLocation: shortLoc, // area-match ke liye asli location (bot listings ka area is se match)
    params,
    filters,
    enabled: true,
    fromForm: true, // dashboard form se bani (paste-link se farq karne ko)
  };

  const settings = (await getSettings()) || {};
  const areas = Array.isArray(settings.areas) ? [...settings.areas] : [];
  const existingKeys = new Set(areas.map(areaKey));
  const k = areaKey(search);

  if (existingKeys.has(k)) {
    // Pehle se bilkul yehi search hai (same location+params). Error nahi.
    return Response.json({ ok: true, already: true, name: location, count: areas.length });
  }

  areas.push(search);
  const saved = await saveSettings({ ...settings, areas });

  return Response.json({
    ok: true,
    name: location,
    count: (saved.areas || []).length,
    filters,
  });
}
