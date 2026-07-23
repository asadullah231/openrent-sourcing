import Link from 'next/link';
import { getListings } from '@/lib/data';
import { ListingCard } from '@/components/listing-card';

export const dynamic = 'force-dynamic';

// Ek location/search ka "folder" (Asad, 23 Jul): Outreach ki list se search pe
// click karo → yahan us location ki SAARI store listings, jinke saath outreach
// chal rahi hai. Har card pe status: 'Requested' (message ja chuka) ya pending.
//
// KYUN store se, live scrape se nahi (Asad ka faisla):
//   - Ye "outreach ka folder" hai — matlab wo listings jo bot ne dekh/uthai
//     hain, na ke OpenRent ka fresh page. Store me pehle se area, photo,
//     address, status sab hai.
//   - Live scrape har dafa OpenRent pe request maarta — 405/proxy fail ka
//     risk (screenshot pe dikha, 23 Jul). Store se koi fail nahi, aur foran.
//
// area?=<search name>. Listing ka `area` field search ke `name` se match hota
// hai (e.g. "Tower Hamlets").

export default async function SearchFolderPage({ searchParams }) {
  const sp = await searchParams;
  const area = sp?.area || '';

  const all = await getListings();
  // Is location ki listings — area match (case-insensitive, trim)
  const mine = area
    ? all.filter((l) => (l.area || '').trim().toLowerCase() === area.trim().toLowerCase())
    : [];

  const requested = mine.filter((l) => l.viewing_status === 'requested');
  const pending = mine.filter((l) => l.viewing_status !== 'requested');
  // requested pehle (naya upar), phir pending
  const ordered = [
    ...requested.sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0)),
    ...pending,
  ];

  return (
    <div>
      <Link
        href="/outreach"
        className="text-muted"
        style={{ fontSize: 12.5, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}
      >
        ← Back to Outreach
      </Link>

      <h1 style={{ fontSize: 28, margin: '0 0 4px', fontWeight: 600 }}>{area || 'Search'}</h1>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 8, fontSize: 12.5 }}>
        Every property in this location the bot is running outreach on.
      </p>

      {/* count strip */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <span className="font-mono" style={{ fontSize: 20, fontWeight: 600 }}>{mine.length}</span>
          <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>in this location</span>
        </div>
        <div>
          <span className="font-mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--green)' }}>{requested.length}</span>
          <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>requested</span>
        </div>
        <div>
          <span className="font-mono" style={{ fontSize: 20, fontWeight: 600 }}>{pending.length}</span>
          <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>pending</span>
        </div>
      </div>

      {mine.length === 0 ? (
        <div
          className="text-muted"
          style={{ padding: 40, textAlign: 'center', fontSize: 13, border: '1px solid var(--mist-line)', borderRadius: 12 }}
        >
          Nothing here yet. Once the bot scrapes this search, its properties show up here.
        </div>
      ) : (
        <div className="grid-cards">
          {ordered.map((l) => (
            <ListingCard key={l.listing_id} l={l} sent={l.viewing_status === 'requested'} />
          ))}
        </div>
      )}
    </div>
  );
}
