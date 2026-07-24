import { getHealth, getSendLog, getListings } from '@/lib/data';
import { SendBatchButton } from '@/components/send-batch-button';
import { SearchToggles } from '@/components/search-toggles';

export const dynamic = 'force-dynamic';

// Outreach — aaj ki tasveer ek nazar me (Asad, 23 Jul). Premium/saaf look:
// stat cards + cap progress, folders, ek clear action, aaj bheji hui list.

function timeOnly(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Ek stat card. accent true = brass highlight (kaam ki sab se ahem ginti).
function Stat({ value, label, accent = false, hint }) {
  return (
    <div
      style={{
        flex: '1 1 150px',
        padding: '16px 18px',
        border: '1px solid var(--mist-line)',
        borderRadius: 'var(--r-card)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: accent ? 'var(--brass)' : 'var(--paper)' }}>
        {value}
      </div>
      <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 7 }}>
        {label}
      </div>
      {hint && <div className="text-muted" style={{ fontSize: 11, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export default async function OutreachPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [health, log, listings] = await Promise.all([getHealth(), getSendLog(), getListings()]);

  const todayRows = log.filter((r) => r.day === today);
  const liveToday = todayRows.filter((r) => r.mode === 'live');
  const shadowToday = todayRows.filter((r) => r.mode === 'shadow');
  const fails = todayRows.filter((r) => r.status && !/sent|ok|success|302/i.test(String(r.status)));

  const byId = new Map(listings.map((l) => [String(l.listing_id), l]));

  const live = health.mode === 'live';
  const sent = health.sentToday ?? 0;
  const cap = health.dailyCap ?? 0;
  const left = Math.max(0, cap - sent);
  const pct = cap > 0 ? Math.min(100, Math.round((sent / cap) * 100)) : 0;

  const rows = live ? liveToday : shadowToday;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 30, margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>Outreach</h1>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Today at a glance — folders, sending, and what went out.</p>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${live ? 'var(--green)' : 'var(--mist-line)'}`,
            color: live ? 'var(--green)' : 'var(--mist)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? 'var(--green)' : 'var(--mist)', boxShadow: live ? '0 0 8px var(--green)' : 'none' }} />
          {live ? 'Live' : 'Preview'} · autopilot {health.autopilot}
        </span>
      </div>

      {/* ── STAT CARDS + cap progress ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <Stat value={sent} label="Sent today" accent />
        <Stat value={left} label="Left today" hint={`of ${cap} daily cap`} />
        <Stat value={health.autopilot === 'on' ? 'On' : 'Off'} label="Autopilot" />
        <Stat value={shadowToday.length} label="Drafts (preview)" />
      </div>
      {/* cap progress bar */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brass)', borderRadius: 999, transition: 'width .3s' }} />
        </div>
        <div className="text-muted" style={{ fontSize: 11.5, marginTop: 6 }}>{sent} of {cap} sent today · {left} remaining</div>
      </div>

      {/* ── FOLDERS ── */}
      <section style={{ marginBottom: 34 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
          <h2 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>Locations</h2>
          <span className="text-muted" style={{ fontSize: 11.5 }}>green dot = on · outreach runs only on these</span>
        </div>
        <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 16px', lineHeight: 1.6 }}>
          One folder per location and site. Open a folder to see its listings. The green dot turns it on or off — changes save on their own.
        </p>
        <SearchToggles />
      </section>

      {/* ── SEND ACTION ── */}
      <section style={{ marginBottom: 34, padding: '20px 22px', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 4px', fontWeight: 600 }}>Send requests now</h2>
          <p className="text-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
            Runs every location that&apos;s on, finds fresh listings, and sends one batch right away.
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <SendBatchButton />
        </div>
      </section>

      {/* ── FAILS (agar koi) ── */}
      {fails.length > 0 && (
        <div style={{ marginBottom: 26, padding: '13px 16px', border: '1px solid var(--rust)', borderRadius: 'var(--r-card)', background: 'rgba(196,53,26,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rust)', marginBottom: 6 }}>
            {fails.length} didn&apos;t go through today
          </div>
          {fails.slice(0, 5).map((f, i) => (
            <div key={i} className="text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              #{f.listing_id} · {f.status} · {timeOnly(f.created_at || f.time)}
            </div>
          ))}
        </div>
      )}

      {/* ── SENT TODAY LIST ── */}
      <section>
        <h2 style={{ fontSize: 18, margin: '0 0 14px', fontWeight: 600 }}>
          {live ? 'Sent today' : 'Drafts today'}
          <span className="text-muted" style={{ fontSize: 13, fontWeight: 400, marginLeft: 9 }}>{rows.length}</span>
        </h2>

        {rows.length === 0 ? (
          <div
            className="text-muted"
            style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13.5, border: '1px dashed var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)' }}
          >
            Nothing yet today. Hit <strong style={{ color: 'var(--paper)' }}>Send requests now</strong> above to start.
          </div>
        ) : (
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--surface)' }}>
            {rows.map((r, i) => {
              const l = byId.get(String(r.listing_id));
              const isRM = (l?.source || r.source) === 'rightmove';
              return (
                <a
                  key={i}
                  href={`/listing/${r.listing_id}`}
                  className="row-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--mist-line)', textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                  <span className="font-mono text-muted" style={{ fontSize: 11.5, width: 44, flexShrink: 0 }}>
                    {timeOnly(r.CreatedAt || r.built_at)}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.address || l?.address || l?.title || `#${r.listing_id}`}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 5, flexShrink: 0, marginLeft: 'auto', color: isRM ? '#8ec7ff' : 'var(--brass)', background: isRM ? 'rgba(90,160,255,.14)' : 'rgba(180,140,60,.14)' }}>
                    {isRM ? 'Rightmove' : 'OpenRent'}
                  </span>
                  <span className="font-mono text-muted" style={{ fontSize: 12.5, flexShrink: 0, minWidth: 62, textAlign: 'right' }}>
                    {l?.price ? `£${Number(l.price).toLocaleString('en-GB')}` : ''}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
