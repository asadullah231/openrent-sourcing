import { scrapeSearch } from '@bot/portals.js';
import { enrichListing } from '@bot/enrich.js';
import { orderToSearch } from '@bot/order-search.js';
import { hardFilterListing } from '@bot/order-match.js';
import { scoreAgainstOrder } from '@bot/score.js';
import { computeProfitability } from '@bot/profitability.js';
import { getOrder, updateOrder, saveOrderMatches, getOrderMatches } from '@/lib/orders';
import { getListings } from '@/lib/data';
import { logActivity } from '@/lib/activities';

export const dynamic = 'force-dynamic';
// Scrape (~7s) + enrich batch (~5s) + NocoDB saves. /api/search ki tarah
// Vercel ke default 10s se zyada chahiye.
export const maxDuration = 60;

// Kitni listings enrich karein (photo/address/type/EPC listing page se aate
// hain). /api/search wala hi hisaab: ye Mo ka ASLI account hai — 60 requests
// ek dam maar ke 429 khana bohot mehnga hai. 24 = do screen bhar cards.
const ENRICH_CAP = 24;

/**
 * PRD Phase 1 ka dil — "Find Properties":
 *   Order → search params → OpenRent scrape → normalize → dedupe → hard filter
 *   → match score → profitability → rank → order_properties save → return.
 *
 * ⚠️ /api/search wala usool yahan bhi: scrape ki listings BOT KE LISTINGS
 * STORE ME NAHI jatin (warna order research se outreach store bhar jata aur
 * bot un pe messages bhejne lagta). Results order_properties me snapshot
 * ke sath jate hain — bot ka pipeline is se bilkul alag rehta hai.
 *
 * Body (optional): { showOverBudget: true } — over-budget lane response me
 * aaye. Rows to hamesha save hoti hain (over_budget flag ke sath) taake
 * toggle ke liye dobara scrape na karna pare; ye sirf response ko control
 * karta hai.
 */
export async function POST(req, { params }) {
  const { id } = await params;
  let body = {};
  try { body = await req.json(); } catch {}
  const showOverBudget = !!body.showOverBudget;

  const order = await getOrder(id);
  if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });

  // 1) Order → search parameters (koi manual re-entry nahi — PRD section 4)
  const built = orderToSearch(order);
  if (!built.ok) return Response.json({ error: built.error }, { status: 400 });

  // 2) OpenRent collection (existing scraper, bilkul untouched)
  let scraped;
  try {
    scraped = await scrapeSearch(built.search);
  } catch (e) {
    return Response.json(
      { error: `OpenRent search failed: ${e.message}` },
      { status: 502 }
    );
  }

  // 3) Normalize + dedupe by listing_id (search page kabhi kabhi ek property
  // do baar deta hai — featured + normal slot)
  const byId = new Map();
  for (const l of scraped) byId.set(String(l.listing_id), { ...l, source: l.source || 'openrent' });
  let listings = [...byId.values()];
  const totalFound = listings.length;

  // 3b) Pehle se maloom data MUFT me lo — do jagah se:
  //   (a) bot ka listings store (us ki enrich ki hui listings)
  //   (b) ISI order ke pichhle Find runs ke snapshots
  // (b) sab se aham hai: enrich coverage har run ke sath JAMA hoti hai, aur
  // pichhle run me pakre hue shared-rooms is baar title ke sath aate hain —
  // pehle hi pass me reject, enrich slot kharch kiye baghair.
  const prior = new Map();
  const rememberPrior = (id, src) => {
    if (!src) return;
    const keep = {};
    for (const k of ['title', 'address', 'epc', 'furnishing', 'image', 'response_rate', 'landlord_name']) {
      if (src[k] != null) keep[k] = src[k];
    }
    if (Object.keys(keep).length) prior.set(String(id), { ...prior.get(String(id)), ...keep });
  };
  try {
    for (const k of await getListings()) rememberPrior(k.listing_id, k);
  } catch { /* store na mile to bhi search chale */ }
  try {
    // includeRejected: pichhle runs ke pakre hue junk (shared rooms waghera)
    // ke titles bhi chahiye — unhi se ye run unhe pehle pass me reject karega.
    for (const m of await getOrderMatches(order.Id, { includeRejected: true })) {
      rememberPrior(m.listing_id, m.listing);
    }
  } catch { /* pichhla run na ho to kuch merge nahi hota */ }
  listings = listings.map((l) => {
    const p = prior.get(String(l.listing_id));
    return p ? { ...p, ...Object.fromEntries(Object.entries(l).filter(([, v]) => v != null)) } : l;
  });

  // 4) Hard filter — pehla pass (search-page data pe: price/beds/availability)
  const firstPass = listings.map((l) => ({ l, verdict: hardFilterListing(l, order) }));
  let eligible = firstPass.filter((x) => x.verdict.eligible).map((x) => x.l);
  let overBudget = firstPass.filter((x) => x.verdict.overBudget).map((x) => x.l);
  const rejectedCount = firstPass.length - eligible.length - overBudget.length;

  // 5) Enrich (capped) — BUDGET KE QAREEB wali pehle, sasti aakhir me.
  //
  // Pehli koshish me ulta kiya tha (sasti pehle, "zyada headroom = behtar
  // score") — asal data ne ghalat sabit kiya: Bromley test me sab se sasti
  // "2-4 bed" listings (£500-900) taqreeban SAB "Room in a Shared House"
  // niklein, aur poora enrich budget unhi pe ur gaya — asli candidates
  // (£900-1500, budget ke qareeb) kabhi enrich hi na hue. Whole properties
  // budget line ke qareeb cluster hoti hain; shockingly-sasti listing taqreeban
  // hamesha room/scam hai. Is liye: eligible ko price DESC, over-budget ko
  // price ASC (dono = budget line se faasla). Junk queue ke aakhir me — cap
  // ke andar aata hi nahi.
  const enrichQueue = [
    ...[...eligible].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    ...[...overBudget].sort((a, b) => (a.price ?? 9e9) - (b.price ?? 9e9)).slice(0, 8),
  ].filter((l) => !l.title && !l.address).slice(0, ENRICH_CAP);

  // 8-8 ke chunks — 24 parallel requests ek dam OpenRent pe theek nahi
  const enrichedById = new Map();
  let enrichFailed = 0; // OpenRent throttle/na-khula — chup nahi rehna (neeche summary me jata hai)
  for (let i = 0; i < enrichQueue.length; i += 8) {
    const chunk = enrichQueue.slice(i, i + 8);
    const done = await Promise.all(
      chunk.map((l) =>
        enrichListing(l)
          .then((e) => {
            if (e.enrich_error || !e.title) enrichFailed++;
            return { ...l, ...e };
          })
          .catch(() => {
            enrichFailed++;
            return l; // ek listing ka page na khule to baqi na girein
          })
      )
    );
    for (const l of done) enrichedById.set(String(l.listing_id), l);
  }
  const withEnrich = (arr) => arr.map((l) => enrichedById.get(String(l.listing_id)) || l);
  eligible = withEnrich(eligible);
  overBudget = withEnrich(overBudget);

  // 6) Hard filter — doosra pass. Enrich ke baad type/postcode/shared-room
  // maloom hue — koi CONFIRMED violation nikli to ab bahar karo.
  const second = eligible.map((l) => ({ l, verdict: hardFilterListing(l, order) }));
  const enrichRejected = second.filter((x) => !x.verdict.eligible && !x.verdict.overBudget);
  eligible = second.filter((x) => x.verdict.eligible).map((x) => x.l);

  // 6b) Jis reject pe TITLE maloom hai (enrich ya store se — yani asli
  // OpenRent request kharch hui thi ya ho chuki thi), use `rejected` row ke
  // tor pe SAVE karo. Agli run prior-merge se ye title utha kar pehle pass
  // me hi reject kar degi — wahi enrich slot dobara kharch nahi hoga, aur
  // junk wapas eligible me nahi ghusega (ye asli bug tha: run 3 ne 22 shared
  // rooms pakre, run 4 ne unhe bhula kar wapas eligible dikha diya).
  // Listing OpenRent se hat jaye to stale-cleanup row khud hata deta hai.
  const rejectedRows = [
    ...enrichRejected.map((x) => ({ l: x.l, rejections: x.verdict.rejections })),
    ...firstPass
      .filter((x) => !x.verdict.eligible && !x.verdict.overBudget && (x.l.title || x.l.address))
      .map((x) => ({ l: x.l, rejections: x.verdict.rejections })),
  ].map(({ l, rejections }) => ({
    listing_id: l.listing_id,
    listing: slim(l),
    match_score: null,
    breakdown: null,
    reasons: [],
    rejections,
    over_budget: false,
    rejected: true,
    profit: null,
  }));

  // 7) Match score (sirf eligible — PRD: over-budget ko normal score KABHI nahi)
  //    + profitability dono lanes pe (over-budget ki profitability hi to
  //    negotiation ka case banati hai: "£50 kam karwa lo to £220/mo banta hai")
  const scoredEligible = eligible.map((l) => {
    const s = scoreAgainstOrder(l, order);
    return {
      listing_id: l.listing_id,
      listing: slim(l),
      match_score: s.match_score,
      breakdown: s.breakdown,
      reasons: s.reasons,
      rejections: [],
      over_budget: false,
      profit: computeProfitability(order, l),
    };
  });

  const overBudgetRows = overBudget.map((l) => ({
    listing_id: l.listing_id,
    listing: slim(l),
    match_score: null, // over budget = no eligible match score (PRD hard rule)
    breakdown: null,
    reasons: [],
    rejections: hardFilterListing(l, order).rejections,
    over_budget: true,
    profit: computeProfitability(order, l),
  }));

  // 8) Rank — match score, barabar pe zyada net margin jeete
  scoredEligible.sort(
    (a, b) =>
      (b.match_score ?? 0) - (a.match_score ?? 0) ||
      (b.profit?.net_monthly_margin ?? -9e9) - (a.profit?.net_monthly_margin ?? -9e9)
  );
  overBudgetRows.sort((a, b) => (a.listing.price ?? 9e9) - (b.listing.price ?? 9e9));

  // 9) Save — shortlist mehfooz rehti hai (lib/orders.js ka upsert usool)
  let saved = { inserted: 0, updated: 0, removed: 0 };
  try {
    saved = await saveOrderMatches(order.Id, [...scoredEligible, ...overBudgetRows, ...rejectedRows]);
    await updateOrder(order.Id, { last_search_at: new Date().toISOString() });
    // Order timeline pe EK row per run (per-listing nahi — activities lib ka
    // usool: machine events lead rows se derive hote hain, spam nahi likhte).
    try {
      await logActivity({
        order_id: order.Id,
        type: 'search_run',
        title: 'Property search run',
        detail: `${totalFound} found · ${scoredEligible.length} eligible · ${overBudgetRows.length} over budget`,
        actor: 'System',
        meta: { totalFound, eligible: scoredEligible.length, overBudget: overBudgetRows.length, saved },
      });
    } catch {}
  } catch (e) {
    // Save fail ho to results phir bhi dikha do — magar chupke se nahi
    return Response.json({
      warning: `Results could not be saved (${e.message}) — showing live results only.`,
      searchUrl: built.search.url,
      totalFound, rejectedCount: rejectedCount + enrichRejected.length,
      eligible: scoredEligible,
      overBudget: showOverBudget ? overBudgetRows : [],
      overBudgetCount: overBudgetRows.length,
    });
  }

  return Response.json({
    searchUrl: built.search.url,
    totalFound,
    rejectedCount: rejectedCount + enrichRejected.length,
    enrichFailed, // in listings ke details is run me nahi mile — agli run pe dobara koshish hogi
    eligible: scoredEligible,
    overBudget: showOverBudget ? overBudgetRows : [],
    overBudgetCount: overBudgetRows.length,
    saved,
  });
}

/** Snapshot ke liye slim listing — order_properties row me JSON ban ke jata hai. */
function slim(l) {
  return {
    listing_id: l.listing_id,
    source: l.source || 'openrent',
    url: l.url,
    price: l.price ?? null,
    beds: l.beds ?? null,
    baths: l.baths ?? null,
    title: l.title ?? null,
    address: l.address ?? null,
    area: l.area ?? null,
    image: l.image ?? null,
    epc: l.epc ?? null,
    furnished: typeof l.furnished === 'boolean' ? l.furnished : null,
    furnishing: l.furnishing ?? null,
    available_from_days: l.available_from_days ?? null,
    hours_live: l.hours_live ?? null,
    response_rate: l.response_rate ?? null,
    landlord_name: l.landlord_name ?? null,
  };
}
