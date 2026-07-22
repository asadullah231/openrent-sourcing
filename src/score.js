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
