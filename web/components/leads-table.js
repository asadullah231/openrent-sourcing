'use client';

// Sourcing table — search / status / order / needs-action filters + column
// sorting. Row click → /sourcing/[id]. Data server se aata hai (page.js), yahan
// sirf dikhane ki chhanai hoti hai — koi fetch nahi, koi apni copy nahi.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEAD_STATUSES } from '@/lib/leads';
import { LeadStatusBadge, OutreachBadge, money, leadPropertyLine } from '@/components/crm-bits';

const SORTS = {
  updated: (a, b) => new Date(b.UpdatedAt || b.CreatedAt || 0) - new Date(a.UpdatedAt || a.CreatedAt || 0),
  match: (a, b) => (b.match_score ?? -1) - (a.match_score ?? -1),
  margin: (a, b) => (b.net_monthly_margin ?? -9e9) - (a.net_monthly_margin ?? -9e9),
  rent: (a, b) => (a.listing?.price ?? 9e9) - (b.listing?.price ?? 9e9),
};

export function LeadsTable({ leads }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [orderId, setOrderId] = useState('');
  const [needsAction, setNeedsAction] = useState(false);
  const [showOverBudget, setShowOverBudget] = useState(false);
  const [sort, setSort] = useState('updated');

  // Order filter ki choices — leads me jo orders hain unse hi banti hain
  const orders = useMemo(() => {
    const m = new Map();
    for (const l of leads) {
      if (l.order) m.set(String(l.order.Id), l.order.order_number || `ORD-${String(l.order.Id).padStart(4, '0')}`);
    }
    return [...m.entries()];
  }, [leads]);

  const today = new Date().toISOString().slice(0, 10);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads
      .filter((l) => {
        // Over-budget rows negotiation research hain, pipeline kaam nahi —
        // default me chhupi rehti hain. Jis pe kaam shuru ho chuka (status
        // matched se aage) wo lead ban chuki hai, wo hamesha dikhti hai.
        if (!showOverBudget && l.over_budget && (l.status === 'new' || l.status === 'matched')) return false;
        if (status && l.status !== status) return false;
        if (orderId && String(l.order_id) !== orderId) return false;
        if (needsAction) {
          const due = l.next_action_date && l.next_action_date <= today;
          const uncontacted =
            (l.status === 'shortlisted' || l.status === 'ready_to_contact') &&
            l.outreach_status === 'not_contacted';
          if (!due && !uncontacted) return false;
          if (l.status === 'won' || l.status === 'lost') return false;
        }
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
  }, [leads, q, status, orderId, needsAction, showOverBudget, sort, today]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field"
          style={{ maxWidth: 260 }}
          placeholder="Search properties, areas, landlords…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select className="field" style={{ maxWidth: 160 }} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">All orders</option>
          {orders.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <button
          className="seg"
          style={needsAction ? { color: 'var(--paper)', borderColor: 'var(--accent)' } : undefined}
          onClick={() => setNeedsAction((v) => !v)}
        >
          Needs action today
        </button>
        <button
          className="seg"
          style={showOverBudget ? { color: 'var(--paper)', borderColor: 'var(--rust)' } : undefined}
          onClick={() => setShowOverBudget((v) => !v)}
          title="Over-budget properties are negotiation research — hidden from the working list by default."
        >
          Include over budget
        </button>
        <span className="text-muted" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          {shown.length} of {leads.length}
        </span>
      </div>

      {/* ── Table ── */}
      {shown.length === 0 ? (
        <div className="text-muted" style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '36px 24px', textAlign: 'center', fontSize: 13 }}>
          No properties match these filters.
        </div>
      ) : (
        <div className="crm-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Property</th>
                <th>Order</th>
                <th>Landlord</th>
                <TH id="rent" align="right">Rent</TH>
                <TH id="match" align="right">Match</TH>
                <TH id="margin" align="right">Net margin</TH>
                <th>Outreach</th>
                <th>Status</th>
                <th>Next action</th>
                <TH id="updated">Updated</TH>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.Id} onClick={() => router.push(`/sourcing/${l.Id}`)}>
                  <td className="font-mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{l.ref}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {leadPropertyLine(l)}
                    {l.over_budget && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rust)' }}>
                        Over budget
                      </span>
                    )}
                  </td>
                  <td className="font-mono" style={{ fontSize: 12 }}>
                    {l.order?.order_number || (l.order_id != null ? `ORD-${String(l.order_id).padStart(4, '0')}` : '—')}
                  </td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.listing?.landlord_name || '—'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{money(l.listing?.price)}</td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {l.match_score != null ? `${l.match_score}%` : '—'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right', color: l.net_monthly_margin != null ? (l.net_monthly_margin >= 0 ? 'var(--green)' : 'var(--rust)') : undefined }}>
                    {l.net_monthly_margin != null ? `${money(l.net_monthly_margin)}/mo` : '—'}
                  </td>
                  <td><OutreachBadge status={l.outreach_status} size={10.5} /></td>
                  <td><LeadStatusBadge status={l.status} size={10.5} /></td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.next_action || '—'}
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
    </div>
  );
}
