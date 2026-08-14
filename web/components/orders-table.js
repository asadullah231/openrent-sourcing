'use client';

// Orders table — redesign directive: orders primarily table/list, compact
// rows, search/filter/sort, row click → detail. Counts server se aate hain
// (page.js leads se ginta hai) — yahan sirf display chhanai.
//
// Location grouping (Mo, 13 Aug): "kaafi sari searches ho jati hain to pata
// nahi lagta konsi kis liye hai" — jab orders bahut ho jate hain to flat
// list me area confusion karti hai. Fix data me nahi, sirf presentation me:
// orders ab area ke hisaab se sections me hain (collapsible), Area column
// hat gaya (section header hi wo hai). Ek quick area-jump dropdown bhi.
// Scraper/matching/data — kuch nahi chhua, sirf ye component.

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_COLOR = {
  active: 'var(--green)',
  paused: 'var(--brass)',
  fulfilled: 'var(--accent)',
  closed: 'var(--mist)',
};

const SORTS = {
  updated: (a, b) => new Date(b.UpdatedAt || b.CreatedAt || 0) - new Date(a.UpdatedAt || a.CreatedAt || 0),
  budget: (a, b) => (b.max_rent ?? 0) - (a.max_rent ?? 0),
  matches: (a, b) => (b._c.matches ?? 0) - (a._c.matches ?? 0),
  shortlisted: (a, b) => (b._c.shortlisted ?? 0) - (a._c.shortlisted ?? 0),
};

// "Bexley, Greater London" → "Bexley" (paste-link orders me poora term aata
// hai) — group ka naam short aur scanable rahe.
function areaLabel(order) {
  const raw = String(order.area || '').split(',')[0].trim();
  return raw || 'No area set';
}

export function OrdersTable({ orders }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [sort, setSort] = useState('updated');
  const [collapsed, setCollapsed] = useState(() => new Set());

  const areas = useMemo(() => {
    const m = new Map();
    for (const o of orders) {
      const label = areaLabel(o);
      m.set(label.toLowerCase(), label);
    }
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders
      .filter((o) => {
        if (status && (o.status || 'active') !== status) return false;
        if (area && areaLabel(o) !== area) return false;
        if (needle) {
          const hay = [o.order_number, o.council_client, o.area, o.postcodes, o.notes]
            .filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort(SORTS[sort] || SORTS.updated);
  }, [orders, q, status, area, sort]);

  // Filtered list ko area ke groups me baanto, group naam se alphabetically —
  // operator ko scan karna aasan, jaise location ka apna chhota page ho.
  const groups = useMemo(() => {
    const m = new Map();
    for (const o of shown) {
      const label = areaLabel(o);
      const key = label.toLowerCase();
      if (!m.has(key)) m.set(key, { label, orders: [] });
      m.get(key).orders.push(o);
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [shown]);

  const toggle = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

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

  const COLS = 8; // Order, Client, Requirements, Budget, Matches, Shortlisted, Outreach, Status

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field"
          style={{ maxWidth: 240 }}
          placeholder="Search orders, clients, areas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field" style={{ maxWidth: 170 }} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">All locations</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select className="field" style={{ maxWidth: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="closed">Closed</option>
        </select>
        <span className="text-muted" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
          {shown.length} of {orders.length} · {groups.length} location{groups.length === 1 ? '' : 's'}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="text-muted" style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '36px 24px', textAlign: 'center', fontSize: 13 }}>
          No orders match these filters.
        </div>
      ) : (
        <div className="crm-wrap">
          <table className="crm-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Client</th>
                <th>Requirements</th>
                <TH id="budget" align="right">Budget</TH>
                <TH id="matches" align="right">Matches</TH>
                <TH id="shortlisted" align="right">Shortlisted</TH>
                <th style={{ textAlign: 'right' }}>Outreach</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const key = g.label.toLowerCase();
                const isCollapsed = collapsed.has(key);
                const totalMatches = g.orders.reduce((s, o) => s + (o._c.matches || 0), 0);
                const totalShortlisted = g.orders.reduce((s, o) => s + (o._c.shortlisted || 0), 0);
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => toggle(key)}
                      style={{ cursor: 'pointer', background: 'var(--surface-2)' }}
                    >
                      <td colSpan={COLS} style={{ padding: '9px 12px', fontWeight: 600, fontSize: 12.5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span className="text-muted" style={{ fontSize: 10, width: 10, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.12s ease' }}>
                            ▾
                          </span>
                          {g.label}
                          <span className="text-muted" style={{ fontWeight: 400 }}>
                            {g.orders.length} order{g.orders.length === 1 ? '' : 's'}
                            {totalMatches > 0 && ` · ${totalMatches} matched`}
                            {totalShortlisted > 0 && ` · ${totalShortlisted} shortlisted`}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {!isCollapsed && g.orders.map((o) => {
                      const c = o._c;
                      return (
                        <tr key={o.Id} onClick={() => router.push(`/orders/${o.Id}`)}>
                          <td className="font-mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                            {o.order_number || `ORD-${String(o.Id).padStart(4, '0')}`}
                            {o.priority && o.priority !== 'normal' && (
                              <span style={{ marginLeft: 7, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--rust)' }}>
                                {o.priority}
                              </span>
                            )}
                          </td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.council_client || '-'}</td>
                          <td className="text-muted" style={{ fontSize: 12.5 }}>
                            {[
                              o.bedrooms != null && `${o.bedrooms}${o.bedrooms_max ? `–${o.bedrooms_max}` : '+'} bed`,
                              o.property_type && o.property_type !== 'any' && o.property_type,
                              o.furnished && o.furnished !== 'any' && o.furnished,
                            ].filter(Boolean).join(' · ') || 'Any'}
                          </td>
                          <td className="font-mono" style={{ textAlign: 'right' }}>
                            {o.max_rent != null ? `£${Number(o.max_rent).toLocaleString('en-GB')}` : '-'}
                          </td>
                          <td className="font-mono" style={{ textAlign: 'right' }}>{c.matches}</td>
                          <td className="font-mono" style={{ textAlign: 'right', color: c.shortlisted ? 'var(--brass)' : undefined }}>{c.shortlisted}</td>
                          <td className="font-mono" style={{ textAlign: 'right', color: c.contacted ? 'var(--accent)' : undefined }}>{c.contacted}</td>
                          <td>
                            <span className="badge" style={{ '--badge-c': STATUS_COLOR[o.status || 'active'] || 'var(--mist)' }}>
                              <span className="badge-dot" />
                              {(o.status || 'active').replace(/^./, (ch) => ch.toUpperCase())}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

