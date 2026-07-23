import { getHealth, getSendLog, getListings } from '@/lib/data';
import { SendBatchButton } from '@/components/send-batch-button';
import { SearchToggles } from '@/components/search-toggles';

export const dynamic = 'force-dynamic';

// Asad ka qadam #4 (23 Jul): "outreach page ho, jahan pata chale aaj itni
// outreach hui aur sab kuch." Ye woh page hai — aaj ka summary + aaj bheji hui.

function timeOnly(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default async function OutreachPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [health, log, listings] = await Promise.all([getHealth(), getSendLog(), getListings()]);

  // Aaj ki sent rows (live = asli bheji, shadow = draft banaye)
  const todayRows = log.filter((r) => r.day === today);
  const liveToday = todayRows.filter((r) => r.mode === 'live');
  const shadowToday = todayRows.filter((r) => r.mode === 'shadow');
  const fails = todayRows.filter((r) => r.status && !/sent|ok|success|302/i.test(String(r.status)));

  // listing_id → address/price (dikhane ke liye)
  const byId = new Map(listings.map((l) => [String(l.listing_id), l]));

  const cells = [
    { v: health.sentToday, l: 'sent today (live)' },
    { v: health.dailyCap, l: 'daily cap' },
    { v: Math.max(0, (health.dailyCap ?? 0) - (health.sentToday ?? 0)), l: 'left today' },
    { v: shadowToday.length, l: 'drafts today (shadow)' },
  ];

  const live = health.mode === 'live';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>Outreach</h1>
        <span className="text-muted font-mono" style={{ fontSize: 12 }}>
          {live ? 'LIVE' : 'SHADOW'} · autopilot {health.autopilot}
        </span>
      </div>

      {/* aaj ke numbers */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--mist-line)', borderBottom: '1px solid var(--mist-line)', marginBottom: 24, flexWrap: 'wrap' }}>
        {cells.map((c, i) => (
          <div key={i} style={{ flex: '1 1 130px', padding: '13px 18px', borderLeft: i === 0 ? 'none' : '1px solid var(--mist-line)', display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span className="font-mono" style={{ fontSize: 22, fontWeight: 500 }}>{c.v}</span>
            <span className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.l}</span>
          </div>
        ))}
      </div>

      {/* Active searches — Search page se "Save & start outreach" yahan aa kar
          dikhti hai (Asad, 23 Jul: "save kiya, outreach pe check karne aaya to
          kuch nahi dikha"). Sirf list + green on/off dot; add/edit Search page
          se. Toggle dabate hi auto-save. */}
      <div style={{ marginBottom: 30, padding: '18px 20px', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-tile)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
          <h2 style={{ fontSize: 17, margin: 0, fontWeight: 600 }}>Active searches</h2>
          <span className="text-muted" style={{ fontSize: 11.5 }}>green = on · outreach runs only on these</span>
        </div>
        <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.6 }}>
          Saved from the Search page. Toggle one off to pause it, ✕ to remove it — changes save on their own.
        </p>
        <SearchToggles />
      </div>

      {/* send now */}
      <div style={{ marginBottom: 30, paddingTop: 4 }}>
        <h2 style={{ fontSize: 17, margin: '0 0 4px', fontWeight: 600 }}>Start outreach</h2>
        <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.6 }}>
          Runs every search that&apos;s on, scrapes them, and sends one batch of requests now.
        </p>
        <SendBatchButton />
      </div>

      {/* fails pehle — agar koi ho */}
      {fails.length > 0 && (
        <div style={{ marginBottom: 24, padding: '12px 14px', border: '1px solid var(--rust)', borderRadius: 'var(--r-ctrl)', background: 'rgba(196,53,26,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rust)', marginBottom: 6 }}>
            {fails.length} fail aaj
          </div>
          {fails.slice(0, 5).map((f, i) => (
            <div key={i} className="text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              #{f.listing_id} · {f.status} · {timeOnly(f.created_at || f.time)}
            </div>
          ))}
        </div>
      )}

      {/* aaj bheji hui list */}
      <h2 style={{ fontSize: 17, margin: '0 0 12px', fontWeight: 600 }}>
        {live ? 'Sent today' : 'Drafts today'}
        <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 400, marginLeft: 8 }}>
          {(live ? liveToday : shadowToday).length}
        </span>
      </h2>

      {(live ? liveToday : shadowToday).length === 0 ? (
        <div className="text-muted" style={{ padding: 40, textAlign: 'center', fontSize: 13, border: '1px solid var(--mist-line)', borderRadius: 12 }}>
          Nothing yet today. Hit &quot;Send a batch now&quot; above to start.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-tile)', overflow: 'hidden' }}>
          {(live ? liveToday : shadowToday).map((r, i) => {
            const l = byId.get(String(r.listing_id));
            return (
              <a
                key={i}
                href={`/listing/${r.listing_id}`}
                style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--mist-line)', textDecoration: 'none', color: 'inherit' }}
              >
                <span className="font-mono text-muted" style={{ fontSize: 11.5, width: 44, flexShrink: 0 }}>
                  {timeOnly(r.CreatedAt || r.built_at)}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address || l?.address || l?.title || `#${r.listing_id}`}
                </span>
                <span className="font-mono text-muted" style={{ fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>
                  {l?.price ? `£${Number(l.price).toLocaleString('en-GB')}` : ''}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
