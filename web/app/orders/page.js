// Orders list — PRD: "The Order is the centre of the system".
// Har order = ek requirement jis pe sourcing chalti hai. Card pe wahi jo
// faislay ke liye chahiye: kaun sa council, kahan, kitne beds, budget,
// rate, aur ab tak kitne matches/shortlist.

import Link from 'next/link';
import { getOrders, getMatchCounts } from '@/lib/orders';

export const dynamic = 'force-dynamic';

const STATUS_COLOR = {
  active: 'var(--green)',
  paused: 'var(--brass)',
  fulfilled: 'var(--accent)',
  closed: 'var(--mist)',
};

export default async function OrdersPage() {
  let orders = [];
  let counts = {};
  let loadError = null;
  try {
    [orders, counts] = await Promise.all([getOrders(), getMatchCounts()]);
  } catch (e) {
    loadError = e.message;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Orders</h1>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Council and client requirements — each order drives its own property search.
          </p>
        </div>
        <Link href="/orders/new" className="btn-brass" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          New order
        </Link>
      </div>

      {loadError ? (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
          Could not load orders: {loadError}
        </div>
      ) : orders.length === 0 ? (
        <div style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>No orders yet</p>
          <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>
            Create the first order with its area, requirements and maximum budget — then find matching properties in one click.
          </p>
          <Link href="/orders/new" className="btn-brass" style={{ textDecoration: 'none' }}>
            Create an order
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {orders.map((o) => {
            const c = counts[String(o.Id)] || { eligible: 0, overBudget: 0, shortlisted: 0 };
            return (
              <Link
                key={o.Id}
                href={`/orders/${o.Id}`}
                className="row-hover"
                style={{
                  display: 'flex', flexDirection: 'column', gap: 10,
                  background: 'var(--surface)', border: '1px solid var(--mist-line)',
                  borderRadius: 'var(--r-card)', padding: 18,
                  textDecoration: 'none', color: 'var(--paper)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="font-mono" style={{ fontSize: 13, fontWeight: 700 }}>
                    {o.order_number || `ORD-${String(o.Id).padStart(4, '0')}`}
                  </span>
                  {o.priority && o.priority !== 'normal' && (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rust)' }}>
                      {o.priority}
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: STATUS_COLOR[o.status] || 'var(--mist)',
                    }}
                  >
                    {o.status || 'active'}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{o.council_client || 'No client set'}</div>
                  <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {[o.area, o.postcodes].filter(Boolean).join(' · ')}
                  </div>
                </div>

                <div className="text-muted" style={{ fontSize: 12.5 }}>
                  {[
                    o.bedrooms != null && `${o.bedrooms}${o.bedrooms_max ? `–${o.bedrooms_max}` : '+'} bed`,
                    o.property_type && o.property_type !== 'any' && o.property_type,
                    o.max_rent != null && `max £${Number(o.max_rent).toLocaleString('en-GB')}`,
                    o.order_rate != null && `rate £${Number(o.order_rate).toLocaleString('en-GB')}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>

                <div style={{ display: 'flex', gap: 14, fontSize: 12, borderTop: '1px solid var(--mist-line)', paddingTop: 10 }}>
                  <span><b className="font-mono">{c.eligible}</b> <span className="text-muted">eligible</span></span>
                  <span><b className="font-mono">{c.shortlisted}</b> <span className="text-muted">shortlisted</span></span>
                  <span><b className="font-mono">{c.overBudget}</b> <span className="text-muted">over budget</span></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
