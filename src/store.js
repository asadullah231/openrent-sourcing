// NocoDB store — dedupe by listing_id.
// Pehle local data/listings.json thi; ab NocoDB, kyunki dashboard Vercel pe hai
// (read-only filesystem) aur dono ko EK hi source chahiye — warna Mo dashboard pe
// kuch badalta aur bot purani file parhta rehta.

const BASE = process.env.NOCODB_BASE_URL;
const TOKEN = process.env.NOCODB_TOKEN;
const TABLE = process.env.NOCODB_OR_LISTINGS_TABLE_ID;
const H = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };

/** NocoDB 1000 rows/page pe capped — sab chahiye to page karo. */
async function fetchAll() {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const res = await fetch(`${BASE}/api/v2/tables/${TABLE}/records?limit=1000&offset=${page * 1000}`, { headers: H });
    if (!res.ok) break;
    const list = (await res.json()).list || [];
    out.push(...list);
    if (list.length < 1000) break;
  }
  return out;
}

/** JS object -> NocoDB row (arrays JSON string, _distance_km -> distance_km). */
function toRow(l) {
  const { _forceUpdate, _distance_km, images, ...rest } = l;
  return {
    ...rest,
    ...(images !== undefined ? { images: JSON.stringify(images) } : {}),
    ...(_distance_km !== undefined ? { distance_km: _distance_km } : {}),
  };
}

// 🐛 FIX (23 Jul): enrichment PATCH (_forceUpdate) me ye fields KABHI na jaayein —
// warna ek enriched object (jisme default viewing_status:'new') pehle se 'requested'
// listing ka status wapas 'new' kar deta, aur bot us landlord ko DOBARA message
// bhej deta. Status/history sirf viewing flow badalta hai, enrich nahi.
const PROTECTED_ON_PATCH = ['viewing_status', 'requested_at', 'sent_message'];
function toPatchRow(l) {
  const row = toRow(l);
  for (const k of PROTECTED_ON_PATCH) delete row[k];
  return row;
}

/** NocoDB row -> wahi shakl jo bot ka baaki code expect karta hai. */
function fromRow(r) {
  let images = [];
  try { images = r.images ? JSON.parse(r.images) : []; } catch { images = r.image ? [r.image] : []; }
  return { ...r, images, _distance_km: r.distance_km ?? null };
}

// Naye listings merge karo. Purane ka viewing_status/enrichment preserve, sirf naye add.
// Returns: { added: [...], total, seenBefore }
export async function upsert(listings) {
  const rows = await fetchAll();
  const byId = new Map(rows.map((r) => [String(r.listing_id), r]));

  const toInsert = [];
  const toPatch = [];

  for (const l of listings) {
    const existing = byId.get(String(l.listing_id));
    if (l._forceUpdate) {
      // Enrichment update — mojooda record ke upar merge. toPatchRow status/history
      // ko chhu nahi sakta (upar wajah), is liye 'requested' listing safe rehti hai.
      if (existing) toPatch.push({ Id: existing.Id, ...toPatchRow(l) });
      continue;
    }
    if (existing) continue; // dedupe — pehle se hai to chhoro
    toInsert.push(toRow(l));
  }

  if (toInsert.length) {
    await fetch(`${BASE}/api/v2/tables/${TABLE}/records`, {
      method: 'POST', headers: H, body: JSON.stringify(toInsert),
    });
  }
  if (toPatch.length) {
    await fetch(`${BASE}/api/v2/tables/${TABLE}/records`, {
      method: 'PATCH', headers: H, body: JSON.stringify(toPatch),
    });
  }

  return {
    added: toInsert.map(fromRow),
    total: rows.length + toInsert.length,
    seenBefore: listings.length - toInsert.length,
  };
}

export async function count() {
  return (await fetchAll()).length;
}

// Ek listing ka status/patch update karo (viewing_status waghera) — merge, save.
export async function updateStatus(listingId, patch) {
  const rows = await fetchAll();
  const row = rows.find((r) => String(r.listing_id) === String(listingId));
  if (!row) return false;
  const res = await fetch(`${BASE}/api/v2/tables/${TABLE}/records`, {
    method: 'PATCH', headers: H, body: JSON.stringify([{ Id: row.Id, ...toRow(patch) }]),
  });
  return res.ok;
}

// Store se scored listings load karo (viewing processing ke liye)
export async function all() {
  return (await fetchAll()).map(fromRow);
}
