'use client';

// Sourcing workspace — redesign directive:
//  - tabs (To Review → … → Interested) jo pipeline ki tarteeb me hain
//  - dense table
//  - row click => contextual DRAWER (Twenty ka side-panel pattern) — poora
//    page chhore baghair property ka jaiza; full record ek click aur.
// Data server se aata hai (page.js); yahan sirf dikhane ki chhanai — koi
// fetch nahi, koi apni copy nahi.

import { useEffect, useMemo, useState } from 'react';
import { LeadStatusBadge, OutreachBadge, money, leadPropertyLine, deentity, sourceLabel, SourceListingLine } from '@/components/crm-bits';

// Tabs = pipeline lens. "To Review" me new+matched dono — user ke liye ye ek
// hi kaam hai (naya maal jaanchna); alag Matched tab sirf confusion hota.
const TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'review', label: 'To Review', match: (l) => l.status === 'new' || l.status === 'matched' },
  { key: 'shortlisted', label: 'Shortlisted', match: (l) => l.status === 'shortlisted' },
  { key: 'ready', label: 'Ready to Contact', match: (l) => l.status === 'ready_to_contact' || ((l.status === 'shortlisted') && l.outreach_status === 'not_contacted') },
  { key: 'contacted', label: 'Contacted', match: (l) => l.status === 'contacted' },
  { key: 'awaiting', label: 'Awaiting Response', match: (l) => l.status === 'awaiting_response' || l.outreach_status === 'awaiting_response' },
  { key: 'interested', label: 'Interested', match: (l) => l.status === 'interested' || l.outreach_status === 'interested' },
];

const SORTS = {
  updated: (a, b) => new Date(b.UpdatedAt || b.CreatedAt || 0) - new Date(a.UpdatedAt || a.CreatedAt || 0),
  match: (a, b) => (b.match_score ?? -1) - (a.match_score ?? -1),
  margin: (a, b) => (b.net_monthly_margin ?? -9e9) - (a.net_monthly_margin ?? -9e9),
  rent: (a, b) => (a.listing?.price ?? 9e9) - (b.listing?.price ?? 9e9),
};

export function LeadsTable({ leads, initialTab }) {
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : 'all');
  const [q, setQ] = useState('');
  const [orderId, setOrderId] = useState('');
  const [showOverBudget, setShowOverBudget] = useState(false);
  const [sort, setSort] = useState('updated');
  const [open, setOpen] = useState(null); // drawer me khula lead

  // Esc se drawer band — keyboard-friendly (DESIGN.md)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const orders = useMemo(() => {
    const m = new Map();
    for (const l of leads) {
      if (l.order) m.set(String(l.order.Id), l.order.order_number || `ORD-${String(l.order.Id).padStart(4, '0')}`);
    }
    return [...m.entries()];
  }, [leads]);

  // Over-budget default band (negotiation research hai, pipeline kaam nahi) —
  // magar jis pe kaam shuru ho chuka wo hamesha dikhta hai.
  const base = useMemo(
    () => leads.filter((l) => showOverBudget || !l.over_budget || (l.status !== 'new' && l.status !== 'matched')),
    [leads, showOverBudget]
  );

  const counts = useMemo(() => {
    const c = {};
    for (const t of TABS) c[t.key] = base.filter(t.match).length;
    return c;
  }, [base]);

  const today = new Date().toISOString().slice(0, 10);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    return base
      .filter((l) => {
        if (!t.match(l)) return false;
        if (orderId && String(l.order_id) !== orderId) return false;
        if (needle) {
          const hay = [
            l.ref, l.listing?.address, l.listing?.area, l.listing?.title,
            l.listing?.landlord_name, l.order?.order_number, l.order?.council_client,
            l.next_action,
          ].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(SORTS[sort] || SORTS.updated);
  }, [base, tab, q, orderId, sort]);

  const TH = ({ id, children, align }) => (
    <th
      className={id ? 'sortable' : undefined}
      style={{ textAlign: align || 'left', color: sort === id ? 'var(--paper)' : undefined }}
      onClick={id ? () => setSort(id) : undefined}
      title={id ? 'Sort by this column' : undefined}
    >
      {children}{sort === id ? ' ↓' : ''}
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Tabs ── */}
      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>
            {t.label}<span className="count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field"
          style={{ maxWidth: 260 }}
          placeholder="Search properties, areas, landlords…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field" style={{ maxWidth: 160 }} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">All orders</option>
          {orders.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <button
          className="seg"
          style={showOverBudget ? { color: 'var(--paper)', borderColor: 'var(--rust)' } : undefined}
          onClick={() => setShowOverBudget((v) => !v)}
          title="Over-budget properties are negotiation research, hidden from the working list by default."
        >
          Include over budget
        </button>
        <span className="text-muted" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          {shown.length} of {base.length}
        </span>
      </div>

      {/* ── Table ── */}
      {shown.length === 0 ? (
        <div className="text-muted" style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '36px 24px', textAlign: 'center', fontSize: 13 }}>
          Nothing in this view.
        </div>
      ) : (
        <div className="crm-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Order</th>
                <TH id="match" align="right">Match</TH>
                <TH id="rent" align="right">Rent</TH>
                <TH id="margin" align="right">Margin</TH>
                <th>Status</th>
                <th>Outreach</th>
                <th>Next action</th>
                <TH id="updated">Updated</TH>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.Id} onClick={() => setOpen(l)}>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                    {leadPropertyLine(l)}
                    {l.over_budget && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rust)' }}>
                        Over budget
                      </span>
                    )}
                  </td>
                  <td className="font-mono" style={{ fontSize: 12 }}>
                    {l.order?.order_number || (l.order_id != null ? `ORD-${String(l.order_id).padStart(4, '0')}` : '-')}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {l.match_score != null ? `${l.match_score}%` : '-'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{money(l.listing?.price)}</td>
                  <td className="font-mono" style={{ textAlign: 'right', color: l.net_monthly_margin != null ? (l.net_monthly_margin >= 0 ? 'var(--green)' : 'var(--rust)') : undefined }}>
                    {l.net_monthly_margin != null ? `${money(l.net_monthly_margin)}/mo` : '-'}
                  </td>
                  <td><LeadStatusBadge status={l.status} /></td>
                  <td><OutreachBadge status={l.outreach_status} /></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.next_action || '-'}
                    {l.next_action_date && (
                      <span className="text-muted" style={{ marginLeft: 6, fontSize: 11.5 }}>
                        {l.next_action_date <= today ? <b style={{ color: 'var(--rust)' }}>{l.next_action_date}</b> : l.next_action_date}
                      </span>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {new Date(l.UpdatedAt || l.CreatedAt || 0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Contextual drawer ── */}
      {open && <LeadDrawer lead={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Drawer = fauri jaiza: kya hai, kitne ka hai, kis order ke liye, kya halat,
// agla qadam. Poori kahani (timeline, actions) full record pe.
function LeadDrawer({ lead, onClose }) {
  const l = lead.listing || {};
  const o = lead.order;
  const orderLabel = o?.order_number || (lead.order_id != null ? `ORD-${String(lead.order_id).padStart(4, '0')}` : '-');
  const today = new Date().toISOString().slice(0, 10);

  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '7px 0', borderBottom: '1px solid var(--mist-line)' }}>
      <span className="text-muted" style={{ flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: 'right', minWidth: 0 }}>{children ?? '-'}</span>
    </div>
  );

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Property record">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{lead.ref}</span>
          <LeadStatusBadge status={lead.status} />
          <button className="seg" onClick={onClose} style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }} aria-label="Close">
            ✕
          </button>
        </div>

        {l.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 8, background: 'var(--skeleton)', display: 'block', marginBottom: 12 }} />
        )}

        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{leadPropertyLine(lead)}</div>
        {(l.title || l.address) && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
            {deentity(l.address || l.title)}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '10px 0 4px', flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: 16, fontWeight: 700 }}>{money(l.price)} pcm</span>
          {lead.match_score != null && (
            <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>{lead.match_score}% match</span>
          )}
          {lead.net_monthly_margin != null && (
            <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: lead.net_monthly_margin >= 0 ? 'var(--green)' : 'var(--rust)' }}>
              {money(lead.net_monthly_margin)}/mo{lead.costs_estimated ? ' before costs' : ''}
            </span>
          )}
        </div>

        <div style={{ margin: '10px 0 14px' }}>
          <Row label="Order">
            <a href={o ? `/orders/${o.Id}` : '#'} className="font-mono" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {orderLabel}
            </a>
            {o?.council_client ? <span className="text-muted"> · {o.council_client}</span> : null}
          </Row>
          <Row label="Order budget">{o?.max_rent != null ? money(o.max_rent) : '-'}</Row>
          <Row label="Landlord">{l.landlord_name || 'Not known yet'}</Row>
          <Row label="Outreach"><OutreachBadge status={lead.outreach_status} /></Row>
          <Row label="Attempts">{lead.contact_attempts || 0}</Row>
          <Row label="Last contacted">
            {lead.last_contacted_at
              ? new Date(lead.last_contacted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              : 'Not yet'}
          </Row>
          <Row label="Next action">
            {lead.next_action || '-'}
            {lead.next_action_date && (
              <span className="text-muted"> · {lead.next_action_date}{lead.next_action_date <= today && <b style={{ color: 'var(--rust)' }}> due</b>}</span>
            )}
          </Row>
          <Row label="Source">{sourceLabel(l.source)}</Row>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={`/sourcing/${lead.Id}`} className="btn-brass" style={{ textDecoration: 'none', fontSize: 12.5 }}>
            Open full record
          </a>
          {l.url && (
            <a href={l.url} target="_blank" rel="noreferrer" className="seg" style={{ textDecoration: 'none', fontSize: 12.5, display: 'inline-flex', alignItems: 'center' }}>
              View original listing ↗
            </a>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          <SourceListingLine listing={l} size={11.5} />
        </div>
      </div>
    </>
  );
}
