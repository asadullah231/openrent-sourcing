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
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    setSaving(false);
    if (res.ok) {
      // Server links parse kar ke naam/params bhar deta hai — wahi wapas dikhao,
      // warna Mo ko "Naya — save karo" hi likha rehta aur wo samajhta ke bacha nahi.
      try {
        setS(await res.json());
      } catch {}
      setMsg('Saved. The bot picks this up on its next run.');
      return;
    }
    // Kharab link pe server asli wajah bhejta hai — wo dikhao, "Could not save" nahi
    let why = 'Could not save.';
    try {
      const j = await res.json();
      if (j?.error) why = j.error;
    } catch {}
    setMsg(why);
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
            {v.autopilot === 'on' ? 'On' : 'Off (paused)'}
          </button>
        </div>

        {/* Mode sirf dikhta hai, badalta nahi — dashboard khula hai (no login),
            aur live mode asli account se messages bhejta hai. */}
        <label style={label}>Mode</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            className="seg"
            style={{
              cursor: 'default',
              borderColor: live ? 'var(--rust)' : 'var(--brass)',
              color: live ? 'var(--rust)' : 'var(--brass)',
            }}
          >
            {live ? 'Live' : 'Shadow'}
          </span>
          <span className="text-muted" style={{ fontSize: 12 }}>
            Locked. Ask your developer to change this.
          </span>
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

      {/* Searches ab Outreach page pe hain (Asad, 23 Jul) — ek hi jagah, taake
          do jagah edit karne ki confusion na ho. Yahan sirf ishaara. */}
      <div style={section}>
        <span className="font-display" style={{ fontSize: 19, display: 'block', marginBottom: 4 }}>
          Searches
        </span>
        <p className="text-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
          Your saved searches and their on/off toggles now live on the{' '}
          <a href="/outreach" style={{ color: 'var(--brass)' }}>Outreach page</a>. Paste a link on
          the Search page, hit Save, and it appears there.
        </p>
      </div>

      {/* Message */}
      <div style={section}>
        <span className="font-display" style={{ fontSize: 19, display: 'block', marginBottom: 16 }}>
          The message
        </span>
        <label style={label}>When you&apos;re free</label>
        <input className="field" value={v.availabilityText || ''} onChange={(e) => setV({ availabilityText: e.target.value })} style={{ marginBottom: 16 }} />
        <label style={label}>
          Template{' '}
          <span className="text-muted" style={{ fontWeight: 400 }}>
            · these fill in per property
          </span>
        </label>
        <div className="text-muted" style={{ fontSize: 11.5, lineHeight: 1.7, marginBottom: 8 }}>
          <code>{'{greeting}'}</code> Hi Kate, (or just &quot;Hi,&quot; if the name isn&apos;t listed) ·{' '}
          <code>{'{name}'}</code> Kate · <code>{'{beds}'}</code> 2-bed ·{' '}
          <code>{'{area}'}</code> Tower Hamlets · <code>{'{place}'}</code> Digby Street, E2 ·{' '}
          <code>{'{price}'}</code> £2,000 · <code>{'{availability}'}</code>
        </div>
        <textarea
          className="field"
          style={{ height: 200, resize: 'vertical', lineHeight: 1.6 }}
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
          {/* Beds/price ke dabbe yahan se hata diye (22 Jul).
              Wajah: ab ye har search ke apne LINK me hote hain. Dono jagah
              rakhne se Mo ka link "2-4 bed" kehta aur ye dabba "3-5" — phir
              kaunsa chalta? Ek hi jagah rehne do: link. */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div
              className="text-muted"
              style={{
                fontSize: 12,
                padding: '10px 12px',
                border: '1px solid var(--mist-line)',
                borderRadius: 'var(--r-ctrl)',
                lineHeight: 1.6,
              }}
            >
              Beds, radius and rent now live inside each search&apos;s own link (Searches above).
              To change them, build a new search on OpenRent and paste its link.
            </div>
          </div>
          <div>
            <label style={label}>Max rent £/mo <span className="text-muted" style={{ fontWeight: 400 }}>· all searches</span></label>
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
