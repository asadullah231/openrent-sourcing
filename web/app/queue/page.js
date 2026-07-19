import { getDrafts, getSendLog, getSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Queue() {
  const [drafts, log, settings] = await Promise.all([getDrafts(), getSendLog(), getSettings()]);
  const live = settings.viewing?.mode === 'live';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="font-display" style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>
          Queue
        </h1>
        <span
          className="font-mono"
          style={{ fontSize: 12, color: live ? 'var(--rust)' : 'var(--brass)' }}
        >
          {live ? 'LIVE — sending' : 'SHADOW — drafts only'}
        </span>
      </div>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 28, fontSize: 13 }}>
        {live
          ? 'These requests go out from your account automatically.'
          : 'Review these before you switch to live. Nothing here has been sent.'}
      </p>

      <h2 className="font-display" style={{ fontSize: 22, marginBottom: 12 }}>
        Drafts
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {drafts.map((d, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--mist-line)',
              borderRadius: 'var(--r-card)',
              padding: '16px 18px',
              background: 'var(--ink-raise)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--paper)', fontWeight: 500, fontSize: 15 }}>
                {d.address}
              </a>
              <span className="font-mono text-muted" style={{ fontSize: 12 }}>
                score {d.score}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--paper)', opacity: 0.82, lineHeight: 1.6 }}>
              {d.message}
            </p>
          </div>
        ))}
        {drafts.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No drafts yet.</div>}
      </div>

      <h2 className="font-display" style={{ fontSize: 22, marginBottom: 12 }}>
        Sent log
      </h2>
      <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--ink-raise)' }}>
              {['Day', 'Mode', 'Property', 'Score', 'Status'].map((h) => (
                <th
                  key={h}
                  className="text-muted"
                  style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.map((x, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--mist-line)' }}>
                <td className="font-mono" style={{ padding: '10px 16px' }}>{x.day}</td>
                <td style={{ padding: '10px 16px', color: x.mode === 'live' ? 'var(--rust)' : 'var(--brass)' }}>{x.mode}</td>
                <td style={{ padding: '10px 16px' }}>{x.address}</td>
                <td className="font-mono" style={{ padding: '10px 16px' }}>{x.score}</td>
                <td className="font-mono text-muted" style={{ padding: '10px 16px' }}>{x.status ?? 'built'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {log.length === 0 && <div className="text-muted" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>Nothing sent yet.</div>}
      </div>
    </div>
  );
}
