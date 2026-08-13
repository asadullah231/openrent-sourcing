// Data layer — ab NocoDB se parhta/likhta hai (pehle local JSON files thin).
// Wajah: Vercel pe filesystem read-only + har request naye server pe ja sakti hai,
// to local files pe dashboard khaali dikhta aur saves chup-chaap fail hote.
//
// Bot (src/store.js, src/config.js, src/viewing.js) bhi INHI tables pe hai —
// warna dashboard aur bot alag ho jate: Mo setting badalta, bot ko pata na chalta.
//
// Exports ki shakl bilkul wahi hai jo file-version me thi — pages badle nahi.

const BASE = process.env.NOCODB_BASE_URL;
const TOKEN = process.env.NOCODB_TOKEN;
const T = {
  listings: process.env.NOCODB_OR_LISTINGS_TABLE_ID,
  settings: process.env.NOCODB_OR_SETTINGS_TABLE_ID,
  log: process.env.NOCODB_OR_LOG_TABLE_ID,
};

const H = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };

/** NocoDB 1000 rows/page pe capped hai — sab kuch chahiye to page karo. */
async function fetchAll(tableId, params = '') {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const url = `${BASE}/api/v2/tables/${tableId}/records?limit=1000&offset=${page * 1000}${params}`;
    const res = await fetch(url, { headers: H, cache: 'no-store' });
    if (!res.ok) break;
    const j = await res.json();
    const list = j.list || [];
    out.push(...list);
    if (list.length < 1000) break;
  }
  return out;
}

/** NocoDB row -> wahi shakl jo pages expect karte hain. */
function toListing(r) {
  return {
    ...r,
    images: safeParse(r.images) ?? (r.image ? [r.image] : []),
    _distance_km: r.distance_km ?? null,
  };
}

function safeParse(v) {
  if (!v || typeof v !== 'string') return null;
  try { return JSON.parse(v); } catch { return null; }
}

export async function getListings() {
  const rows = await fetchAll(T.listings);
  return rows.map(toListing).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// Jinpe abhi tak request nahi gayi (naye/pending) — action lene layak.
// 🐛 FIX (23 Jul): sirf OpenRent (contactable). Rightmove Phase A me READ-ONLY
// hai — us pe outreach nahi jaata, is liye use "action layak" dikhana galat.
export async function getPending() {
  const all = await getListings();
  return all.filter(
    (l) => (l.source || 'openrent') === 'openrent' && (l.viewing_status || 'new') !== 'requested'
  );
}

// Jinpe request ja chuki (sent) — history, requested_at pe sorted (naya upar)
export async function getSent() {
  const all = await getListings();
  return all
    .filter((l) => l.viewing_status === 'requested')
    .sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0));
}

/** settings ek hi row me JSON string ke tor pe padi hai (key='main'). */
async function settingsRow() {
  const rows = await fetchAll(T.settings);
  return rows.find((r) => r.key === 'main') ?? null;
}

export async function getSettings() {
  const row = await settingsRow();
  return safeParse(row?.value) ?? {};
}

// Ek search ki pehchaan: source + slug + asli filter params (runtime params
// chhoro). Dono jagah (yahan aur save route) YEHI key — warna dedup match nahi karta.
export function areaKey(a) {
  const IGNORE = new Set(['isLive', 'viewingProperty', 'viewingproperty', 'index']);
  const p = new URLSearchParams();
  Object.entries(a?.params || {})
    .filter(([k]) => !IGNORE.has(k))
    .sort(([x], [y]) => x.localeCompare(y))
    .forEach(([k, v]) => p.set(k, v));
  return `${a?.source || 'openrent'}|${a?.slug || a?.name || ''}|${p.toString()}`;
}

export async function saveSettings(next) {
  const row = await settingsRow();
  const cur = safeParse(row?.value) ?? {};

  // 🐛 FIX (23 Jul — "searches gayab" ka asli root cause): areas ko wholesale
  // REPLACE mat karo. Client (Outreach toggle) apna PURANA cached areas array
  // bhejta hai; agar hum us se server ka accha array overwrite karein, to kisi
  // doosri tab/route se abhi-abhi add hui search UD jaati hai (lost update).
  //
  // Ab MERGE-BY-KEY: server + incoming dono ke areas ko key pe jodo. Incoming
  // ka enabled/naam jeet jaye (Mo ne abhi badla), par koi maujooda search sirf
  // is liye na mite ke client ke stale array me nahi thi.
  let mergedAreas;
  if (Array.isArray(next.areas)) {
    const byKey = new Map();
    for (const a of cur.areas || []) byKey.set(areaKey(a), a);
    for (const a of next.areas) {
      const k = areaKey(a);
      byKey.set(k, byKey.has(k) ? { ...byKey.get(k), ...a } : a);
    }
    // Explicit delete: agar next me `_deleteKeys` ho (UI ne jaan boojh ke hataya)
    // to sirf wahi hatao. Warna kuch delete nahi hota.
    mergedAreas = [...byKey.values()];
    if (Array.isArray(next._deleteKeys) && next._deleteKeys.length) {
      const del = new Set(next._deleteKeys);
      mergedAreas = mergedAreas.filter((a) => !del.has(areaKey(a)));
    }
  } else {
    mergedAreas = cur.areas;
  }

  const merged = {
    ...cur, ...next,
    areas: mergedAreas,
    viewing: { ...cur.viewing, ...next.viewing },
    filters: { ...cur.filters, ...next.filters },
  };
  delete merged._deleteKeys; // ye control field hai, store me na jaye
  const body = JSON.stringify(merged);

  if (row) {
    await fetch(`${BASE}/api/v2/tables/${T.settings}/records`, {
      method: 'PATCH', headers: H, body: JSON.stringify([{ Id: row.Id, value: body }]),
    });
  } else {
    await fetch(`${BASE}/api/v2/tables/${T.settings}/records`, {
      method: 'POST', headers: H, body: JSON.stringify([{ key: 'main', value: body }]),
    });
  }
  return merged;
}

// ── Listing bulk actions (dashboard folder view — Smartlead-style campaign) ──
//
// Har action listing_id ke zariye NocoDB row patch karta hai. Mo folder khol kar
// rooms select karta hai, phir bulk: hide / unhide / queue-for-send.
//
// KYUN patch (delete nahi): "remove" = soft hide (viewing_status:'hidden'), taake
// data bacha rahe aur wapas laya ja sake. "send" = 'queued' mark, taake bot ke
// run me sirf yehi listings priority pe jayein (dashboard Vercel se seedha OpenRent
// message nahi bhej sakta — bot ke session se jata hai).

/** listing_id -> NocoDB row Id map (patch ke liye Id chahiye, listing_id nahi). */
async function listingIdMap() {
  const rows = await fetchAll(T.listings);
  const m = new Map();
  for (const r of rows) m.set(String(r.listing_id), r.Id);
  return m;
}

/** Diye gaye listing_ids ko ek patch field se update karo (25-25 batch). */
async function patchListings(listingIds, patch) {
  if (!Array.isArray(listingIds) || !listingIds.length) return 0;
  const idMap = await listingIdMap();
  const rows = listingIds
    .map((lid) => idMap.get(String(lid)))
    .filter(Boolean)
    .map((Id) => ({ Id, ...patch }));
  let written = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    const res = await fetch(`${BASE}/api/v2/tables/${T.listings}/records`, {
      method: 'PATCH', headers: H, body: JSON.stringify(batch),
    });
    if (res.ok) written += batch.length;
  }
  return written;
}

/** Rooms folder se hatao (soft) — viewing_status:'hidden'. Wapas laya ja sakta. */
export async function hideListings(listingIds) {
  return patchListings(listingIds, { viewing_status: 'hidden' });
}

/** Hidden rooms wapas laao — status 'new' (dobara action-eligible). */
export async function unhideListings(listingIds) {
  return patchListings(listingIds, { viewing_status: 'new' });
}

/**
 * Selected rooms ko SEND ke liye queue karo — viewing_status:'queued'.
 * Bot ka agla run (ya turant trigger) sirf 'queued' listings ko priority pe
 * bhejta hai. 'requested' (ja chuki) ko chhedo mat.
 */
export async function queueListings(listingIds) {
  return patchListings(listingIds, { viewing_status: 'queued' });
}

/**
 * Lead ki listing bot ke store me daalo (order-found properties store me
 * NAHI hotin — snapshots order_properties me hain). Engine sirf apne store
 * se bhejta hai, is liye "Queue outreach" ke liye row yahan honi zaroori hai.
 * Sirf store ke maloom columns bhejte hain (NocoDB unknown field pe girta hai).
 */
export async function addListingToStore(listing, extra = {}) {
  const allow = [
    'listing_id', 'url', 'price', 'beds', 'baths', 'hours_live', 'area', 'title',
    'response_rate', 'address', 'furnishing', 'epc', 'image', 'landlord_name', 'source',
  ];
  const row = { viewing_status: 'queued', scraped_at: new Date().toISOString(), ...extra };
  for (const k of allow) {
    if (listing?.[k] != null) row[k] = listing[k];
  }
  if (!row.listing_id) return false;
  const res = await fetch(`${BASE}/api/v2/tables/${T.listings}/records`, {
    method: 'POST', headers: H, body: JSON.stringify([row]),
  });
  return res.ok;
}

/** Ek listing ki store row (raw) — queue/sync guards ke liye. */
export async function getListingRow(listingId) {
  const rows = await fetchAll(T.listings);
  return rows.find((r) => String(r.listing_id) === String(listingId)) || null;
}

/** viewing rows — kind='draft' (banaye gaye) ya 'sent' (bheje gaye). */
async function viewingRows(kind) {
  const rows = await fetchAll(T.log);
  return rows.filter((r) => r.kind === kind);
}

// ── Per-room notes (campaign panel — Atomic/Twenty CRM jaisa) ──────────────
//
// KYUN settings JSON me (naya DB field nahi): NocoDB v2 patch naya column nahi
// banata — us ke liye schema change chahiye. Notes chhoti cheez hai, per-listing
// ek chhota text. Settings row me `roomNotes` map (listing_id -> {text, at})
// rakhna sab se saaf: koi migration nahi, dashboard + bot dono isi row ko dekhte.

/** Saare room notes ek map me: { [listing_id]: { text, at } }. */
export async function getRoomNotes() {
  const s = await getSettings();
  return s.roomNotes && typeof s.roomNotes === 'object' ? s.roomNotes : {};
}

/** Ek room ka note set/clear karo. Khaali text = note hata do. */
export async function setRoomNote(listingId, text) {
  const row = await settingsRow();
  const cur = safeParse(row?.value) ?? {};
  const notes = cur.roomNotes && typeof cur.roomNotes === 'object' ? { ...cur.roomNotes } : {};
  const key = String(listingId);
  const clean = (text || '').trim();
  if (clean) notes[key] = { text: clean, at: new Date().toISOString() };
  else delete notes[key];

  const merged = { ...cur, roomNotes: notes };
  const body = JSON.stringify(merged);
  if (row) {
    await fetch(`${BASE}/api/v2/tables/${T.settings}/records`, {
      method: 'PATCH', headers: H, body: JSON.stringify([{ Id: row.Id, value: body }]),
    });
  } else {
    await fetch(`${BASE}/api/v2/tables/${T.settings}/records`, {
      method: 'POST', headers: H, body: JSON.stringify([{ key: 'main', value: body }]),
    });
  }
  return notes[key] ?? null;
}

// ── Activity log per listing (kab draft/queue/send hua) ────────────────────
//
// Kanban/notes panel timeline dikhata hai. Send log (T.log, kind='sent') me
// listing_id + timestamp hai. queued/hidden events ka apna audit nahi — wo
// viewing_status me hi hai, is liye timeline = send events + note-updated.

/** listing_id -> [{ kind, at }] — abhi sirf 'sent' events (jo track hote hain). */
export async function getActivityByListing() {
  const rows = await fetchAll(T.log);
  const map = {};
  for (const r of rows) {
    if (r.kind !== 'sent') continue;
    const k = String(r.listing_id);
    (map[k] ||= []).push({ kind: 'sent', at: r.sent_at || r.created_at || r.CreatedAt || null, mode: r.mode });
  }
  return map;
}

// Ek listing + uska bheja gaya message (drafts/log se) — detail page ke liye
export async function getListing(id) {
  const rows = await fetchAll(T.listings);
  const raw = rows.find((r) => String(r.listing_id) === String(id));
  if (!raw) return null;
  const l = toListing(raw);

  // Exact message jo bheja gaya (ya draft) — draft row me poora message hota hai
  const drafts = await viewingRows('draft');
  const draft = drafts.reverse().find((d) => String(d.listing_id) === String(id));

  // Send log se status/time
  const sends = (await viewingRows('sent')).filter((x) => String(x.listing_id) === String(id));
  const lastSend = sends[sends.length - 1] || null;

  // priority: store me sent_message (live send se) > draft message
  return { ...l, sentMessage: l.sent_message || draft?.message || null, lastSend };
}

export async function getDrafts() {
  return (await viewingRows('draft')).reverse();
}

export async function getSendLog() {
  return (await viewingRows('sent')).reverse();
}

// Dashboard health/summary
export async function getHealth() {
  const listings = await getListings();
  const settings = await getSettings();
  // Poori log table (sent + draft + reserve) — cap ke liye reserves bhi chahiye.
  const allLog = await fetchAll(T.log);
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = allLog.filter((x) => x.day === today);
  const liveSent = todayLog.filter((x) => x.kind === 'sent' && x.mode === 'live').length;
  // Reserve-aware used count — bot (src/cap.js) ke saath EXACT match. Warna
  // dashboard aur bot alag budget dekhte aur cap paar ho jata (AUDIT #1).
  const reserved = todayLog.filter((x) => x.kind === 'reserve').length;
  const usedToday = liveSent + reserved;
  return {
    totalListings: listings.length,
    withScore: listings.filter((l) => l.score != null).length,
    aboveViewingBar: listings.filter((l) => (l.score ?? 0) >= (settings.viewing?.minScore ?? 65)).length,
    // sentToday ab reserve-aware "used" hai — cap ke against yehi ginti hai.
    sentToday: usedToday,
    liveSentToday: liveSent, // sirf asli sends (UI display ke liye, cap ke liye nahi)
    reservedToday: reserved,
    draftsToday: todayLog.filter((x) => x.kind === 'sent' && x.mode === 'shadow').length,
    mode: settings.viewing?.mode ?? 'shadow',
    autopilot: settings.viewing?.autopilot ?? 'on',
    dailyCap: settings.viewing?.dailyCap ?? 15,
    minScore: settings.viewing?.minScore ?? 65,
    // Chalu searches ke naam — home page ka header dikhata hai. Pehle wahan
    // "Tower Hamlets" hard-coded tha, jo kai searches ke baad jhoot ban jata.
    areas: (settings.areas || []).filter((a) => a?.enabled !== false).map((a) => a?.name).filter(Boolean),
  };
}
