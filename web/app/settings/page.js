'use client';

import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setS);
  }, []);

  if (!s) return <div className="text-muted">Loading…</div>;

  const v = s.viewing || {};
  const setV = (patch) => setS({ ...s, viewing: { ...v, ...patch } });
  const setF = (patch) => setS({ ...s, filters: { ...(s.filters || {}), ...patch } });

  async function save() {
    let confirmLive = false;
    if (v.mode === 'live') {
      confirmLive = window.confirm(
        'Switch to live? The bot will send real viewing requests from your account. This cannot be undone per property.'
      );
      if (!confirmLive) return;
    }
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, confirmLive }),
    });
    setSaving(false);
    setMsg(res.ok ? 'Saved. The bot picks this up on its next run.' : 'Could not save.');
  }

  const label = { fontSize: 12.5, fontWeight: 500, display: 'block', marginBottom: 6, color: 'var(--paper)' };
  const section = {
    border: '1px solid var(--mist-line)',
    borderRadius: 'var(--r-tile)',
    padding: 22,
    marginBottom: 22,
  };
  const live = v.mode === 'live';

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="font-display" style={{ fontSize: 40, margin: '0 0 6px', lineHeight: 1 }}>
        Settings
      </h1>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 28, fontSize: 13 }}>
        Change anything here and the bot uses it on its next run.
      </p>

      {/* Autopilot + mode */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span className="font-display" style={{ fontSize: 19 }}>
            Autopilot
          </span>
          <button
            onClick={() => setV({ autopilot: v.autopilot === 'on' ? 'off' : 'on' })}
            className="seg"
            style={
              v.autopilot === 'on'
                ? { borderColor: 'var(--green)', color: 'var(--green)' }
                : {}
            }
          >
            {v.autopilot === 'on' ? 'On' : 'Off — paused'}
          </button>
        </div>

        <label style={label}>Mode</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['shadow', 'Shadow', 'var(--brass)'],
            ['live', 'Live', 'var(--rust)'],
          ].map(([m, txt, c]) => (
            <button
              key={m}
              onClick={() => setV({ mode: m })}
              className="seg"
              style={v.mode === m ? { borderColor: c, color: c } : {}}
            >
              {txt}
            </button>
          ))}
        </div>
        {live && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 'var(--r-card)',
              border: '1px solid var(--rust)',
              background: 'rgba(181,83,60,0.09)',
              fontSize: 12.5,
              color: 'var(--paper)',
            }}
          >
            Live sends real requests from your account. The viewing form is one-shot per property, so keep the daily cap low while you watch it.
          </div>
        )}
      </div>

      {/* Message */}
      <div style={section}>
        <span className="font-display" style={{ fontSize: 19, display: 'block', marginBottom: 16 }}>
          The message
        </span>
        <label style={label}>When you&apos;re free</label>
        <input className="field" value={v.availabilityText || ''} onChange={(e) => setV({ availabilityText: e.target.value })} style={{ marginBottom: 16 }} />
        <label style={label}>
          Template <span className="text-muted" style={{ fontWeight: 400 }}>· {'{place}'} and {'{availability}'} fill in automatically</span>
        </label>
        <textarea
          className="field"
          style={{ height: 96, resize: 'vertical', lineHeight: 1.6 }}
          value={v.messageTemplate || ''}
          onChange={(e) => setV({ messageTemplate: e.target.value })}
        />
      </div>

      {/* Gates */}
      <div style={section}>
        <span className="font-display" style={{ fontSize: 19, display: 'block', marginBottom: 16 }}>
          Filters &amp; limits
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Send above score</label>
            <input type="number" className="field" value={v.minScore ?? 65} onChange={(e) => setV({ minScore: Number(e.target.value) })} />
          </div>
          <div>
            <label style={label}>Requests per day</label>
            <input type="number" className="field" value={v.dailyCap ?? 15} onChange={(e) => setV({ dailyCap: Number(e.target.value) })} />
          </div>
          <div>
            <label style={label}>Beds (min)</label>
            <input type="number" className="field" value={s.filters?.bedsMin ?? 2} onChange={(e) => setF({ bedsMin: Number(e.target.value) })} />
          </div>
          <div>
            <label style={label}>Beds (max)</label>
            <input type="number" className="field" value={s.filters?.bedsMax ?? 4} onChange={(e) => setF({ bedsMax: Number(e.target.value) })} />
          </div>
          <div>
            <label style={label}>Max rent £/mo</label>
            <input type="number" className="field" placeholder="no cap" value={s.filters?.priceMax ?? ''} onChange={(e) => setF({ priceMax: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label style={label}>Alert above score</label>
            <input type="number" className="field" value={s.alertThreshold ?? 55} onChange={(e) => setS({ ...s, alertThreshold: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={save} disabled={saving} className="btn-brass">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {msg && <span className="text-muted" style={{ fontSize: 13 }}>{msg}</span>}
      </div>
    </div>
  );
}
