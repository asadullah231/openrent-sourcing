// Orders data layer — Phase 1 (PRD: Order is the centre of the system).
//
// Wahi NocoDB REST pattern jo lib/data.js ka hai (fetchAll paging, xc-token,
// batch PATCH). Do nayi tables:
//   openrent_orders            (NOCODB_OR_ORDERS_TABLE_ID)
//   openrent_order_properties  (NOCODB_OR_ORDER_PROPS_TABLE_ID)
//
// order_properties me listing_snapshot (JSON) kyun: "Find Properties" ka
// scrape listings ko BOT KE STORE ME NAHI daalta (wahi usool jo /api/search
// ka hai — order research se bot ka outreach store ganda na ho). To order
// detail page ke cards ke liye listing ka data yahin snapshot ho jata hai.

const BASE = process.env.NOCODB_BASE_URL;
const TOKEN = process.env.NOCODB_TOKEN;
const T = {
  orders: process.env.NOCODB_OR_ORDERS_TABLE_ID,
  orderProps: process.env.NOCODB_OR_ORDER_PROPS_TABLE_ID,
};

const H = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };

/** NocoDB 1000 rows/page — sab chahiye to page karo (data.js jaisa hi). */
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

function safeParse(v) {
  if (!v || typeof v !== 'string') return null;
  try { return JSON.parse(v); } catch { return null; }
}

// ── Orders ─────────────────────────────────────────────────────────────────

export async function getOrders() {
  const rows = await fetchAll(T.orders);
  // Naya upar. Active pehle, closed/fulfilled neeche.
  const rank = { active: 0, paused: 1, fulfilled: 2, closed: 3 };
  return rows.sort((a, b) => {
    const r = (rank[a.status] ?? 0) - (rank[b.status] ?? 0);
    if (r !== 0) return r;
    return new Date(b.CreatedAt || 0) - new Date(a.CreatedAt || 0);
  });
}

export async function getOrder(id) {
  const res = await fetch(`${BASE}/api/v2/tables/${T.orders}/records/${id}`, {
    headers: H, cache: 'no-store',
  });
  if (!res.ok) return null;
  const row = await res.json();
  return row?.Id ? row : null;
}

/** Order number khud banao agar user na de: ORD-0007 (NocoDB Id se). */
export async function createOrder(fields) {
  const res = await fetch(`${BASE}/api/v2/tables/${T.orders}/records`, {
    method: 'POST', headers: H, body: JSON.stringify([{ status: 'active', ...fields }]),
  });
  if (!res.ok) throw new Error(`Order create failed (${res.status})`);
  const [created] = await res.json();
  const id = created?.Id;
  if (id && !fields.order_number) {
    const order_number = `ORD-${String(id).padStart(4, '0')}`;
    await fetch(`${BASE}/api/v2/tables/${T.orders}/records`, {
      method: 'PATCH', headers: H, body: JSON.stringify([{ Id: id, order_number }]),
    });
    return { Id: id, ...fields, order_number, status: fields.status || 'active' };
  }
  return { Id: id, ...fields, status: fields.status || 'active' };
}

export async function updateOrder(id, patch) {
  const res = await fetch(`${BASE}/api/v2/tables/${T.orders}/records`, {
    method: 'PATCH', headers: H, body: JSON.stringify([{ Id: Number(id), ...patch }]),
  });
  if (!res.ok) throw new Error(`Order update failed (${res.status})`);
  return getOrder(id);
}

// ── Order ↔ property match rows ────────────────────────────────────────────

/** Row → page-friendly shape (snapshot JSON khol kar `listing` bana do). */
function toMatch(r) {
  return { ...r, listing: safeParse(r.listing_snapshot) || {} };
}

/**
 * Order ke match rows. Default me `rejected` rows BAHAR — wo display ke liye
 * nahi, sirf "is listing pe enrich kharch ho chuka, ye junk hai" ki yaadasht
 * hain (find route includeRejected:true se anhe merge ke liye uthata hai).
 */
export async function getOrderMatches(orderId, { includeRejected = false } = {}) {
  const rows = await fetchAll(T.orderProps, `&where=${encodeURIComponent(`(order_id,eq,${orderId})`)}`);
  return rows
    .filter((r) => includeRejected || !r.rejected)
    .map(toMatch)
    .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
}

/**
 * "Find Properties" ke results save karo — UPSERT by (order_id, listing_id).
 *
 * Shortlist ka usool (store.js ke PROTECTED_ON_PATCH wala sabaq): dobara
 * search chalane se Mo ki shortlist/next_action KABHI reset nahi hoti —
 * naye scores purani row me merge hote hain, shortlist_status chhua nahi
 * jata. Jo purani rows is search me nahi aayin (listing chali gayi) wo bhi
 * delete NAHI hotin agar shortlisted hain; sirf un-shortlisted stale rows
 * saaf hoti hain (warna table kachra jama karti rehti).
 */
export async function saveOrderMatches(orderId, results) {
  const existing = await fetchAll(T.orderProps, `&where=${encodeURIComponent(`(order_id,eq,${orderId})`)}`);
  const byListing = new Map(existing.map((r) => [String(r.listing_id), r]));
  const seen = new Set();

  const inserts = [];
  const patches = [];
  for (const m of results) {
    const key = String(m.listing_id);
    seen.add(key);
    const row = {
      order_id: Number(orderId),
      listing_id: key,
      match_score: m.match_score ?? null,
      budget_score: m.breakdown?.budget_score ?? null,
      location_score: m.breakdown?.location_score ?? null,
      bedroom_score: m.breakdown?.bedroom_score ?? null,
      property_type_score: m.breakdown?.property_type_score ?? null,
      availability_score: m.breakdown?.availability_score ?? null,
      furnishing_score: m.breakdown?.furnishing_score ?? null,
      epc_score: m.breakdown?.epc_score ?? null,
      over_budget: !!m.over_budget,
      rejected: !!m.rejected,
      gross_spread: m.profit?.gross_spread ?? null,
      agent_fee: m.profit?.agent_fee ?? null,
      other_costs: m.profit?.other_costs ?? null,
      costs_estimated: m.profit ? !m.profit.costs_specified : false,
      net_monthly_margin: m.profit?.net_monthly_margin ?? null,
      annual_margin: m.profit?.annual_margin ?? null,
      margin_percentage: m.profit?.margin_percentage ?? null,
      profitability_status: m.profit?.profitability_status ?? null,
      match_reasons: JSON.stringify(m.reasons || []),
      rejection_reasons: JSON.stringify(m.rejections || []),
      listing_snapshot: JSON.stringify(m.listing || {}),
    };
    const prev = byListing.get(key);
    if (prev) {
      // shortlist_status / next_action patch me NAHI — mehfooz rahen
      patches.push({ Id: prev.Id, ...row });
    } else {
      inserts.push({ ...row, shortlist_status: null, next_action: null });
    }
  }

  // Stale UN-shortlisted rows delete (listing ab search me nahi aati)
  const stale = existing.filter(
    (r) => !seen.has(String(r.listing_id)) && r.shortlist_status !== 'shortlisted'
  );

  for (let i = 0; i < inserts.length; i += 25) {
    await fetch(`${BASE}/api/v2/tables/${T.orderProps}/records`, {
      method: 'POST', headers: H, body: JSON.stringify(inserts.slice(i, i + 25)),
    });
  }
  for (let i = 0; i < patches.length; i += 25) {
    await fetch(`${BASE}/api/v2/tables/${T.orderProps}/records`, {
      method: 'PATCH', headers: H, body: JSON.stringify(patches.slice(i, i + 25)),
    });
  }
  for (let i = 0; i < stale.length; i += 25) {
    await fetch(`${BASE}/api/v2/tables/${T.orderProps}/records`, {
      method: 'DELETE', headers: H,
      body: JSON.stringify(stale.slice(i, i + 25).map((r) => ({ Id: r.Id }))),
    });
  }

  return { inserted: inserts.length, updated: patches.length, removed: stale.length };
}

/** Shortlist toggle + next action — match row pe chhota sa patch. */
export async function setShortlist(orderId, listingId, shortlisted, nextAction) {
  const rows = await fetchAll(T.orderProps, `&where=${encodeURIComponent(`(order_id,eq,${orderId})`)}`);
  const row = rows.find((r) => String(r.listing_id) === String(listingId));
  if (!row) return null;
  const patch = {
    Id: row.Id,
    shortlist_status: shortlisted ? 'shortlisted' : null,
    // Default next action — MVP criteria #8: "see the next action needed".
    next_action: shortlisted ? (nextAction || row.next_action || 'Review & contact landlord') : null,
  };
  const res = await fetch(`${BASE}/api/v2/tables/${T.orderProps}/records`, {
    method: 'PATCH', headers: H, body: JSON.stringify([patch]),
  });
  if (!res.ok) throw new Error(`Shortlist update failed (${res.status})`);
  return { ...toMatch(row), ...patch };
}

/** Ek order ke matches ki summary — orders list page ke liye. */
export async function getMatchCounts(orderIds) {
  const rows = await fetchAll(T.orderProps);
  const map = {};
  for (const r of rows) {
    if (r.rejected) continue; // yaadasht rows — ginti me nahi
    const k = String(r.order_id);
    if (!map[k]) map[k] = { eligible: 0, overBudget: 0, shortlisted: 0 };
    if (r.over_budget) map[k].overBudget++;
    else map[k].eligible++;
    if (r.shortlist_status === 'shortlisted') map[k].shortlisted++;
  }
  return map;
}
