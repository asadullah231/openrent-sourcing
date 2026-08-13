// Activity log — CRM ki yaadasht. Har user action (outreach log, status
// change, note, shortlist) yahan ek row banata hai; timeline yahi se banti hai.
//
// Jaan-boojh kar YAHAN NAHI likhte: "Property discovered" / "Match calculated"
// jaise machine events. Ek Find run 100+ listings laata hai — har ek pe row
// likho to table kachra ban jati hai. Wo dono events lead row se hi derive
// hote hain (CreatedAt = discovered, match_score = calculated) — timeline
// component unhe khud jor leta hai, storage me sirf INSAANI kaam rehta hai.

const BASE = process.env.NOCODB_BASE_URL;
const TOKEN = process.env.NOCODB_TOKEN;
const TABLE = process.env.NOCODB_OR_ACTIVITIES_TABLE_ID;

const H = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };

/** NocoDB 1000 rows/page — sab chahiye to page karo (data.js jaisa hi). */
async function fetchAll(params = '') {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const url = `${BASE}/api/v2/tables/${TABLE}/records?limit=1000&offset=${page * 1000}${params}`;
    const res = await fetch(url, { headers: H, cache: 'no-store' });
    if (!res.ok) break;
    const j = await res.json();
    const list = j.list || [];
    out.push(...list);
    if (list.length < 1000) break;
  }
  return out;
}

/**
 * Ek activity likho. type chhota machine-slug hai (outreach_sent,
 * status_changed, note, shortlisted...), title/detail user ko dikhte hain.
 * meta me structured extras (JSON) — e.g. { from: 'matched', to: 'contacted' }.
 */
export async function logActivity({ order_id, listing_id, lead_row_id, type, title, detail, actor, meta }) {
  const res = await fetch(`${BASE}/api/v2/tables/${TABLE}/records`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify([
      {
        order_id: order_id != null ? Number(order_id) : null,
        listing_id: listing_id != null ? String(listing_id) : null,
        lead_row_id: lead_row_id != null ? Number(lead_row_id) : null,
        type: type || 'note',
        title: title || '',
        detail: detail || null,
        actor: actor || 'User',
        meta: meta ? JSON.stringify(meta) : null,
      },
    ]),
  });
  if (!res.ok) throw new Error(`Activity log failed (${res.status})`);
  const [created] = await res.json();
  return created;
}

function toActivity(r) {
  let meta = null;
  if (r.meta && typeof r.meta === 'string') {
    try { meta = JSON.parse(r.meta); } catch {}
  }
  return { ...r, meta };
}

/**
 * Activities parho — lead / order / listing ke hisaab se. Naya sab se upar.
 * Lead timeline `lead_row_id` se aati hai; order timeline `order_id` se
 * (jisme us order ke sab leads ka kaam bhi shamil hai); property timeline
 * `listing_id` se (ek property kai orders se match ho sakti hai).
 */
export async function getActivities({ orderId, listingId, leadRowId, limit = 200 } = {}) {
  let where = '';
  if (leadRowId != null) where = `(lead_row_id,eq,${leadRowId})`;
  else if (listingId != null) where = `(listing_id,eq,${listingId})`;
  else if (orderId != null) where = `(order_id,eq,${orderId})`;
  const rows = await fetchAll(where ? `&where=${encodeURIComponent(where)}` : '');
  return rows
    .map(toActivity)
    .sort((a, b) => new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0))
    .slice(0, limit);
}
