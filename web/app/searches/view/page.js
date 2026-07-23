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
  const source = sp?.source || ''; // 'openrent' | 'rightmove' | '' (dono)

  const all = await getListings();
  // Is folder ki listings — area match + (agar source diya) portal match.
  // Ye is liye zaroori hai (23 Jul): auto-cross ke baad ek hi location ki
  // OpenRent + Rightmove dono listings store me hoti hain. Folder OpenRent ka
  // hai to sirf OpenRent ki dikhni chahiye, warna dono mix ho jatin.
  const mine = area
    ? all.filter((l) => {
        if ((l.area || '').trim().toLowerCase() !== area.trim().toLowerCase()) return false;
        if (source && (l.source || 'openrent') !== source) return false;
        return true;
      })
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 4px', fontWeight: 600 }}>{area || 'Search'}</h1>
        {source && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              padding: '3px 9px',
              borderRadius: 6,
              marginBottom: 4,
              color: source === 'rightmove' ? '#8ec7ff' : 'var(--brass)',
              background: source === 'rightmove' ? 'rgba(90,160,255,.14)' : 'rgba(180,140,60,.14)',
            }}
          >
            {source === 'rightmove' ? 'Rightmove' : 'OpenRent'}
          </span>
        )}
      </div>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 8, fontSize: 12.5 }}>
        Every {source === 'rightmove' ? 'Rightmove' : source === 'openrent' ? 'OpenRent' : ''} property in this location the bot is running outreach on.
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
