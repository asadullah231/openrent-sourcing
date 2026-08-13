// Properties — CRM lens: har property EK hi record, chahe wo kai orders se
// match hui ho (leads dedupe by listing_id). Bot ke listings store ko yahan
// nahi chherte — ye order-sourcing wali properties hain (lead snapshots se).

import Link from 'next/link';
import { getLeads } from '@/lib/leads';
import { LeadStatusBadge, money, SourceListingLine } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

export default async function PropertiesPage() {
  let leads = [];
  let loadError = null;
  try {
    leads = await getLeads();
  } catch (e) {
    loadError = e.message;
  }

  // Ek property → uske sab leads. Snapshot sab se taze lead ka lete hain
  // (leads UpdatedAt desc sorted aate hain, isliye pehla hi taza hai).
  const props = new Map();
  for (const l of leads) {
    const key = String(l.listing_id);
    if (!props.has(key)) props.set(key, { listing: l.listing, leads: [] });
    props.get(key).leads.push(l);
  }
  const items = [...props.entries()];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div>
          <h1 style={{ margin: 0 }}>Properties</h1>
          <p className="text-muted" style={{ margin: '3px 0 0' }}>
            Every property in sourcing — one record per property, even when it matches several orders.
          </p>
        </div>
        {/* Map primary nav se nikla (redesign directive) — yahan se milta hai */}
        <Link href="/map" className="seg" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          Map view
        </Link>
      </div>

      {loadError ? (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
          Could not load properties: {loadError}
        </div>
      ) : items.length === 0 ? (
        <div style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>No properties yet</p>
          <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>
            Run “Find properties” on an order — matches appear here automatically.
          </p>
          <Link href="/orders" className="btn-brass" style={{ textDecoration: 'none' }}>Go to orders</Link>
        </div>
      ) : (
        <div className="grid-cards">
          {items.map(([listingId, p]) => {
            const l = p.listing || {};
            const raw = l.address || l.area || l.title || `#${listingId}`;
            const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');
            const best = p.leads.reduce((a, b) => ((b.match_score ?? -1) > (a.match_score ?? -1) ? b : a), p.leads[0]);
            // Card ka structure: upar wala hissa Link (detail pe le jata hai),
            // neeche source/listing line ALAG — View listing ek asli <a> hai jo
            // original listing URL nai tab me kholta hai. Link ke andar <a> nest
            // karna invalid HTML hota, is liye footer Link se bahar hai.
            return (
              <div key={listingId} className="gcard" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href={`/properties/${listingId}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'var(--paper)' }}>
                <div className="gcard-photo">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" loading="lazy" />
                  ) : (
                    <div className="text-muted" style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 12 }}>
                      no photo
                    </div>
                  )}
                  {best?.match_score != null && (
                    <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', color: '#fff' }}>
                      {best.match_score}% best match
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place}</span>
                  <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 14.5, fontWeight: 600, flexShrink: 0 }}>{money(l.price)}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 12.5 }}>
                  {[l.beds != null && `${l.beds} bed`, l.baths != null && `${l.baths} bath`, l.epc && `EPC ${l.epc}`].filter(Boolean).join(' · ') || '—'}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                  <span><b className="font-mono">{p.leads.length}</b> <span className="text-muted">order{p.leads.length === 1 ? '' : 's'}</span></span>
                  <LeadStatusBadge status={best?.status} size={10} />
                </div>
              </Link>
              <SourceListingLine listing={l} size={11.5} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
