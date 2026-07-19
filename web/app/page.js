import { getPending, getHealth } from '@/lib/data';
import { ListingGallery } from '@/components/listing-gallery';

export const dynamic = 'force-dynamic';

function Ribbon({ health }) {
  const live = health.mode === 'live';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--mist-line)', background: 'var(--ink-raise)', marginBottom: 20, flexWrap: 'wrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: live ? 'var(--rust)' : 'var(--brass)', boxShadow: live ? '0 0 8px var(--rust)' : 'none' }} />
      <span className="font-mono" style={{ fontSize: 12.5 }}>
        {live ? 'LIVE' : 'SHADOW'} · autopilot {health.autopilot} · {health.sentToday}/{health.dailyCap} sent today
      </span>
      <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
        {live ? 'Requests go out from your account' : 'Building requests — nothing is sent yet'}
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
    <div style={{ display: 'flex', borderTop: '1px solid var(--mist-line)', borderBottom: '1px solid var(--mist-line)', marginBottom: 26, flexWrap: 'wrap' }}>
      {cells.map((c, i) => (
        <div key={i} style={{ flex: '1 1 120px', padding: '13px 18px', borderLeft: i === 0 ? 'none' : '1px solid var(--mist-line)', display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span className="font-mono" style={{ fontSize: 22, fontWeight: 500 }}>{c.v}</span>
          <span className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.l}</span>
        </div>
      ))}
    </div>
  );
}

export default async function NewListings() {
  const [pending, health] = await Promise.all([getPending(), getHealth()]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>New &amp; pending</h1>
        <span className="text-muted font-mono" style={{ fontSize: 12 }}>Tower Hamlets · live</span>
      </div>

      <Ribbon health={health} />
      <Ticker health={health} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, margin: 0, fontWeight: 600 }}>Worth a look</h2>
        <span className="text-muted" style={{ fontSize: 12.5 }}>filter and sort — top ones move first</span>
      </div>

      <ListingGallery listings={pending} />
    </div>
  );
}
