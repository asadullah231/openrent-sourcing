import { getListing, getSettings } from '@/lib/data';
import { fillTemplate } from '@bot/message-template.js';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Address ke pehle "3 Bed Maisonette," jaisa prefix hata do — asli jagah bache.
function placeName(l) {
  const raw = l.address || l.area || l.title || `Listing ${l.listing_id}`;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1 && /bed|room|studio|flat|house|maisonette|apartment/i.test(parts[0])) {
    return parts.slice(1).join(', ');
  }
  return raw;
}

// Ek fact — value ho tabhi dikhta hai (null/empty ghayab, "null ·" jaisa kachra nahi).
function Fact({ label, value }) {
  if (value == null || value === '' || value === '—' || value === '-') return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default async function ListingDetail({ params }) {
  const { id } = await params;
  const [l, settings] = await Promise.all([getListing(id), getSettings()]);

  // Un-stored id (live search result) — bare 404 ke bajaye saaf message.
  if (!l) {
    return (
      <div style={{ maxWidth: 560, padding: '20px 0' }}>
        <Link href="/search" style={{ color: 'var(--mist)', fontSize: 13, textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ fontSize: 22, margin: '16px 0 8px', fontWeight: 600 }}>This listing isn&apos;t saved yet</h1>
        <p className="text-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          Detail pages only exist for listings the bot has saved. Search results open on the
          portal directly. Once this search is saved and the bot runs it, the property shows up here.
        </p>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/search" className="btn-brass" style={{ textDecoration: 'none', fontSize: 13 }}>Back to Search</Link>
          <Link href="/outreach" className="text-muted" style={{ fontSize: 13, alignSelf: 'center', textDecoration: 'none' }}>Go to Outreach →</Link>
        </div>
      </div>
    );
  }

  const sent = l.viewing_status === 'requested';
  const isRM = l.source === 'rightmove';
  const portal = isRM ? 'Rightmove' : 'OpenRent';
  const photos = (l.images && l.images.length ? l.images : l.image ? [l.image] : []).slice(0, 8);

  // Message: store me bheja hua ho to wahi; warna template FILL karke preview
  // (fillTemplate = wahi jo bot bhejta hai — {greeting}/{beds}/{area} sab bharta).
  const message = l.sentMessage || fillTemplate(settings.viewing?.messageTemplate, l, settings.viewing || {});

  const place = placeName(l);
  const meta = [l.beds != null && `${l.beds} bed`, l.baths != null && `${l.baths} bath`, l.furnishing]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Link href="/outreach" style={{ color: 'var(--mist)', fontSize: 13, textDecoration: 'none' }}>← Back</Link>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, margin: '14px 0 4px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 6, color: isRM ? '#8ec7ff' : 'var(--brass)', background: isRM ? 'rgba(90,160,255,.14)' : 'rgba(180,140,60,.14)' }}>
              {portal}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 999, border: `1px solid ${sent ? 'var(--green)' : 'var(--mist-line)'}`, color: sent ? 'var(--green)' : 'var(--mist)' }}>
              {sent ? '✓ Viewing requested' : 'Not requested yet'}
            </span>
          </div>
          <h1 style={{ fontSize: 27, margin: 0, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{place}</h1>
          {meta && <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{meta}</p>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="font-mono" style={{ fontSize: 26, fontWeight: 700 }}>£{Number(l.price ?? 0).toLocaleString('en-GB')}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>per month</div>
        </div>
      </div>

      {/* ── PHOTO GALLERY (Airbnb hero grid) ── */}
      {photos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: photos.length === 1 ? '1fr' : '2fr 1fr 1fr',
            gridAutoRows: photos.length === 1 ? '420px' : '210px',
            gap: 8,
            margin: '18px 0 26px',
            borderRadius: 'var(--r-photo)',
            overflow: 'hidden',
          }}
        >
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a
              key={i}
              href={src}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                overflow: 'hidden',
                // pehli photo bara (2 rows), baqi chhoti
                gridColumn: photos.length > 1 && i === 0 ? '1' : 'auto',
                gridRow: photos.length > 1 && i === 0 ? '1 / span 2' : 'auto',
                background: 'var(--surface-2)',
              }}
            >
              <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </a>
          ))}
        </div>
      )}

      {/* ── BODY: facts + message ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
        {/* LEFT */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Property details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 18, marginBottom: 8 }}>
            <Fact label="Beds" value={l.beds} />
            <Fact label="Baths" value={l.baths} />
            <Fact label="Furnishing" value={l.furnishing} />
            <Fact label="Deposit" value={l.deposit ? `£${Number(l.deposit).toLocaleString('en-GB')}` : null} />
            <Fact label="Available" value={l.available} />
            <Fact label="EPC" value={l.epc} />
            <Fact label="Distance" value={l._distance_km != null ? `${l._distance_km} km` : null} />
            <Fact label="Landlord response" value={l.response_rate != null ? `${l.response_rate}%` : null} />
            <Fact label="Posted" value={l.hours_live != null ? (l.hours_live < 24 ? `${l.hours_live}h ago` : `${Math.round(l.hours_live / 24)}d ago`) : null} />
            <Fact label="Score" value={l.score != null ? String(l.score) : null} />
          </div>
          {(l.agent_name || l.agent_phone) && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--mist-line)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Contact</h2>
              {l.agent_name && <div style={{ fontSize: 14, fontWeight: 500 }}>{l.agent_name}</div>}
              {l.agent_phone && (
                <a href={`tel:${String(l.agent_phone).replace(/\s+/g, '')}`} className="font-mono" style={{ display: 'inline-block', marginTop: 6, fontSize: 15, color: 'var(--brass)', textDecoration: 'none' }}>
                  📞 {l.agent_phone}
                </a>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: message card */}
        <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: 18, background: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{sent ? 'Message sent to landlord' : 'Message that will be sent'}</h2>
          <p className="text-muted" style={{ fontSize: 11.5, margin: '0 0 12px' }}>
            {sent ? 'This went out on your behalf.' : 'The bot sends this when this listing goes out.'}
          </p>
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 10, padding: 14, background: 'var(--ink-raise)', fontSize: 13.5, lineHeight: 1.65 }}>
            {message || <span className="text-muted">No message on record.</span>}
          </div>

          {l.lastSend && (
            <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
              Sent {l.lastSend.day} · {l.lastSend.status}{l.lastSend.reason ? ` (${l.lastSend.reason})` : ''}
            </p>
          )}
          {l.requested_at && (
            <p className="text-muted font-mono" style={{ fontSize: 11.5, marginTop: 4 }}>
              {new Date(l.requested_at).toLocaleString('en-GB')}
            </p>
          )}

          {/* url persisted listing se — na ho to broken link nahi dete */}
          {l.url ? (
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="btn-brass"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none', fontSize: 13.5, marginTop: 16 }}
            >
              Open on {portal} ↗
            </a>
          ) : (
            <p className="text-muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 16 }}>
              Listing URL unavailable
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
