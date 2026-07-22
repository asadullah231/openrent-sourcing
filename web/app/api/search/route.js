import { parseSearchUrl, filtersFromParams } from '@bot/search-url.js';
import { scrapeArea } from '@bot/scraper.js';
import { getListings } from '@/lib/data';

export const dynamic = 'force-dynamic';
// Scrape me ~7-10 sec lagte hain. Vercel ka default 10s hai — us se pehle
// hi kat jata, aur Mo ko sirf "failed" dikhta. 30s me aaram se ho jata hai.
export const maxDuration = 30;

/**
 * Mo ka paste kiya link FORAN chala kar dikhao — kuch save kiye baghair.
 *
 * KYUN (22 Jul, Asad): Mo ko link aazmane ka tareeqa chahiye. Pehle wo link
 * Settings me add karta, phir 30 min cron ka intezaar karta, tab pata chalta
 * ke search theek thi ya nahi. Ab: paste → 7 sec → result saamne.
 *
 * ⚠️ Ye route JAAN BOOJH KAR kuch save nahi karta:
 *   - listings NocoDB me nahi jatin (warna aazmai hui search ka kachra store
 *     me bhar jata, aur bot un pe messages bhejne lagta)
 *   - search settings me add nahi hoti (wo alag "Save" ka kaam hai)
 * Sirf parhta hai. Yani Mo be-khauf jitne chahe link aazma sakta hai.
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request theek nahi.' }, { status: 400 });
  }

  const parsed = parseSearchUrl(body?.url);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  let listings;
  try {
    listings = await scrapeArea(parsed.search);
  } catch (err) {
    // OpenRent ka 429/405 ya page shape badalna — asli wajah dikhao, warna
    // Mo samjhega ke us ka link kharab hai jabke masla hamari taraf hai.
    return Response.json(
      { error: `OpenRent se result nahi mila: ${err.message}` },
      { status: 502 }
    );
  }

  // Link ke apne bed/price filter lagao.
  // ⚠️ Ye zaroori hai: OpenRent ke URL params results filter NAHI karte (unka
  // filter browser me JS se chalta hai). 22 Jul ko live test kiya — Mo ke link
  // se 713 aayin jin me 267 range se bahar thin. Bina is ke Mo ko yahan bhi
  // wahi 1-bed/15-bed ka kachra dikhta.
  const f = filtersFromParams(parsed.search.params);
  const matched = listings.filter((l) => {
    if (f.bedsMin != null && (l.beds == null || l.beds < f.bedsMin)) return false;
    if (f.bedsMax != null && (l.beds == null || l.beds > f.bedsMax)) return false;
    if (f.priceMax != null && (l.price == null || l.price > f.priceMax)) return false;
    if (f.priceMin != null && (l.price == null || l.price < f.priceMin)) return false;
    return true;
  });

  // "Nayi" = jo store me pehle se nahi. Mo ke liye sab se kaam ki ginti —
  // batati hai ke is search se asal me kitna FAIDA hoga.
  //
  // Ek dafa retry karo: NocoDB kabhi kabhi 10s pe timeout kar deta hai (22 Jul
  // ko dekha). Ek waqti thakan pe "nayi" ki ginti gawa dena bekaar hai.
  // Phir bhi na chale to `null` — jo "pata nahi chala" hai, "sab purani" NAHI.
  // UI dono ko alag dikhata hai, warna Mo ko chup ghalti milti hai.
  let known = null;
  for (let i = 0; i < 2; i++) {
    try {
      known = new Set((await getListings()).map((l) => String(l.listing_id)));
      break;
    } catch {
      if (i === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }

  const withFlag = matched.map((l) => ({
    ...l,
    _isNew: known ? !known.has(String(l.listing_id)) : null,
  }));

  // Naye upar, phir naya listing pehle (hours_live kam = naya)
  withFlag.sort((a, b) => {
    if (a._isNew !== b._isNew) return a._isNew ? -1 : 1;
    return (a.hours_live ?? 9e9) - (b.hours_live ?? 9e9);
  });

  return Response.json({
    search: parsed.search,
    total: listings.length, // OpenRent ne jitni deen
    matched: matched.length, // filter ke baad
    fresh: known ? withFlag.filter((l) => l._isNew).length : null,
    // Poori list na bhejo — 400 listings ka JSON bara hota hai aur Mo waise
    // bhi utni nahi dekhta. Pehli 60 kaafi hain andaza lagane ko.
    //
    // Sirf wo fields jo search page SE MILTE hain. Photo/address yahan hote hi
    // nahi (enrich.js baad me har listing ka apna page khol kar laata hai), is
    // liye unhe bhejna sirf khali dabbe dikhata hai.
    listings: withFlag.slice(0, 60).map((l) => ({
      listing_id: l.listing_id,
      url: l.url,
      price: l.price,
      beds: l.beds,
      baths: l.baths,
      hours_live: l.hours_live,
      _isNew: l._isNew,
    })),
  });
}
