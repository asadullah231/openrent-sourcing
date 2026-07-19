// Gallery card — photo top, info neeche. Vercel-clean. Dono pages (/new, /sent) reuse.
// Click → apna detail page (/listing/{id}), seedha OpenRent nahi.
import Link from 'next/link';

function timeAgo(hours) {
  if (hours == null) return '';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const d = Math.round(hours / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

export function ListingCard({ l, rank = 1, sent = false }) {
  const hot = (l.score ?? 0) >= 70;

  return (
    <Link
      href={`/listing/${l.listing_id}`}
      className="gcard"
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--mist-line)',
        borderRadius: 'var(--r-card)',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'var(--paper)',
        background: 'var(--surface)',
      }}
    >
      {/* photo */}
      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: 'var(--ink)', overflow: 'hidden' }}>
        {l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="text-muted" style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 12 }}>no photo</div>
        )}
        {/* subtle bottom gradient for legibility */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,11,13,0.55), transparent 45%)' }} />
        {/* Score badge */}
        <div
          className={`seal ${hot ? '' : 'seal--muted'} ${rank === 0 && !sent ? 'seal--stamp' : ''}`}
          style={{ position: 'absolute', top: 10, left: 10, width: 36, height: 36, fontSize: 14 }}
          aria-label={`score ${l.score}`}
        >
          {l.score ?? '—'}
        </div>
        {/* status pill */}
        {sent && (
          <span
            style={{
              position: 'absolute', top: 12, right: 12, fontSize: 11, fontWeight: 500,
              padding: '4px 10px', borderRadius: 999, background: 'rgba(63,178,127,0.95)', color: '#06140d',
              backdropFilter: 'blur(4px)',
            }}
          >
            Requested
          </span>
        )}
      </div>

      {/* info */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="font-mono" style={{ fontSize: 17, fontWeight: 600, color: 'var(--paper)' }}>£{Number(l.price).toLocaleString('en-GB')}</span>
          <span className="text-muted" style={{ fontSize: 12 }}>/mo</span>
          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 11.5 }}>
            {sent && l.requested_at ? new Date(l.requested_at).toLocaleDateString('en-GB') : timeAgo(l.hours_live)}
          </span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
          {l.address || l.title || l.listing_id}
        </div>

        {l.description && (
          <p className="text-muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {l.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8, fontSize: 11.5, flexWrap: 'wrap' }}>
          {[`${l.beds} bed`, l.baths != null && `${l.baths} bath`, l.furnishing, l.response_rate != null && `${l.response_rate}% resp`, l._distance_km != null && `${l._distance_km}km`]
            .filter(Boolean)
            .map((chip, i) => (
              <span key={i} style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--paper-2)', border: '1px solid var(--mist-line)' }}>{chip}</span>
            ))}
        </div>
      </div>
    </Link>
  );
}
