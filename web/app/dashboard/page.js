// CRM dashboard — subah kaam yahan se shuru hota hai. Ek hi sawal ka jawab:
// AAJ SOURCING ME KYA KARNA HAI? Upar funnel ke numbers, phir priority
// actions (kaam jo ruka hua hai), phir taza activity.

import Link from 'next/link';
import { getOrders } from '@/lib/orders';
import { getLeads, leadFunnel, isActiveLead } from '@/lib/leads';
import { getActivities } from '@/lib/activities';
import { ActivityTimeline } from '@/components/activity-timeline';

export const dynamic = 'force-dynamic';

function Stat({ label, value, color, href }) {
  const inner = (
    <div
      className={href ? 'row-hover' : undefined}
      style={{
        background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)',
        padding: '14px 16px', height: '100%',
      }}
    >
      <div className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--paper)' }}>{value}</div>
      <div className="text-muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
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

      {/* ── Funnel stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        <Stat label="Active orders" value={activeOrders.length} href="/orders" />
        <Stat label="New properties (7d)" value={newLeads} href="/sourcing" />
        <Stat label="Strong matches" value={f.strong} href="/sourcing" />
        <Stat label="Shortlisted" value={f.shortlisted} color="var(--brass)" href="/sourcing" />
        <Stat label="Needs contact" value={f.needsContact} color={f.needsContact ? 'var(--brass)' : undefined} href="/outreach?tab=ready" />
        <Stat label="Awaiting response" value={f.awaiting} color={f.awaiting ? 'var(--accent)' : undefined} href="/outreach?tab=awaiting" />
        <Stat label="Viewings" value={f.viewings} color={f.viewings ? 'var(--green)' : undefined} href="/sourcing" />
        <Stat label="Active deals" value={f.deals} color={f.deals ? 'var(--green)' : undefined} href="/sourcing" />
        <Stat
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {priorities.map((p, i) => (
              <Link
                key={i}
                href={p.href}
                className="row-hover"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface)', border: '1px solid var(--mist-line)',
                  borderRadius: 'var(--r-ctrl)', padding: '11px 14px',
                  textDecoration: 'none', color: 'var(--paper)', fontSize: 13.5, fontWeight: 500,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: p.color, flexShrink: 0 }} />
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
