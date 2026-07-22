// Mo ke paste kiye hue OpenRent search link ko samajhna.
//
// KYUN (22 Jul): pehle areas hard-coded thay (`{name, slug, term, radiusKm}`) aur
// Mo unhe chhu bhi nahi sakta tha. Asli tareeqa-e-kaar ye hai: Mo pehle OpenRent
// pe khud search banata hai (jo area, jitna radius, jitne beds), phir chahta hai
// ke bot wahi search chalata rahe. To seedhi baat — wo POORA LINK paste kare,
// hum usi ke params use karein.
//
// Bara faida: OpenRent kal koi naya filter (EPC, garden, parking) add kar de, to
// hamein kuch nahi karna parega. Mo us filter ke sath search banayega, link paste
// karega, aur wo khud-ba-khud chal jayega. Hum params ki list maintain nahi karte.

const HOST_RE = /(^|\.)openrent\.co\.uk$/i;

/**
 * Ek paste kiya hua link parho.
 * Wapas: { ok:true, search:{...} }  ya  { ok:false, error:'Urdu me wajah' }
 *
 * Ghalat link pe throw NAHI karta — dashboard ko wajah dikhani hoti hai,
 * aur cron ko ek kharab link pe poora run nahi girana chahiye.
 */
export function parseSearchUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Link khali hai.' };

  let u;
  try {
    // Mo shayad "www.openrent.co.uk/..." paste kare bina https ke — chalne do
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: 'Ye link theek nahi lag raha.' };
  }

  if (!HOST_RE.test(u.hostname)) {
    return { ok: false, error: 'Sirf openrent.co.uk ka link chalega.' };
  }
  if (!/\/properties-to-rent\//i.test(u.pathname)) {
    return {
      ok: false,
      error: 'Ye search page ka link nahi. OpenRent pe search karo, phir address bar wala link paste karo.',
    };
  }

  const slug = u.pathname.replace(/^\/+|\/+$/g, '').split('/').pop() || '';
  if (!slug) return { ok: false, error: 'Link me area nahi mila.' };

  // Params jaise ke waise. term/area/bedrooms_min/prices_max — sab Mo ke.
  const params = {};
  for (const [k, v] of u.searchParams.entries()) params[k] = v;

  // Sirf ye ek hum khud lagate hain: mari hui listings kabhi nahi chahiye.
  // (afiodorov ke repo se seekha tha, M1 me add hua.)
  params.isLive = 'true';

  return {
    ok: true,
    search: {
      slug,
      params,
      // Mo ke term se naam banao ("Tower Hamlets, Greater London" → "Tower Hamlets"),
      // warna slug se. Ye sirf dikhane ke liye hai (dashboard + listing ka `area`).
      name: (params.term || slug.replace(/-/g, ' ')).split(',')[0].trim(),
      url: buildUrl(slug, params),
    },
  };
}

/** slug + params se poora OpenRent URL. */
export function buildUrl(slug, params) {
  const qs = new URLSearchParams(params).toString();
  return `https://www.openrent.co.uk/properties-to-rent/${slug}${qs ? `?${qs}` : ''}`;
}

/**
 * Link me jo bed/price filter Mo ne diye, unhe hamare apne filter me badlo.
 *
 * ⚠️ YE ZAROORI KYUN HAI: OpenRent ke bed params results ko FILTER NAHI KARTE.
 * 22 Jul ko live test kiya — Mo ke apne link (bedrooms_min=2&bedrooms_max=4) se
 * 713 listings aayin, jin me se 267 range se bahar thin: 202 one-bed, 39 five-bed,
 * ek 15-bed tak. OpenRent ye filter browser me JS se karta hai, server pe nahi.
 * Yani hamein khud filter karna PARTA hai, warna Mo ko 1-bed room dikhte rehte.
 *
 * Isi liye link ke numbers nikaal kar apne filter me daalte hain.
 */
export function filtersFromParams(params = {}) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // OpenRent ne waqt ke sath do naam use kiye hain — dono qubool karo
  return {
    bedsMin: num(params.bedrooms_min ?? params.beds_min),
    bedsMax: num(params.bedrooms_max ?? params.beds_max),
    priceMax: num(params.prices_max ?? params.price_max),
    priceMin: num(params.prices_min ?? params.price_min),
  };
}
