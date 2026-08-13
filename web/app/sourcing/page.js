// Sourcing — CRM ka markazi register. Har row = ek sourcing opportunity:
// EK property jo EK order ke liye source ho rahi hai (match + margin +
// outreach + pipeline). Data model me ye "lead" (order_properties row) hi
// hai — magar UI me "Lead" lafz kahin nahi aata (13 Aug directive): user ko
// Order ↔ Property ka rishta seedha dikhna chahiye, naya concept nahi.
//
// Server sirf data laata hai; search/filter/sort sab client table me hai
// (LeadsTable) — row counts chhote hain (sainkron me), NocoDB round-trips
// ki zaroorat nahi.

import Link from 'next/link';
import { getLeads } from '@/lib/leads';
import { LeadsTable } from '@/components/leads-table';

export const dynamic = 'force-dynamic';

export default async function SourcingPage({ searchParams }) {
  const sp = await searchParams;
  let leads = [];
  let loadError = null;
  try {
    leads = await getLeads();
  } catch (e) {
    loadError = e.message;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Sourcing</h1>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Every property being sourced for an order, with match, margin and what to do next.
          </p>
        </div>
        <Link href="/orders" className="seg" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          Orders
        </Link>
      </div>

      {loadError ? (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
          Could not load sourcing: {loadError}
        </div>
      ) : leads.length === 0 ? (
        <div style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>Nothing in sourcing yet</p>
          <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>
            Properties appear here automatically when an order finds matches.
          </p>
          <Link href="/orders" className="btn-brass" style={{ textDecoration: 'none' }}>
            Go to orders
          </Link>
        </div>
      ) : (
        <LeadsTable leads={leads} initialTab={sp?.tab} />
      )}
    </div>
  );
}
