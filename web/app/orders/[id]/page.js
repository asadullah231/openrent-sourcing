// Order detail — Phase 1 ka SAB SE AHAM page (PRD). Upar order ke haqaiq,
// neeche Find Properties + Eligible / Over Budget / Shortlisted groups.
//
// Server component: order + saved matches NocoDB se. Find/shortlist actions
// client component (OrderMatches) me hain jo router.refresh() se yehi data
// dobara mangwata hai — do sources of truth nahi bante.

import Link from 'next/link';
import { getOrder, getOrderMatches } from '@/lib/orders';
import { toLead, leadFunnel } from '@/lib/leads';
import { OrderMatches } from '@/components/order-matches';

export const dynamic = 'force-dynamic';

const STATUS_COLOR = {
  active: 'var(--green)',
  paused: 'var(--brass)',
  fulfilled: 'var(--accent)',
  closed: 'var(--mist)',
};

function Fact({ label, children, strong = false }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div className={strong ? 'font-mono' : ''} style={{ fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 500, marginTop: 3 }}>
        {children ?? '—'}
      </div>
    </div>
  );
}

export default async function OrderDetailPage({ params }) {
  const { id } = await params;

  let order = null;
  let matches = [];
  let loadError = null;
  try {
    order = await getOrder(id);
    if (order) matches = await getOrderMatches(order.Id);
  } catch (e) {
    loadError = e.message;
  }

  if (loadError) {
    return (
      <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
        Could not load the order: {loadError}
      </div>
    );
  }
  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Order not found</p>
        <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>It may have been deleted.</p>
        <Link href="/orders" className="btn-brass" style={{ textDecoration: 'none' }}>Back to orders</Link>
      </div>
    );
  }

  // match_reasons/rejection_reasons NocoDB me JSON strings hain — yahin khol do
  const clean = matches.map((m) => ({
    ...m,
    reasons: safeParse(m.match_reasons) || [],
    rejections: safeParse(m.rejection_reasons) || [],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <Link href="/orders" className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>
          ← Orders
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 className="font-mono" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {order.order_number || `ORD-${String(order.Id).padStart(4, '0')}`}
          </h1>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[order.status] || 'var(--mist)' }}>
            {order.status || 'active'}
          </span>
          {order.priority && order.priority !== 'normal' && (
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rust)' }}>
              {order.priority}
            </span>
          )}
          {order.deadline && (
            <span className="text-muted" style={{ fontSize: 12.5 }}>Deadline {order.deadline}</span>
          )}
        </div>
        {order.council_client && (
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>{order.council_client}</p>
        )}
      </div>

      {/* ── Order facts ── */}
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)',
          padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16,
        }}
      >
        <Fact label="Area">{[order.area, order.postcodes].filter(Boolean).join(' · ')}</Fact>
        <Fact label="Bedrooms">
          {order.bedrooms != null ? `${order.bedrooms}${order.bedrooms_max ? `–${order.bedrooms_max}` : '+'}` : 'Any'}
        </Fact>
        <Fact label="Type">{order.property_type && order.property_type !== 'any' ? order.property_type : 'Any'}</Fact>
        <Fact label="Max rent" strong>£{Number(order.max_rent ?? 0).toLocaleString('en-GB')}</Fact>
        <Fact label="Order rate" strong>
          {order.order_rate != null ? `£${Number(order.order_rate).toLocaleString('en-GB')}` : '—'}
        </Fact>
        <Fact label="Availability">{order.availability || 'ASAP'}</Fact>
        <Fact label="Furnished">{order.furnished || 'Any'}</Fact>
      </div>

      {/* ── Sourcing funnel (CRM) — order operational dashboard hai:
             kitni mili → kitni strong → kis se baat hui → kahan tak pahunchi ── */}
      {matches.length > 0 && (() => {
        const f = leadFunnel(matches.map((m) => toLead(m, order)));
        const cells = [
          ['Eligible', f.eligible],
          ['Strong matches', f.strong],
          ['Shortlisted', f.shortlisted],
          ['Contacted', f.contacted],
          ['Awaiting response', f.awaiting],
          ['Interested', f.interested],
          ['Viewings', f.viewings],
          ['Deals', f.deals],
        ];
        return (
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)',
              padding: '14px 20px', display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center',
            }}
          >
            {cells.map(([label, v]) => (
              <div key={label}>
                <div className="font-mono" style={{ fontSize: 17, fontWeight: 700, color: v > 0 ? 'var(--paper)' : 'var(--mist)' }}>{v}</div>
                <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
            <Link href="/leads" className="seg" style={{ marginLeft: 'auto', textDecoration: 'none', fontSize: 12 }}>
              View as leads
            </Link>
          </div>
        );
      })()}

      {(order.special_requirements || order.notes) && (
        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          {order.special_requirements && (
            <div><b style={{ color: 'var(--paper)' }}>Special requirements:</b> {order.special_requirements}</div>
          )}
          {order.notes && (
            <div><b style={{ color: 'var(--paper)' }}>Notes:</b> {order.notes}</div>
          )}
        </div>
      )}

      <OrderMatches order={order} matches={clean} canProfit={order.order_rate != null} />
    </div>
  );
}

function safeParse(v) {
  if (!v || typeof v !== 'string') return null;
  try { return JSON.parse(v); } catch { return null; }
}
