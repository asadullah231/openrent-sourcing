// Deals — pipeline ka anjaam. Teen groups: In progress (negotiation/deal),
// Won, Lost (wajah ke sath). Sawal jiska jawab ye screen deti hai:
// "is opportunity ka kya bana?" (redesign directive success criteria).
// Wahi lead data, koi naya model nahi.

import Link from 'next/link';
import { getLeads } from '@/lib/leads';
import { money, leadPropertyLine } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

function DealRow({ l, extra, extraColor }) {
  const orderLabel = l.order?.order_number || (l.order_id != null ? `ORD-${String(l.order_id).padStart(4, '0')}` : '—');
  return (
    <div className="work-row">
      <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 200px' }}>
        {leadPropertyLine(l)}
      </span>
      <span className="font-mono" style={{ flexShrink: 0, fontSize: 12.5 }}>{money(l.listing?.price)}</span>
      <span className="font-mono" style={{ flexShrink: 0, fontSize: 12.5, color: l.net_monthly_margin != null ? (l.net_monthly_margin >= 0 ? 'var(--green)' : 'var(--rust)') : 'var(--mist)' }}>
        {l.net_monthly_margin != null ? `${money(l.net_monthly_margin)}/mo` : '—'}
      </span>
      <span className="font-mono text-muted" style={{ flexShrink: 0, fontSize: 12 }}>{orderLabel}</span>
      {extra && <span style={{ flexShrink: 0, fontSize: 12, color: extraColor || 'var(--mist)' }}>{extra}</span>}
      <span className="text-muted" style={{ flexShrink: 0, fontSize: 11.5 }}>
        {new Date(l.UpdatedAt || l.CreatedAt || 0).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </span>
      <Link href={`/sourcing/${l.Id}`} className="seg" style={{ flexShrink: 0, fontSize: 11.5, padding: '4px 10px', textDecoration: 'none', marginLeft: 'auto' }}>
        Open
      </Link>
    </div>
  );
}

function Group({ title, count, children, empty }) {
  return (
    <div>
      <h2 style={{ margin: '0 0 10px' }}>
        {title}
        <span className="font-mono" style={{ marginLeft: 8, color: 'var(--mist)' }}>{count}</span>
      </h2>
      {count === 0 ? (
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>{empty}</p>
      ) : (
        <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default async function DealsPage() {
  let leads = [];
  let loadError = null;
  try {
    leads = await getLeads();
  } catch (e) {
    loadError = e.message;
  }

  if (loadError) {
    return (
      <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
        Could not load deals: {loadError}
      </div>
    );
  }

  const inProgress = leads.filter((l) => l.status === 'negotiation' || l.status === 'deal');
  const won = leads.filter((l) => l.status === 'won');
  const lost = leads.filter((l) => l.status === 'lost');
  const wonMargin = won.reduce((s, l) => s + (Number(l.net_monthly_margin) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 style={{ margin: 0 }}>Deals</h1>
        <p className="text-muted" style={{ margin: '3px 0 0' }}>
          Where opportunities ended up — in negotiation, won, or lost and why.
        </p>
      </div>

      <div className="metric-strip">
        <div className="metric">
          <div className="metric-value">{inProgress.length}</div>
          <div className="metric-label">In progress</div>
        </div>
        <div className="metric">
          <div className="metric-value" style={won.length ? { color: 'var(--green)' } : undefined}>{won.length}</div>
          <div className="metric-label">Won</div>
        </div>
        <div className="metric">
          <div className="metric-value" style={wonMargin > 0 ? { color: 'var(--green)' } : undefined}>
            £{Math.round(wonMargin).toLocaleString('en-GB')}/mo
          </div>
          <div className="metric-label">Won margin</div>
        </div>
        <div className="metric">
          <div className="metric-value">{lost.length}</div>
          <div className="metric-label">Lost</div>
        </div>
      </div>

      <Group title="In progress" count={inProgress.length} empty="Nothing in negotiation right now — deals start from interested landlords after a viewing.">
        {inProgress.map((l) => (
          <DealRow key={l.Id} l={l} extra={l.status === 'negotiation' ? 'Negotiation' : 'Deal agreed'} extraColor="var(--brass)" />
        ))}
      </Group>

      <Group title="Won" count={won.length} empty="No deals won yet.">
        {won.map((l) => (
          <DealRow key={l.Id} l={l} extra="Won" extraColor="var(--green)" />
        ))}
      </Group>

      <Group title="Lost" count={lost.length} empty="Nothing lost yet — loss reasons will show here so patterns are visible.">
        {lost.map((l) => (
          <DealRow
            key={l.Id}
            l={l}
            extra={l.loss_reason ? l.loss_reason.replace(/_/g, ' ') : 'No reason logged'}
            extraColor="var(--rust)"
          />
        ))}
      </Group>
    </div>
  );
}
