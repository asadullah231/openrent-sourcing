// Orders list — PRD: "The Order is the centre of the system".
// Redesign directive: orders TABLE ke roop me (cards nahi) — compact rows,
// search/filter/sort, row click → detail. Counts leads se ek pass me.

import Link from 'next/link';
import { getOrders } from '@/lib/orders';
import { getLeads } from '@/lib/leads';
import { OrdersTable } from '@/components/orders-table';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  let orders = [];
  let leads = [];
  let loadError = null;
  try {
    [orders, leads] = await Promise.all([getOrders(), getLeads()]);
  } catch (e) {
    loadError = e.message;
  }

  // Har order ke operational numbers: matches (eligible), shortlisted,
  // contacted — table columns ke liye. Ek hi pass, koi extra fetch nahi.
  const counts = new Map();
  for (const l of leads) {
    const k = String(l.order_id);
    const c = counts.get(k) || { matches: 0, shortlisted: 0, contacted: 0 };
    if (!l.over_budget) c.matches++;
    if (l.shortlist_status === 'shortlisted') c.shortlisted++;
    if (l.outreach_status !== 'not_contacted' || l.last_contacted_at) c.contacted++;
    counts.set(k, c);
  }
  const withCounts = orders.map((o) => ({
    ...o,
    _c: counts.get(String(o.Id)) || { matches: 0, shortlisted: 0, contacted: 0 },
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0 }}>Orders</h1>
          <p className="text-muted" style={{ margin: '3px 0 0' }}>
            Council and client requirements. Each order drives its own property search.
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
            Create the first order with its area, requirements and maximum budget, then find matching properties in one click.
          </p>
          <Link href="/orders/new" className="btn-brass" style={{ textDecoration: 'none' }}>
            Create an order
          </Link>
        </div>
      ) : (
        <OrdersTable orders={withCounts} />
      )}
    </div>
  );
}
