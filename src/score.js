// Scoring — har fresh listing ko 0-100 score do + human-readable reason.
// Factors (weighted): rent vs budget, beds fit, distance Mo ki base se, landlord response rate, freshness.
// Mo max-rent nahi diya abhi (priceMax=null) → price ko score me factor rakha, reject nahi kiya.

import { config, originLatLng } from './config.js';

// Haversine — do lat/lng ke beech km
function distanceKm(a, b) {
  if (a?.lat == null || b?.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// 0-1 clamp helper
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function scoreListing(l) {
  const reasons = [];
  let score = 0;

  // 1) Response rate (30) — landlord jitna responsive, viewing utni jaldi milegi
  if (l.response_rate != null) {
    const rr = (l.response_rate / 100) * 30;
    score += rr;
    if (l.response_rate >= 95) reasons.push(`landlord ${l.response_rate}% responsive`);
  } else {
    score += 15; // unknown = neutral half
  }

  // 2) Freshness (25) — jitna naya utna behtar (pehle aane ka advantage)
  if (l.hours_live != null) {
    const fresh = clamp01(1 - l.hours_live / config.freshWithinHours) * 25;
    score += fresh;
    if (l.hours_live <= 3) reasons.push(`${l.hours_live}h fresh`);
  }

  // 3) Distance (25) — Mo ki base ke jitna paas
  //
  // ⚠️ Yahan pehle `config.areas[0].radiusKm` tha. Do masle thay (22 Jul):
  //   1. Naye paste-link format me `radiusKm` hota hi nahi (radius ab link ke
  //      `area=3` param me hai), aur agar list khali ho to `[0]` crash karta.
  //   2. Mo ka business ab R2R hai — landlord ki nazdeeki ka koi matlab nahi.
  //      Ye pehle se dhundla score hai; abhi sirf tarteeb badalta hai, rokta nahi.
  // Is liye ab mehfooz default (3km) — score.js ki poori nazrsani alag kaam hai
  // aur Mo ke jawab ka muntazir hai (kaunse landlord haan kehte hain).
  const dist = distanceKm(originLatLng, l);
  if (dist != null) {
    const near = clamp01(1 - dist / (config.areas?.[0]?.radiusKm || 3)) * 25;
    score += near;
    l._distance_km = Math.round(dist * 100) / 100;
    if (dist <= 1.5) reasons.push(`${l._distance_km}km away`);
  } else {
    score += 12;
  }

  // 4) Price (15) — Mo ka budget aaya to us se compare; nahi to neutral
  if (config.filters.priceMax != null && l.price != null) {
    const underBudget = clamp01((config.filters.priceMax - l.price) / config.filters.priceMax) * 15;
    score += underBudget;
    if (l.price <= config.filters.priceMax) reasons.push(`£${l.price} under budget`);
  } else {
    score += 7; // budget unknown → neutral
  }

  // 5) EPC (5) — afiodorov se: energy efficiency quality signal. A/B/C acha, D+ neeche.
  if (l.epc) {
    const rank = { A: 5, B: 4.5, C: 4, D: 2.5, E: 1.5, F: 0.5, G: 0 }[l.epc.toUpperCase()] ?? 2.5;
    score += rank;
    if (['A', 'B', 'C'].includes(l.epc.toUpperCase())) reasons.push(`EPC ${l.epc}`);
  } else {
    score += 2.5;
  }

  return {
    ...l,
    score: Math.round(score),
    score_reason: reasons.join(', ') || 'meets basic criteria',
  };
}

// Score sab, threshold se upar wale sorted return karo
export function scoreAndFilter(listings, threshold = config.alertThreshold ?? 55) {
  return listings
    .map(scoreListing)
    .filter((l) => l.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

// ── Order-aware scoring (PRD Phase 1 — "Matching Engine") ──────────────────
//
// scoreListing() se ALAG function kyun: wo bot ke generic pipeline ka hai
// (config ke global filters pe), ye ek MAKHSOOS order ke against hai. PRD ke
// weights: Budget 30, Location 25, Bedrooms 15, Type 10, Availability 10,
// Furnishing 5, EPC/Other 5. Purana scoreListing() jahan tha wahin hai —
// bot ka behaviour zara bhi nahi badla.
//
// Ye sirf ELIGIBLE listings ke liye hai — hard filter (order-match.js) pehle
// chal chuka hota hai. Over-budget listing ko ye score KABHI nahi milta
// (PRD rule: over-budget = no normal eligible match score).

import { listingType, outwardCode, postcodeTokens } from './order-match.js';

export function scoreAgainstOrder(l, order) {
  const reasons = [];
  const b = {}; // breakdown — UI "clear reasons for the score" ke liye

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== '' && v != null ? n : null;
  };

  // 1) Budget (30) — hard gate pass ho chuka (price <= max_rent). Headroom
  // jitna zyada, score utna behtar: max_rent pe 22.5, 20%+ neeche pe poora 30.
  // Base itna ooncha kyun: within-budget hona khud bari baat hai (hard gate).
  const maxRent = num(order.max_rent);
  if (maxRent != null && l.price != null) {
    const headroom = (maxRent - l.price) / maxRent; // 0 … ~0.3
    b.budget_score = round1(30 * (0.75 + 0.25 * clamp01(headroom / 0.2)));
    reasons.push(
      headroom > 0
        ? `£${maxRent - l.price} under the £${maxRent} budget`
        : `At the £${maxRent} budget`
    );
  } else {
    b.budget_score = 15; // budget order me nahi diya → neutral half
  }

  // 2) Location (25) — search khud order ke area pe chali hai, to area match
  // base hai (15). Postcode order me diye hon aur listing ka mile to poora 25.
  const tokens = postcodeTokens(order);
  const out = outwardCode(l.address);
  if (!tokens.length) {
    b.location_score = 25; // koi postcode requirement nahi — area hi kaafi
    reasons.push(`In ${order.area || l.area || 'the required area'}`);
  } else if (out && tokens.some((t) => out === t || out.startsWith(t))) {
    b.location_score = 25;
    reasons.push(`Postcode ${out} matches the order`);
  } else {
    // Address abhi enrich nahi hua (ya outward code parse nahi hua) — mismatch
    // hota to hard filter reject kar deta. Ye sirf "unverified" hai.
    b.location_score = 15;
    reasons.push('In the searched area (postcode unverified)');
  }

  // 3) Bedrooms (15) — required minimum exact = 15 (council rate usually
  // per-beds hoti hai, zyada bara ghar zaroori nahi behtar ho). Har extra bed
  // -2, floor 9. Range me hona hard gate ne already ensure kiya.
  const bedsMin = num(order.bedrooms);
  if (l.beds != null && bedsMin != null) {
    const extra = Math.max(0, l.beds - bedsMin);
    b.bedroom_score = Math.max(9, 15 - extra * 2);
    reasons.push(`${l.beds} bedroom${l.beds === 1 ? '' : 's'}`);
  } else {
    b.bedroom_score = l.beds != null ? 12 : 7;
  }

  // 4) Property type (10) — order me type na ho to requirement hi nahi (10).
  // Match = 10, unknown (enrich pending) = 5 "unverified". Mismatch yahan aa
  // hi nahi sakta — hard filter pehle nikaal deta hai.
  const wantType = String(order.property_type || '').trim().toLowerCase();
  if (!wantType || wantType === 'any') {
    b.property_type_score = 10;
  } else {
    const got = listingType(l);
    if (got === wantType) {
      b.property_type_score = 10;
      reasons.push(`${cap(got)} as required`);
    } else {
      b.property_type_score = 5; // type abhi verify nahi hua
      reasons.push('Property type unverified');
    }
  }

  // 5) Availability (10) — jitni jaldi available, utna behtar (ASAP orders ka
  // default yehi hai). Unknown = neutral 5.
  const d = l.available_from_days;
  if (d != null) {
    b.availability_score = d <= 7 ? 10 : d <= 14 ? 8 : d <= 30 ? 6 : 3;
    if (d <= 0) reasons.push('Available now');
    else if (d <= 14) reasons.push(`Available in ${d} days`);
  } else {
    b.availability_score = 5;
  }

  // 6) Furnishing (5) — soft preference (PRD: ranking pe asar, exclude nahi).
  // Scraper boolean (furnished) deta hai, enrich string (furnishing) — dono dekho.
  const wantFurn = String(order.furnished || '').trim().toLowerCase();
  const gotFurn =
    typeof l.furnished === 'boolean'
      ? (l.furnished ? 'furnished' : 'unfurnished')
      : String(l.furnishing || '').trim().toLowerCase() || null;
  if (!wantFurn || wantFurn === 'any') {
    b.furnishing_score = 5;
  } else if (gotFurn == null) {
    b.furnishing_score = 2.5;
  } else if (gotFurn.includes(wantFurn) || wantFurn.includes(gotFurn)) {
    b.furnishing_score = 5;
    reasons.push(cap(gotFurn));
  } else {
    b.furnishing_score = 0;
    reasons.push(`${cap(gotFurn)} (order prefers ${wantFurn})`);
  }

  // 7) EPC / other (5) — scoreListing() wali ranking hi
  if (l.epc) {
    b.epc_score = { A: 5, B: 4.5, C: 4, D: 2.5, E: 1.5, F: 0.5, G: 0 }[l.epc.toUpperCase()] ?? 2.5;
    if (['A', 'B', 'C'].includes(l.epc.toUpperCase())) reasons.push(`EPC ${l.epc}`);
  } else {
    b.epc_score = 2.5;
  }

  const match_score = Math.round(
    b.budget_score + b.location_score + b.bedroom_score + b.property_type_score +
    b.availability_score + b.furnishing_score + b.epc_score
  );

  return { match_score, breakdown: b, reasons };
}

const round1 = (x) => Math.round(x * 10) / 10;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
