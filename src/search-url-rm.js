// Mo ke paste kiye hue RIGHTMOVE search link ko samajhna.
//
// KYUN (23 Jul): Mo ne kaha "include Rightmove". OpenRent jaisa hi asool —
// Mo Rightmove pe khud search banata hai (area, beds, price), address bar ka
// poora link paste karta hai, hum usi ke params chalate hain. OpenRent ki tarah
// hum params ki list maintain nahi karte; jo Mo ne diya wahi chalega.
//
// Rightmove ka link aisa hota hai:
//   https://www.rightmove.co.uk/property-to-rent/find.html
//     ?searchType=RENT&locationIdentifier=REGION%5E87490
//     &minBedrooms=2&maxBedrooms=4&maxPrice=2000&minPrice=1000
//
// locationIdentifier me area ka code hota hai (REGION^87490 / OUTCODE^... /
// POSTCODE^...). Ye Rightmove ka andaruni code hai — hum ise chhoote nahi, jaise
// ka waise bhej dete hain.

const HOST_RE = /(^|\.)rightmove\.co\.uk$/i;

/**
 * Rightmove search link parho.
 * Wapas: { ok:true, search:{...} }  ya  { ok:false, error:'Urdu me wajah' }
 * OpenRent parser jaisa hi shape, taake web routes dono ko ek jaisa treat karein.
 */
export function parseRightmoveUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Link khali hai.' };

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'Ye link theek nahi lag raha.' };
  }

  if (!HOST_RE.test(u.hostname)) {
    return { ok: false, error: 'Sirf rightmove.co.uk ka link chalega.' };
  }
  if (!/\/property-to-rent\/find\.html/i.test(u.pathname)) {
    return {
      ok: false,
      error: 'Ye search page ka link nahi. Rightmove pe search karo, phir address bar wala link paste karo.',
    };
  }

  // Params jaise ke waise — locationIdentifier, minBedrooms, maxPrice sab Mo ke.
  const params = {};
  for (const [k, v] of u.searchParams.entries()) params[k] = v;

  const locId = params.locationIdentifier || '';
  if (!locId) {
    return { ok: false, error: 'Link me location code (locationIdentifier) nahi mila.' };
  }

  // Dikhane ka naam: Rightmove URL me location ka naam nahi hota (sirf code),
  // isliye code se ek saaf naam banate hain — "REGION^87490" → "London (REGION 87490)".
  // Mo baad me dashboard pe rename kar sakta hai; ye sirf label hai.
  const name = rightmoveAreaName(locId, params);

  return {
    ok: true,
    search: {
      source: 'rightmove',
      slug: locId, // rightmove ke liye "slug" = locationIdentifier
      params,
      name,
      url: buildRightmoveUrl(params),
    },
  };
}

// locationIdentifier + params se ek insaani label.
function rightmoveAreaName(locId, params) {
  // REGION^87490 → "REGION 87490". Behtar naam Mo rename se de dega.
  const clean = decodeURIComponent(locId).replace(/\^/g, ' ');
  const beds =
    params.minBedrooms && params.maxBedrooms
      ? ` · ${params.minBedrooms}-${params.maxBedrooms} bed`
      : params.minBedrooms
        ? ` · ${params.minBedrooms}+ bed`
        : '';
  return `Rightmove ${clean}${beds}`.trim();
}

/** params se poora Rightmove search URL. */
export function buildRightmoveUrl(params) {
  const qs = new URLSearchParams(params).toString();
  return `https://www.rightmove.co.uk/property-to-rent/find.html${qs ? `?${qs}` : ''}`;
}

/**
 * Link ke bed/price filter ko hamare apne filter shape me badlo.
 *
 * ⚠️ OpenRent wali ehtiyaat yahan bhi: Rightmove ke min/max params server-side
 * kaafi ache filter karte hain (OpenRent se behtar), lekin hum PHIR BHI apni
 * taraf se filter lagate hain — ek hi jagah sach rakhne ke liye, aur edge-cases
 * (jaise "price on application") ke liye jahan amount null hota hai.
 */
export function filtersFromRightmoveParams(params = {}) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    bedsMin: num(params.minBedrooms),
    bedsMax: num(params.maxBedrooms),
    priceMax: num(params.maxPrice),
    priceMin: num(params.minPrice),
  };
}
