// Property detail (CRM) — ek property, uske SAB orders/leads aur poori
// history. Ek property kai orders se match ho sakti hai — record ek hi
// rehta hai, leads alag-alag. [id] = listing_id (OpenRent ka).

import Link from 'next/link';
import { getLeads } from '@/lib/leads';
import { getActivities } from '@/lib/activities';
import { ActivityTimeline, derivedLeadEvents } from '@/components/activity-timeline';
import { LeadStatusBadge, OutreachBadge, money, sourceLabel } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

export default async function PropertyDetailPage({ params }) {
  const { id } = await params;

  let leads = [];
  let activities = [];
  let loadError = null;
  try {
    leads = (await getLeads()).filter((l) => String(l.listing_id) === String(id));
    activities = await getActivities({ listingId: id });
  } catch (e) {
    loadError = e.message;
  }

  if (loadError) {
    return (
      <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
        Could not load the property: {loadError}
      </div>
    );
  }
  if (!leads.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Property not found</p>
        <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>No order is sourcing this property any more.</p>
        <Link href="/properties" className="btn-brass" style={{ textDecoration: 'none' }}>Back to properties</Link>
      </div>
    );
  }

  const l = leads[0].listing || {};
  const raw = l.address || l.area || l.title || `#${id}`;
  const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');

  // Machine events sab leads se (discovered/match har order ke liye alag hua)
  const derived = leads.flatMap((lead) => derivedLeadEvents(lead));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <Link href="/properties" className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>← Properties</Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{place}</h1>
          <span className="font-mono" style={{ fontSize: 16, fontWeight: 700 }}>{money(l.price)} pcm</span>
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
          {[l.beds != null && `${l.beds} bed`, l.baths != null && `${l.baths} bath`, l.epc && `EPC ${l.epc}`, l.furnishing, l.landlord_name && `Landlord: ${l.landlord_name}`]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {/* Source ka naam alag, listing URL alag — url persisted snapshot se
            aata hai (scraper ki original listing URL); yahan kabhi banai nahi jati. */}
        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          Source: <span style={{ color: 'var(--paper)', fontWeight: 600 }}>{sourceLabel(l.source)}</span>
        </div>
        {l.url ? (
          <a href={l.url} target="_blank" rel="noreferrer" className="btn-brass" style={{ display: 'inline-block', marginTop: 10, textDecoration: 'none' }}>
            View original listing ↗
          </a>
        ) : (
          <div className="text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>Listing URL unavailable</div>
        )}
      </div>

      {l.image && (
        <div className="gcard-photo" style={{ maxWidth: 560 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={l.image} alt="" />
        </div>
      )}

      {/* ── Sourcing leads (orders matched) ── */}
      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
          Orders sourcing this property <span className="text-muted" style={{ fontWeight: 400, fontSize: 12.5 }}>{leads.length}</span>
        </h2>
        <div className="crm-wrap">
          <table className="crm-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Order</th>
                <th style={{ textAlign: 'right' }}>Match</th>
                <th style={{ textAlign: 'right' }}>Net margin</th>
                <th>Outreach</th>
                <th>Status</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.Id}>
                  <td className="font-mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                    <Link href={`/sourcing/${lead.Id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{lead.ref}</Link>
                  </td>
                  <td className="font-mono" style={{ fontSize: 12 }}>
                    {lead.order ? (
                      <Link href={`/orders/${lead.order.Id}`} style={{ color: 'var(--paper)', textDecoration: 'none' }}>
                        {lead.order.order_number || `ORD-${String(lead.order.Id).padStart(4, '0')}`}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{lead.match_score != null ? `${lead.match_score}%` : '—'}</td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {lead.net_monthly_margin != null ? `${money(lead.net_monthly_margin)}/mo` : '—'}
                  </td>
                  <td><OutreachBadge status={lead.outreach_status} size={10.5} /></td>
                  <td><LeadStatusBadge status={lead.status} size={10.5} /></td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.next_action || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Timeline (sab orders ka mila-jula) ── */}
      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>Activity</h2>
        <ActivityTimeline activities={activities} derived={derived} />
      </div>
    </div>
  );
}
