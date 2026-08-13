// Order-aware HARD filtering — PRD Phase 1 ka "Hard Filter" stage.
//
// Usool (PRD section 3): hard requirement fail = listing eligible list me AATI
// HI NAHI. Sirf budget-fail wali listings ek ALAG "over budget" lane me jati
// hain (negotiation research ke liye) — normal match kabhi nahi bantin.
//
// Ek zaroori design faisla (existing score.js ke usool se same):
//   UNKNOWN data pe reject NAHI karte — sirf CONFIRMED violation pe.
//   Wajah: search page pe type/postcode/EPC hote hi nahi (enrich ke baad aate
//   hain). Agar "type unknown = reject" karte to enrich se pehle sab kuch
//   reject ho jata. Is liye: jo cheez maloom hai aur ghalat hai → reject;
//   jo maloom nahi → guzar jao, match score me "unverified" ki penalty milti hai.

// "Room in a Shared Flat" whole property NAHI hai — beds ka number pass ho
// tab bhi council order ke liye bekaar. (viewing.js me bhi yehi usool hai.)
const SHARED_ROOM_RE = /room in a shared|room to rent|house ?share|flat ?share|shared (flat|house|accommodation)/i;

/** Address ke aakhir se UK outward code nikaalo ("12 Stewart Rd, Bromley BR1 4EX" → "BR1"). */
export function outwardCode(address) {
  const m = String(address || '').toUpperCase().match(/([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})?\s*$/);
  return m ? m[1] : null;
}

/** Order ke postcodes field ("BR1, BR2" / "SE9") ko tokens me todo. */
export function postcodeTokens(order) {
  return String(order?.postcodes || '')
    .toUpperCase()
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Listing ka property type nikaalo (enrich ke baad title se: "2 Bed Flat, ..."). */
export function listingType(l) {
  const t = String(l?.title || '');
  if (SHARED_ROOM_RE.test(t)) return 'room';
  const m = t.match(/\b(flat|house|maisonette|studio|apartment|bungalow)\b/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return v === 'apartment' ? 'flat' : v;
}

/**
 * Ek listing ko order ke HARD requirements pe parkho.
 *
 * Return: { eligible, overBudget, rejections[] }
 *   - eligible   : sab hard checks pass (budget samet)
 *   - overBudget : SIRF budget fail hua, baqi sab pass — "negotiation" lane
 *   - rejections : insani zaban me wajah(ein) — UI/audit ke liye
 */
export function hardFilterListing(l, order) {
  const rejections = [];
  let budgetFail = false;

  // 1) Maximum rent — THE hard business rule (PRD: critical P0)
  const maxRent = num(order.max_rent);
  if (maxRent != null) {
    if (l.price == null) {
      rejections.push('Rent unknown — cannot verify against budget');
    } else if (l.price > maxRent) {
      budgetFail = true;
      rejections.push(`Rent £${l.price} is £${l.price - maxRent} over the £${maxRent} maximum`);
    }
  }
  // Min rent (order me ho to) — is se sasti listings aksar scam/room hoti hain
  const minRent = num(order.min_rent);
  if (minRent != null && l.price != null && l.price < minRent) {
    rejections.push(`Rent £${l.price} is below the £${minRent} minimum`);
  }

  // 2) Minimum bedrooms — hard
  const bedsMin = num(order.bedrooms);
  if (bedsMin != null && l.beds != null && l.beds < bedsMin) {
    rejections.push(`${l.beds} bedroom${l.beds === 1 ? '' : 's'} — order needs ${bedsMin}+`);
  }
  const bedsMax = num(order.bedrooms_max);
  if (bedsMax != null && l.beds != null && l.beds > bedsMax) {
    rejections.push(`${l.beds} bedrooms — order max is ${bedsMax}`);
  }

  // 3) Shared room — kabhi eligible nahi (beds pass ho tab bhi)
  if (l.title && SHARED_ROOM_RE.test(l.title)) {
    rejections.push('Room in a shared property — not a whole property');
  }

  // 4) Property type — hard WHERE SPECIFIED aur jahan listing ka type maloom ho
  const wantType = String(order.property_type || '').trim().toLowerCase();
  if (wantType && wantType !== 'any') {
    const got = listingType(l);
    if (got && got !== wantType) {
      rejections.push(`Property is a ${got} — order needs a ${wantType}`);
    }
    // got == null → type abhi maloom nahi (enrich pending) → reject nahi,
    // score me "type unverified" penalty milegi.
  }

  // 5) Postcode — hard jahan order me diye hon AUR listing ka address maloom ho
  const tokens = postcodeTokens(order);
  if (tokens.length && l.address) {
    const out = outwardCode(l.address);
    if (out && !tokens.some((t) => out === t || out.startsWith(t))) {
      rejections.push(`Postcode ${out} is outside the required area (${tokens.join(', ')})`);
    }
  }

  // 6) Availability — hard where specified. Order me date ho to us tak available
  // hona chahiye. "ASAP" ko hard nahi banate (har cheez kabhi na kabhi available
  // hai) — wo scoring me freshness/availability factor se handle hota hai.
  const needBy = parseNeedByDate(order.availability);
  if (needBy != null && l.available_from_days != null) {
    const daysUntilNeeded = Math.ceil((needBy - Date.now()) / 86400000);
    if (l.available_from_days > daysUntilNeeded + 7) {
      rejections.push(`Available in ${l.available_from_days} days — order needs it by ${new Date(needBy).toLocaleDateString('en-GB')}`);
    }
  }

  const otherFails = rejections.length - (budgetFail ? 1 : 0);
  return {
    eligible: rejections.length === 0,
    // over-budget lane: SIRF budget ki wajah se bahar (baqi sab theek tha)
    overBudget: budgetFail && otherFails === 0,
    rejections,
  };
}

/** "ASAP" → null; date-string → epoch ms; kuch aur/khali → null. */
function parseNeedByDate(availability) {
  const s = String(availability || '').trim();
  if (!s || /^asap$/i.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : null;
}
