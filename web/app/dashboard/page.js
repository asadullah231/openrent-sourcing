// Dashboard = AAJ KA KAAM (redesign directive: "Dashboard = TODAY'S WORK",
// random stat cards nahi). Upar Today strip (kya attention chahiye), neeche
// actionable work list — har row ek asli qadam hai jo /sourcing/[id] pe
// khulta hai. Screen ka sawal: "aaj mujhe kya karna hai?"

import Link from 'next/link';
import { getOrders } from '@/lib/orders';
import { getLeads, leadFunnel, outreachBuckets, isActiveLead } from '@/lib/leads';
import { getActivities } from '@/lib/activities';
import { ActivityTimeline } from '@/components/activity-timeline';
import { LeadStatusBadge, money, leadPropertyLine } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

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

// Ek work item = property line · rent · match · order · status · Open.
// Reason column batata hai ye row list me KYUN hai (follow-up due / reply / …).
function WorkRow({ lead, reason, reasonColor }) {
  const l = lead.listing || {};
  const orderLabel = lead.order?.order_number || (lead.order_id != null ? `ORD-${String(lead.order_id).padStart(4, '0')}` : '-');
  return (
    <div className="work-row">
      <span style={{ width: 7, height: 7, borderRadius: 999, background: reasonColor || 'var(--mist)', flexShrink: 0 }} />
      <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 200px' }}>
        {leadPropertyLine(lead)}
      </span>
      <span className="font-mono" style={{ flexShrink: 0, fontSize: 12.5 }}>{money(l.price)}</span>
      <span className="font-mono text-muted" style={{ flexShrink: 0, fontSize: 12, width: 42, textAlign: 'right' }}>
        {lead.match_score != null ? `${lead.match_score}%` : '-'}
      </span>
      <span className="font-mono text-muted" style={{ flexShrink: 0, fontSize: 12 }}>{orderLabel}</span>
      <span style={{ flexShrink: 0 }}><LeadStatusBadge status={lead.status} /></span>
      <span className="text-muted" style={{ flexShrink: 0, fontSize: 11.5, width: 118 }}>{reason}</span>
      <Link href={`/sourcing/${lead.Id}`} className="seg" style={{ flexShrink: 0, fontSize: 11.5, padding: '4px 10px', textDecoration: 'none' }}>
        Open
      </Link>
    </div>
  );
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
      getActivities({ limit: 8 }),
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
  const buckets = outreachBuckets(leads);

  // "To review" = nayi eligible properties jin pe abhi koi faisla nahi hua
  const toReview = leads.filter(
    (l) => !l.over_budget && (l.status === 'new' || l.status === 'matched') && isActiveLead(l)
  );
  const viewingsNow = leads.filter((l) => l.status === 'viewing');

  // ── Today's work — ek hi list, wajah ke hisaab se tarteeb:
  // follow-ups (waqt nikla) → replies (landlord ka intezaar khatam) →
  // viewings (aaj ka commitment) → ready to contact (naya kaam).
  // Ek lead sirf ek baar aata hai (pehli wajah jeet jati hai).
  const seen = new Set();
  const work = [];
  const add = (list, reason, color) => {
    for (const l of list) {
      if (seen.has(l.Id)) continue;
      seen.add(l.Id);
      work.push({ lead: l, reason, color });
    }
  };
  add([...buckets.followups].sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || '')), 'Follow-up due', 'var(--rust)');
  add(buckets.replies, 'Landlord replied', 'var(--green)');
  add(viewingsNow, 'Viewing in progress', 'var(--green)');
  add([...buckets.ready].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)), 'Ready to contact', 'var(--brass)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <p className="text-muted" style={{ margin: '3px 0 0' }}>
          Today&apos;s sourcing work: what needs attention and what to do next.
        </p>
      </div>

      {/* ── TODAY ── */}
      <div className="metric-strip">
        <Metric label="Follow-ups due" value={f.followupsDue} color={f.followupsDue ? 'var(--rust)' : undefined} href="/outreach?tab=followups" />
        <Metric label="Responses" value={buckets.replies.length} color={buckets.replies.length ? 'var(--green)' : undefined} href="/outreach?tab=replies" />
        <Metric label="To review" value={toReview.length} href="/sourcing?tab=review" />
        <Metric label="Ready to contact" value={f.needsContact} color={f.needsContact ? 'var(--brass)' : undefined} href="/outreach?tab=ready" />
        <Metric label="Viewings" value={f.viewings} href="/viewings" />
        <Metric label="Active orders" value={activeOrders.length} href="/orders" />
        <Metric
          label="Expected margin"
          value={`£${Math.round(f.expectedMargin).toLocaleString('en-GB')}/mo`}
          color={f.expectedMargin > 0 ? 'var(--green)' : undefined}
        />
      </div>

      {/* ── TODAY'S WORK ── */}
      <div>
        <h2 style={{ margin: '0 0 10px' }}>
          Today&apos;s work
          <span className="font-mono" style={{ marginLeft: 8, color: 'var(--mist)' }}>{work.length}</span>
        </h2>
        {work.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Nothing waiting: no follow-ups due, no unread responses, nothing ready to contact.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            {work.slice(0, 20).map(({ lead, reason, color }) => (
              <WorkRow key={lead.Id} lead={lead} reason={reason} reasonColor={color} />
            ))}
            {work.length > 20 && (
              <div className="work-row text-muted" style={{ fontSize: 12 }}>
                +{work.length - 20} more in <Link href="/outreach" style={{ color: 'var(--accent)', marginLeft: 4 }}>Outreach</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Recent activity ── */}
      <div>
        <h2 style={{ margin: '0 0 10px' }}>Recent activity</h2>
        <ActivityTimeline activities={activities} emptyText="No activity yet. It starts once orders find properties and they move through the funnel." />
      </div>
    </div>
  );
}
