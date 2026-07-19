import { getListings, getHealth } from '@/lib/data';

export const dynamic = 'force-dynamic';

function Ribbon({ health }) {
  const live = health.mode === 'live';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 16px',
        borderRadius: 'var(--r-tile)',
        border: '1px solid var(--mist-line)',
        background: 'var(--ink-raise)',
        marginBottom: 22,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: live ? 'var(--rust)' : 'var(--brass)',
          boxShadow: live ? '0 0 8px var(--rust)' : 'none',
        }}
      />
      <span className="font-mono" style={{ fontSize: 12.5, letterSpacing: '0.02em' }}>
        {live ? 'LIVE' : 'SHADOW'} · autopilot {health.autopilot} · {health.sentToday}/{health.dailyCap} sent today
      </span>
      <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
        {live ? 'Requests are going out from your account' : 'Building requests — nothing is sent yet'}
      </span>
    </div>
  );
}

function Ticker({ health }) {
  const cells = [
    { v: health.totalListings, l: 'listings' },
    { v: health.aboveViewingBar, l: 'above bar' },
    { v: health.sentToday, l: 'sent today' },
    { v: health.dailyCap, l: 'daily cap' },
  ];
  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--mist-line)', borderBottom: '1px solid var(--mist-line)', marginBottom: 28, flexWrap: 'wrap' }}>
      {cells.map((c, i) => (
        <div key={i} style={{ flex: '1 1 120px', padding: '13px 18px', borderLeft: i === 0 ? 'none' : '1px solid var(--mist-line)', display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span className="font-mono" style={{ fontSize: 23, fontWeight: 500 }}>{c.v}</span>
          <span className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.l}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(hours) {
  if (hours == null) return '';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const d = Math.round(hours / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function ListingCard({ l, rank }) {
  const hot = (l.score ?? 0) >= 70;
  const warm = (l.score ?? 0) >= 55;
  const barC = hot ? 'var(--brass)' : warm ? 'var(--brass-dim)' : 'var(--mist-line)';

  return (
    <a
      href={l.url}
      target="_blank"
      rel="noreferrer"
      className="listing-card"
      style={{
        display: 'flex',
        border: '1px solid var(--mist-line)',
        borderLeft: `3px solid ${barC}`,
        borderRadius: 'var(--r-card)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'var(--paper)',
        background: 'var(--ink-raise)',
      }}
    >
      {/* photo */}
      <div style={{ width: 176, minHeight: 148, flexShrink: 0, background: 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
        {l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="text-muted" style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 11 }}>no photo</div>
        )}
        {/* Score Seal — signature, overlaid on photo corner */}
        <div
          className={`seal ${hot ? '' : 'seal--muted'} ${rank === 0 ? 'seal--stamp' : ''}`}
          style={{ position: 'absolute', top: 8, left: 8, width: 42, height: 42, fontSize: 18 }}
          aria-label={`score ${l.score}`}
        >
          {l.score ?? '—'}
        </div>
      </div>

      {/* info */}
      <div style={{ flex: 1, padding: '14px 18px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: 17, fontWeight: 500, color: 'var(--brass)' }}>
            £{l.price}
          </span>
          <span className="text-muted" style={{ fontSize: 12.5 }}>per month</span>
          {l._distance_km != null && (
            <span className="font-mono text-muted" style={{ fontSize: 12 }}>◎ {l._distance_km} km</span>
          )}
          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 11.5 }}>{timeAgo(l.hours_live)}</span>
        </div>

        <div style={{ fontSize: 15.5, fontWeight: 500, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {l.address || l.title || l.listing_id}
        </div>

        {l.description && (
          <p className="text-muted" style={{ fontSize: 12.5, margin: '6px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {l.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--paper)', opacity: 0.85, flexWrap: 'wrap' }}>
          <span>{l.beds} Beds</span>
          {l.baths != null && <span>· {l.baths} Bath{l.baths > 1 ? 's' : ''}</span>}
          {l.furnishing && <span>· {l.furnishing}</span>}
          {l.response_rate != null && <span className="text-muted">· landlord {l.response_rate}%</span>}
        </div>
      </div>
    </a>
  );
}

export default async function Board() {
  const [listings, health] = await Promise.all([getListings(), getHealth()]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="font-display" style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>Sourcing</h1>
        <span className="text-muted font-mono" style={{ fontSize: 12 }}>Tower Hamlets · updated live</span>
      </div>

      <Ribbon health={health} />
      <Ticker health={health} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>Hottest now</h2>
        <span className="text-muted" style={{ fontSize: 12.5 }}>first viewing request wins — move on the top of this list</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {listings.slice(0, 40).map((l, i) => (
          <ListingCard key={l.listing_id} l={l} rank={i} />
        ))}
        {listings.length === 0 && (
          <div className="text-muted" style={{ padding: 40, textAlign: 'center', fontSize: 13, border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)' }}>
            No listings yet. Run the bot: <span className="font-mono">node src/main.js --once</span>
          </div>
        )}
      </div>
    </div>
  );
}
