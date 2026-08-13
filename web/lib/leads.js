// Sourcing Lead model — CRM ka markazi object.
//
// Lead = order_properties ki EK row hi hai (property + order + match + margin
// + shortlist), alag table nahi. Ye faisla soch kar hai: Phase 1 ke rows me
// pehle se sab kuch hai, sirf pipeline/outreach columns barhai hain
// (lead_status, outreach_status, next_action_date, loss_reason). Migration
// hoti to Find-route ka upsert, shortlist, counts — sab dobara likhna parta.
//
// "Lead" aur "match row" me farq sirf nazariye ka hai: /orders property-research
// ke lens se dekhta hai (match %, over budget), /leads pipeline ke lens se
// (kis se baat hui, agla qadam kya). Data ek hi hai — do sources of truth nahi.

const BASE = process.env.NOCODB_BASE_URL;
const TOKEN = process.env.NOCODB_TOKEN;
const T = {
  orders: process.env.NOCODB_OR_ORDERS_TABLE_ID,
  orderProps: process.env.NOCODB_OR_ORDER_PROPS_TABLE_ID,
};

const H = { 'xc-token': TOKEN, 'Content-Type': 'application/json' };

// Pipeline — tarteeb hi funnel hai. UI labels English (HARD RULE).
export const LEAD_STATUSES = [
  { key: 'new', label: 'New' },
  { key: 'matched', label: 'Matched' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'ready_to_contact', label: 'Ready to contact' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'awaiting_response', label: 'Awaiting response' },
  { key: 'interested', label: 'Interested' },
  { key: 'viewing', label: 'Viewing' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'deal', label: 'Deal' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

// Outreach = OpenRent ke andar baat-cheet ki halat (email-CRM statuses NAHI).
export const OUTREACH_STATUSES = [
  { key: 'not_contacted', label: 'Not contacted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'awaiting_response', label: 'Awaiting response' },
  { key: 'interested', label: 'Interested' },
  { key: 'no_response', label: 'No response' },
  { key: 'not_interested', label: 'Not interested' },
];

export const LOSS_REASONS = [
  { key: 'over_budget', label: 'Over budget' },
  { key: 'not_suitable', label: 'Not suitable' },
  { key: 'no_response', label: 'No response' },
  { key: 'landlord_declined', label: 'Landlord declined' },
  { key: 'property_unavailable', label: 'Property unavailable' },
  { key: 'other', label: 'Other' },
];

export function leadStatusLabel(key) {
  return LEAD_STATUSES.find((s) => s.key === key)?.label || key || '—';
}
export function outreachStatusLabel(key) {
  return OUTREACH_STATUSES.find((s) => s.key === key)?.label || key || '—';
}

/** Lead ka insaani number — row Id se, order ki tarah derived (alag column nahi). */
export function leadRef(rowId) {
  return `OP-${String(rowId).padStart(5, '0')}`;
}

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

/**
 * Row → Lead. Purani rows (Phase 1) me lead_status khali hai — wahan se
 * derive hota hai: shortlisted ho to 'shortlisted', warna 'matched'.
 * Isi liye kahin migration script nahi chalani pari.
 */
export function toLead(r, order) {
  const listing = safeParse(r.listing_snapshot) || {};
  const status =
    r.lead_status || (r.shortlist_status === 'shortlisted' ? 'shortlisted' : 'matched');
  return {
    ...r,
    listing,
    reasons: safeParse(r.match_reasons) || [],
    rejections: safeParse(r.rejection_reasons) || [],
    ref: leadRef(r.Id),
    status,
    outreach_status: r.outreach_status || 'not_contacted',
    order: order || null,
  };
}

const ACTIVE_CUTOFF = ['won', 'lost']; // in ke baad lead "band" hai

export function isActiveLead(lead) {
  return !ACTIVE_CUTOFF.includes(lead.status);
}

/**
 * Sab leads, apne orders ke sath (join yahin — pages ko do fetch nahi karne
 * parte). rejected rows nahi aatin (wo enrich yaadasht hain, leads nahi).
 */
export async function getLeads() {
  const [orders, rows] = await Promise.all([fetchAll(T.orders), fetchAll(T.orderProps)]);
  const byId = new Map(orders.map((o) => [String(o.Id), o]));
  return rows
    .filter((r) => !r.rejected)
    .map((r) => toLead(r, byId.get(String(r.order_id)) || null))
    .sort((a, b) => new Date(b.UpdatedAt || b.CreatedAt || 0) - new Date(a.UpdatedAt || a.CreatedAt || 0));
}

export async function getLead(rowId) {
  const res = await fetch(`${BASE}/api/v2/tables/${T.orderProps}/records/${rowId}`, {
    headers: H, cache: 'no-store',
  });
  if (!res.ok) return null;
  const row = await res.json();
  if (!row?.Id || row.rejected) return null;
  let order = null;
  if (row.order_id != null) {
    const ores = await fetch(`${BASE}/api/v2/tables/${T.orders}/records/${row.order_id}`, {
      headers: H, cache: 'no-store',
    });
    if (ores.ok) {
      const o = await ores.json();
      if (o?.Id) order = o;
    }
  }
  return toLead(row, order);
}

// Sirf ye fields bahar se badal sakte hain — scoring/margin columns Find
// route ke hain, unhe PATCH se chhoona lost-update ka rasta hai.
const PATCHABLE = new Set([
  'lead_status', 'outreach_status', 'next_action', 'next_action_date', 'loss_reason',
]);

/**
 * Lead update. shortlist_status ko lead_status ke sath SYNC rakhte hain —
 * /orders wala purana shortlist lens aur /leads wala pipeline lens ek hi
 * sach dikhayen. Rule: pipeline me 'shortlisted' se aage sab shortlist hi
 * maane jate hain (contact tak wahi pahunchte hain); peeche girne pe
 * (matched/new) shortlist hat jati hai.
 */
export async function updateLead(rowId, patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PATCHABLE.has(k)) clean[k] = v === '' ? null : v;
  }
  if (!Object.keys(clean).length) throw new Error('Nothing to update.');

  if (clean.lead_status) {
    const idx = LEAD_STATUSES.findIndex((s) => s.key === clean.lead_status);
    if (idx === -1) throw new Error(`Unknown status: ${clean.lead_status}`);
    const shortIdx = LEAD_STATUSES.findIndex((s) => s.key === 'shortlisted');
    clean.shortlist_status = idx >= shortIdx && clean.lead_status !== 'lost' ? 'shortlisted' : null;
    if (clean.lead_status !== 'lost') clean.loss_reason = clean.loss_reason ?? null;
  }
  if (clean.outreach_status && !OUTREACH_STATUSES.some((s) => s.key === clean.outreach_status)) {
    throw new Error(`Unknown outreach status: ${clean.outreach_status}`);
  }

  const res = await fetch(`${BASE}/api/v2/tables/${T.orderProps}/records`, {
    method: 'PATCH', headers: H, body: JSON.stringify([{ Id: Number(rowId), ...clean }]),
  });
  if (!res.ok) throw new Error(`Lead update failed (${res.status})`);
  return getLead(rowId);
}

/**
 * Funnel counts — order detail + dashboard ke liye. Ek pass me sab.
 * `tracked` me rejected bhi shamil (kitni properties dekhi ja chukin),
 * baqi sab sirf zinda leads pe.
 */
export function leadFunnel(leads, { rejectedCount = 0 } = {}) {
  const f = {
    tracked: leads.length + rejectedCount,
    eligible: 0,
    strong: 0, // match >= 80 — "strong match" ki hadd
    shortlisted: 0,
    contacted: 0,
    awaiting: 0,
    interested: 0,
    viewings: 0,
    deals: 0,
    won: 0,
    lost: 0,
    needsContact: 0,
    followupsDue: 0,
    expectedMargin: 0, // shortlist ke aage wale active leads ka net/mo total
  };
  const order = LEAD_STATUSES.map((s) => s.key);
  const at = (lead, key) => order.indexOf(lead.status) >= order.indexOf(key);
  const today = new Date().toISOString().slice(0, 10);
  for (const l of leads) {
    if (!l.over_budget) f.eligible++;
    if ((l.match_score ?? 0) >= 80) f.strong++;
    if (l.status !== 'lost') {
      if (at(l, 'shortlisted')) f.shortlisted++;
      if (at(l, 'contacted')) f.contacted++;
      // Awaiting = pipeline stage YA outreach ki halat (jab tak interested
      // na ho jaye) — dono ka matlab ek hi hai: landlord ke jawab ka intezaar.
      if (l.status === 'awaiting_response' || (l.outreach_status === 'awaiting_response' && !at(l, 'interested'))) f.awaiting++;
      if (at(l, 'interested')) f.interested++;
      if (at(l, 'viewing')) f.viewings++;
      if (at(l, 'deal')) f.deals++;
    }
    if (l.status === 'won') f.won++;
    if (l.status === 'lost') f.lost++;
    if (l.status === 'shortlisted' || l.status === 'ready_to_contact') {
      if (l.outreach_status === 'not_contacted') f.needsContact++;
    }
    if (isActiveLead(l) && l.next_action_date && l.next_action_date <= today) f.followupsDue++;
    if (isActiveLead(l) && at(l, 'shortlisted') && l.net_monthly_margin != null) {
      f.expectedMargin += Number(l.net_monthly_margin) || 0;
    }
  }
  return f;
}
