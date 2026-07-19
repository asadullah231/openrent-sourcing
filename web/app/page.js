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
        marginBottom: 26,
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
        {live ? 'Requests are being sent from your account' : 'Building requests — nothing is sent yet'}
      </span>
    </div>
  );
}

// Ledger ticker strip — single line, not a 4-tile grid
function Ticker({ health }) {
  const cells = [
    { k: 'tracked', v: health.totalListings, l: 'listings' },
    { k: 'hot', v: health.aboveViewingBar, l: 'above bar' },
    { k: 'sent', v: health.sentToday, l: 'sent today' },
    { k: 'cap', v: health.dailyCap, l: 'daily cap' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        borderTop: '1px solid var(--mist-line)',
        borderBottom: '1px solid var(--mist-line)',
        marginBottom: 30,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={c.k}
          style={{
            flex: 1,
            padding: '14px 18px',
            borderLeft: i === 0 ? 'none' : '1px solid var(--mist-line)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span className="font-mono" style={{ fontSize: 24, fontWeight: 500 }}>
            {c.v}
          </span>
          <span className="text-muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {c.l}
          </span>
        </div>
      ))}
    </div>
  );
}

function ListingRow({ l, rank }) {
  const hot = (l.score ?? 0) >= 70;
  const warm = (l.score ?? 0) >= 55;
  // brass left-bar thickness = score tier
  const barW = hot ? 3 : warm ? 2 : 1;
  const barC = hot ? 'var(--brass)' : warm ? 'var(--brass-dim)' : 'var(--mist-line)';

  return (
    <a
      href={l.url}
      target="_blank"
      rel="noreferrer"
      className="listing-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '16px 18px 16px 20px',
        borderLeft: `${barW}px solid ${barC}`,
        borderBottom: '1px solid var(--mist-line)',
        textDecoration: 'none',
        color: 'var(--paper)',
      }}
    >
      <div
        className={`seal ${hot ? '' : 'seal--muted'} ${rank === 0 ? 'seal--stamp' : ''}`}
        aria-label={`score ${l.score}`}
      >
        {l.score ?? '—'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {l.address || l.title || l.listing_id}
        </div>
        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
          {l.score_reason}
        </div>
      </div>

      <div className="font-mono" style={{ fontSize: 14, textAlign: 'right', minWidth: 80 }}>
        £{l.price}
        <div className="text-muted" style={{ fontSize: 11.5 }}>
          {l.beds} bed
        </div>
      </div>

      <div className="font-mono text-muted" style={{ fontSize: 12.5, minWidth: 96, textAlign: 'right' }}>
        {l.response_rate != null ? `${l.response_rate}%` : '—'}
        <div style={{ fontSize: 11 }}>{l.hours_live != null ? `${l.hours_live}h ago` : ''}</div>
      </div>
    </a>
  );
}

export default async function Board() {
  const [listings, health] = await Promise.all([getListings(), getHealth()]);
  const hot = listings.filter((l) => (l.score ?? 0) >= (health.minScore ?? 55));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
        <h1 className="font-display" style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>
          Sourcing
        </h1>
        <span className="text-muted font-mono" style={{ fontSize: 12 }}>
          Tower Hamlets · updated live
        </span>
      </div>

      <Ribbon health={health} />
      <Ticker health={health} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>
          Hottest now
        </h2>
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          first viewing request wins — move on the top of this list
        </span>
      </div>

      <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', overflow: 'hidden', borderLeft: 'none' }}>
        {listings.slice(0, 40).map((l, i) => (
          <ListingRow key={l.listing_id} l={l} rank={i} />
        ))}
        {listings.length === 0 && (
          <div className="text-muted" style={{ padding: 40, textAlign: 'center', fontSize: 13 }}>
            No listings yet. Run the bot: <span className="font-mono">node src/main.js --once</span>
          </div>
        )}
      </div>
    </div>
  );
}
