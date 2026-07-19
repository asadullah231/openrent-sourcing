import { getListing, getSettings } from '@/lib/data';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function buildMessage(l, settings) {
  // Agar store me exact message nahi, to template se preview banao (jaisa bot bhejega)
  const v = settings.viewing || {};
  const tpl = v.messageTemplate || '';
  // "3 Bed Maisonette, Swaton Road, E3" → "Swaton Road, E3" (bed-type prefix hatao)
  const parts = (l.address || '').split(',').map((s) => s.trim()).filter(Boolean);
  const place = parts.length > 1 && /bed|room|studio|flat|house|maisonette/i.test(parts[0])
    ? parts.slice(1).join(', ')
    : l.address || '';
  return tpl.replace('{place}', place).replace('{availability}', v.availabilityText || '');
}

function Row({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--mist-line)', fontSize: 13.5 }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default async function ListingDetail({ params }) {
  const { id } = await params;
  const [l, settings] = await Promise.all([getListing(id), getSettings()]);
  if (!l) notFound();

  const sent = l.viewing_status === 'requested';
  const photos = (l.images && l.images.length ? l.images : l.image ? [l.image] : []).slice(0, 12);
  const message = l.sentMessage || buildMessage(l, settings);

  return (
    <div style={{ maxWidth: 860 }}>
      <Link href="/" style={{ color: 'var(--mist)', fontSize: 13, textDecoration: 'none' }}>← Back</Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, margin: '14px 0 6px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, margin: 0, fontWeight: 600, lineHeight: 1.2 }}>{l.address || l.title || `Listing ${l.listing_id}`}</h1>
        <div className={`seal ${(l.score ?? 0) >= 70 ? '' : 'seal--muted'}`} style={{ width: 48, height: 48, fontSize: 20 }}>{l.score ?? '—'}</div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap' }}>
        <span className="font-mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--paper)' }}>£{Number(l.price).toLocaleString('en-GB')}<span className="text-muted" style={{ fontSize: 13, fontWeight: 400 }}> /mo</span></span>
        <span style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 999, border: `1px solid ${sent ? 'var(--green)' : 'var(--brass-dim)'}`, color: sent ? 'var(--green)' : 'var(--brass)' }}>
          {sent ? '✓ Viewing requested' : 'Not requested yet'}
        </span>
      </div>

      {/* PHOTO GALLERY */}
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 24, maxHeight: photos.length === 1 ? 380 : 'none' }}>
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={src} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '4/3', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--mist-line)' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </a>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* LEFT: facts */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Details</h2>
          <Row label="Beds" value={l.beds} />
          <Row label="Baths" value={l.baths} />
          <Row label="Furnishing" value={l.furnishing} />
          <Row label="Deposit" value={l.deposit ? `£${l.deposit}` : null} />
          <Row label="Available" value={l.available} />
          <Row label="EPC" value={l.epc} />
          <Row label="Distance" value={l._distance_km != null ? `${l._distance_km} km` : null} />
          <Row label="Landlord response" value={l.response_rate != null ? `${l.response_rate}%` : null} />
          <Row label="Posted" value={l.hours_live != null ? `${l.hours_live}h ago` : null} />
          <Row label="Score" value={`${l.score} · ${l.score_reason || ''}`} />
        </div>

        {/* RIGHT: the message + link */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{sent ? 'Message sent to landlord' : 'Message that will be sent'}</h2>
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 10, padding: 14, background: 'var(--ink-raise)', fontSize: 13.5, lineHeight: 1.6 }}>
            {message || <span className="text-muted">No message on record.</span>}
          </div>
          {l.lastSend && (
            <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Sent {l.lastSend.day} · status {l.lastSend.status}{l.lastSend.reason ? ` (${l.lastSend.reason})` : ''}
            </p>
          )}
          {l.requested_at && (
            <p className="text-muted font-mono" style={{ fontSize: 11.5, marginTop: 4 }}>
              {new Date(l.requested_at).toLocaleString('en-GB')}
            </p>
          )}

          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 8px' }}>Links</h2>
          <a href={l.url} target="_blank" rel="noreferrer" className="btn-brass" style={{ display: 'inline-block', textDecoration: 'none', fontSize: 13 }}>
            Open on OpenRent ↗
          </a>
          <p className="font-mono text-muted" style={{ fontSize: 11.5, marginTop: 8, wordBreak: 'break-all' }}>{l.url}</p>
        </div>
      </div>
    </div>
  );
}
