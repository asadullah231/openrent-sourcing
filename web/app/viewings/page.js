// Viewings — pipeline ka aakhri operational parao deal se pehle. Wahi lead
// data (order_properties), sirf viewing-stage lens (redesign directive: nav
// me Viewings alag). Koi nayi table/model nahi.

import Link from 'next/link';
import { getLeads } from '@/lib/leads';
import { OutreachBadge, money, leadPropertyLine } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

export default async function ViewingsPage() {
  let leads = [];
  let loadError = null;
  try {
    leads = await getLeads();
  } catch (e) {
    loadError = e.message;
  }

  const rows = leads
    .filter((l) => l.status === 'viewing')
    .sort((a, b) => (a.next_action_date || '9999').localeCompare(b.next_action_date || '9999'));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ margin: 0 }}>Viewings</h1>
        <p className="text-muted" style={{ margin: '3px 0 0' }}>
          Properties at the viewing stage — confirm, attend, then move them to negotiation or log the outcome.
        </p>
      </div>

      {loadError ? (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
          Could not load viewings: {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>No viewings scheduled</p>
          <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>
            When a landlord agrees to a viewing, set the property&apos;s status to Viewing and it appears here.
          </p>
          <Link href="/outreach?tab=interested" className="btn-brass" style={{ textDecoration: 'none' }}>
            See interested landlords
          </Link>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', overflow: 'hidden' }}>
          {rows.map((l) => {
            const orderLabel = l.order?.order_number || (l.order_id != null ? `ORD-${String(l.order_id).padStart(4, '0')}` : '—');
            const due = l.next_action_date && l.next_action_date <= today;
            return (
              <div key={l.Id} className="work-row">
                <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 200px' }}>
                  {leadPropertyLine(l)}
                </span>
                <span className="font-mono" style={{ flexShrink: 0, fontSize: 12.5 }}>{money(l.listing?.price)}</span>
                <span className="font-mono text-muted" style={{ flexShrink: 0, fontSize: 12 }}>{orderLabel}</span>
                <span className="text-muted" style={{ flexShrink: 0, fontSize: 12 }}>
                  {l.listing?.landlord_name || '—'}
                </span>
                <span style={{ flexShrink: 0 }}><OutreachBadge status={l.outreach_status} /></span>
                <span style={{ flexShrink: 0, fontSize: 12, color: due ? 'var(--rust)' : 'var(--mist)' }}>
                  {l.next_action || 'No next action set'}
                  {l.next_action_date && ` · ${l.next_action_date}`}
                </span>
                <Link href={`/sourcing/${l.Id}`} className="seg" style={{ flexShrink: 0, fontSize: 11.5, padding: '4px 10px', textDecoration: 'none', marginLeft: 'auto' }}>
                  Open
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
