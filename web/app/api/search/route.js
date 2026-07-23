import { parseAnyUrl, scrapeSearch, filtersForSearch, matchesFilters, fanOut } from '@bot/portals.js';
import { enrichListing } from '@bot/enrich.js';
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

  const parsed = parseAnyUrl(body?.url);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const portal = parsed.search.source === 'rightmove' ? 'Rightmove' : 'OpenRent';

  // Auto-cross (Mo, 23 Jul): "ek link paste karun, bot khud baqi sites pe wohi
  // search bana kar result laaye." Paste ki hui search + baqi portals ki
  // equivalent searches — sab ek saath scrape, ek natija.
  //   - fanOut area ka naam le kar doosre portal ki search banata hai
  //     (Rightmove pe naam→locationIdentifier lookup se).
  //   - Jo portal pe area na mile / scrape fail ho, wo chhoot jata — baqi chalti.
  let crossed = [];
  try {
    crossed = await fanOut(parsed.search);
  } catch {
    crossed = [];
  }
  const allSearches = [parsed.search, ...crossed];

  // Sab searches parallel scrape. Ek fail ho to poora na gire.
  const scraped = await Promise.all(
    allSearches.map((s) =>
      scrapeSearch(s)
        .then((list) => ({ ok: true, source: s.source, list, total: list._resultCount ?? list.length }))
        .catch((err) => ({ ok: false, source: s.source, list: [], total: 0, error: err.message }))
    )
  );

  // Kuch bhi na mila (paste wali bhi fail) = asli masla, wajah dikhao.
  const anyOk = scraped.some((r) => r.ok);
  if (!anyOk) {
    const pasteRes = scraped[0];
    return Response.json(
      { error: `${portal} se result nahi mila: ${pasteRes?.error || 'unknown'}` },
      { status: 502 }
    );
  }

  // Sab portals ki listings ek me. Filter har listing pe uske apne portal ke
  // hisaab se — matcher dono ka same shape (beds/price) hai.
  const f = filtersForSearch(parsed.search);
  let listings = [];
  const bySource = {}; // source -> { total, matched }
  for (const r of scraped) {
    const m = r.list.filter((l) => matchesFilters(l, f));
    listings.push(...m);
    bySource[r.source] = {
      total: r.total,
      matched: (bySource[r.source]?.matched || 0) + m.length,
      ok: r.ok,
    };
  }
  const matched = listings;

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

  // Upar wali kuch listings ENRICH karo — taake preview me asli photo aur pata
  // aaye, bilkul neeche wale "Worth a look" cards jaisa (Asad ne kaha, 22 Jul).
  //
  // Search page me photo/address hote hi nahi; wo har listing ke apne page pe
  // hain. Pehle maine socha tha ye bohot mehnga hai — magar naap kar dekha:
  // parallel me 6 listings 1.5 sec, yani 12 taqreeban 3 sec. Qabool hai.
  //
  // 12 hi kyun, saari 60 kyun nahi: 60 ka matlab hai OpenRent pe 60 requests ek
  // dam. Ye wahi account hai jis se bot asli messages bhejta hai — us pe rate
  // limit (429) khana bohot mehnga sauda hai sirf preview ki khatir. 12 se ek
  // poori screen bhar jati hai; baqi neeche patli list me.
  const TOP = 12;
  const top = withFlag.slice(0, TOP);
  const rest = withFlag.slice(TOP, 60);

  // Rightmove ke card pe photo + address pehle se hote hain — enrich ki zaroorat
  // nahi. Sirf OpenRent listings enrich karo (unke search page pe photo hote hi
  // nahi). Ab list mili-juli hoti hai (dono portal), is liye PER-LISTING dekho.
  const enriched = await Promise.all(
    top.map((l) =>
      (l.source === 'rightmove' || l.image)
        ? Promise.resolve(l)
        : enrichListing(l)
            .then((e) => ({ ...l, ...e }))
            // Ek listing ka page na khule to poora search na gire — photo ke
            // baghair hi dikha do.
            .catch(() => l)
    )
  );

  const slim = (l) => ({
    listing_id: l.listing_id,
    source: l.source ?? parsed.search.source ?? 'openrent',
    url: l.url,
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    hours_live: l.hours_live,
    _isNew: l._isNew,
    // OpenRent pe enrich ke baad; Rightmove pe scrape me hi mil jate hain
    image: l.image ?? null,
    address: l.address ?? null,
    title: l.title ?? null,
    furnishing: l.furnishing ?? null,
    // Contact — jo mile grab karo (Mo, 23 Jul: "phone ho to us ka number bhi").
    // Rightmove pe agent name + phone milte hain; OpenRent pe enrich se landlord.
    agent_name: l.agent_name ?? l.landlord_name ?? null,
    agent_phone: l.agent_phone ?? null,
  });

  // Har portal ne jitni deen unka jama (Rightmove resultCount, OpenRent scraped).
  const total = Object.values(bySource).reduce((s, v) => s + (v.total || 0), 0);

  // Kaunse portal chale, kitni kis se — Mo ko dikhane ke liye (e.g. "OpenRent 40 · Rightmove 47").
  const sources = allSearches.map((s) => ({
    source: s.source,
    crossed: !!s._crossed, // bot ne khud banayi (paste nahi hui)
    matched: 0,
    ok: bySource[s.source]?.ok ?? false,
  }));
  // matched per source bharo
  for (const l of matched) {
    const e = sources.find((x) => x.source === (l.source || 'openrent'));
    if (e) e.matched++;
  }

  return Response.json({
    search: parsed.search,
    total, // sab portals ne jitni deen
    matched: matched.length, // filter ke baad (sab portal jama)
    sources, // per-portal breakdown (auto-cross)
    fresh: known ? withFlag.filter((l) => l._isNew).length : null,
    enrichedCount: enriched.filter((l) => l.image).length,
    // Poori list na bhejo — 400 listings ka JSON bara hai aur Mo waise bhi utni
    // nahi dekhta. Pehli 12 photo ke sath, agli 48 patli list me.
    listings: enriched.map(slim),
    more: rest.map(slim),
  });
}
