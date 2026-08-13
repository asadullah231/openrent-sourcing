// CRM dashboard — subah kaam yahan se shuru hota hai. Ek hi sawal ka jawab:
// AAJ SOURCING ME KYA KARNA HAI? Upar funnel ke numbers, phir priority
// actions (kaam jo ruka hua hai), phir taza activity.

import Link from 'next/link';
import { getOrders } from '@/lib/orders';
import { getLeads, leadFunnel, isActiveLead } from '@/lib/leads';
import { getActivities } from '@/lib/activities';
import { ActivityTimeline } from '@/components/activity-timeline';

export const dynamic = 'force-dynamic';

// Ek bordered strip me sab numbers (dividers ke sath) — alag stat cards
// DESIGN.md ke khilaf hain ("colorful statistic cards" avoid). Rang sirf
// tab jab number pe dhyan chahiye (kaam ruka hua hai).
function Metric({ label, value, color, href }) {
  const inner = (
    <>
      <div className="metric-value" style={color ? { color } : undefined}>{value}</div>
      <div className="metric-label">{label}</div>
    </>
  );
  return href
    ? <Link href={href} className="metric">{inner}</Link>
    : <div className="metric">{inner}</div>;
}

export default async function DashboardPage() {
  let orders = [];
  let leads = [];
  let activities = [];
  let loadError = null;
  try {
    [orders, leads, activities] = await Promise.all([
      getOrders(),
      getLeads(),
      getActivities({ limit: 10 }),
    ]);
  } catch (e) {
    loadError = e.message;
  }

  if (loadError) {
    return (
      <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
        Could not load the dashboard: {loadError}
      </div>
    );
  }

  const activeOrders = orders.filter((o) => (o.status || 'active') === 'active');
  const f = leadFunnel(leads);
  const weekAgo = Date.now() - 7 * 86400000;
  const newLeads = leads.filter((l) => new Date(l.CreatedAt || 0) > weekAgo).length;

  // Orders jinke paas koi strong match nahi — search dobara chalani chahiye
  const strongByOrder = new Set(
    leads.filter((l) => (l.match_score ?? 0) >= 80 && isActiveLead(l)).map((l) => String(l.order_id))
  );
  const ordersNoStrong = activeOrders.filter((o) => !strongByOrder.has(String(o.Id)));

  const priorities = [
    f.needsContact > 0 && {
      text: `${f.needsContact} propert${f.needsContact === 1 ? 'y needs' : 'ies need'} contact on OpenRent`,
      href: '/outreach?tab=ready', color: 'var(--brass)',
    },
    f.followupsDue > 0 && {
      text: `${f.followupsDue} follow-up${f.followupsDue === 1 ? '' : 's'} due today`,
      href: '/outreach?tab=followups', color: 'var(--rust)',
    },
    f.awaiting > 0 && {
      text: `${f.awaiting} propert${f.awaiting === 1 ? 'y' : 'ies'} awaiting a landlord response`,
      href: '/outreach?tab=awaiting', color: 'var(--accent)',
    },
    ordersNoStrong.length > 0 && {
      text: `${ordersNoStrong.length} active order${ordersNoStrong.length === 1 ? '' : 's'} with no strong match yet — run the search again`,
      href: '/orders', color: 'var(--mist)',
    },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
        <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          The sourcing pipeline at a glance — orders, properties and what needs doing next.
        </p>
      </div>

      {/* ── Funnel metrics — ek strip, workflow ki tarteeb me ── */}
      <div className="metric-strip">
        <Metric label="Active orders" value={activeOrders.length} href="/orders" />
        <Metric label="New (7d)" value={newLeads} href="/sourcing" />
        <Metric label="Strong matches" value={f.strong} href="/sourcing" />
        <Metric label="Shortlisted" value={f.shortlisted} href="/sourcing" />
        <Metric label="Needs contact" value={f.needsContact} color={f.needsContact ? 'var(--brass)' : undefined} href="/outreach?tab=ready" />
        <Metric label="Awaiting" value={f.awaiting} href="/outreach?tab=awaiting" />
        <Metric label="Viewings" value={f.viewings} href="/sourcing" />
        <Metric label="Deals" value={f.deals} href="/sourcing" />
        <Metric
          label="Expected margin"
          value={`£${Math.round(f.expectedMargin).toLocaleString('en-GB')}/mo`}
          color={f.expectedMargin > 0 ? 'var(--green)' : undefined}
        />
      </div>

      {/* ── Priority actions ── */}
      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Priority actions</h2>
        {priorities.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Nothing urgent — everything is moving and no follow-ups are overdue.
          </p>
        ) : (
          <div className="action-list">
            {priorities.map((p, i) => (
              <Link key={i} href={p.href} className="action-row">
                <span style={{ width: 7, height: 7, borderRadius: 999, background: p.color, flexShrink: 0 }} />
                {p.text}
                <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>→</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent activity ── */}
      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Recent activity</h2>
        <ActivityTimeline activities={activities} emptyText="No activity yet — it starts once orders find properties and they move through the funnel." />
      </div>
    </div>
  );
}
