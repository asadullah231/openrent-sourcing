'use client';

import { useEffect, useState } from 'react';
import { Save, AlertTriangle, Power } from 'lucide-react';

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setS);
  }, []);

  if (!s) return <div className="text-muted">Loading settings…</div>;

  const v = s.viewing || {};
  const setV = (patch) => setS({ ...s, viewing: { ...v, ...patch } });
  const setF = (patch) => setS({ ...s, filters: { ...(s.filters || {}), ...patch } });

  async function save() {
    // Live switch pe confirm — one-shot form, asli requests jayengi
    let confirmLive = false;
    if (v.mode === 'live') {
      confirmLive = window.confirm(
        'LIVE mode on kar rahe ho. Bot asli viewing requests bhejega (undo nahi). Pakka?'
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
    setMsg(res.ok ? 'Saved ✅ — bot agle run pe naye settings utha lega' : 'Save failed');
  }

  const input = 'w-full rounded-md border border-border bg-card px-3 py-2 text-sm';
  const label = 'text-sm font-medium block mb-1';

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Bot ka poora control — yahan se badlo, bot turant utha leta hai.</p>
      </div>

      {/* KILL SWITCH + MODE */}
      <section className="rounded-lg border border-border p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Power className="h-4 w-4" /> Autopilot
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setV({ autopilot: v.autopilot === 'on' ? 'off' : 'on' })}
            className={`px-4 py-2 rounded-md text-sm font-medium border ${
              v.autopilot === 'on' ? 'bg-green-500/15 border-green-500 text-green-500' : 'border-border text-muted'
            }`}
          >
            {v.autopilot === 'on' ? 'ON' : 'OFF (kill switch)'}
          </button>
          <div className="flex gap-2">
            {['shadow', 'live'].map((m) => (
              <button
                key={m}
                onClick={() => setV({ mode: m })}
                className={`px-4 py-2 rounded-md text-sm font-medium border ${
                  v.mode === m
                    ? m === 'live'
                      ? 'bg-red-500/15 border-red-500 text-red-500'
                      : 'bg-amber-500/15 border-amber-500 text-amber-500'
                    : 'border-border text-muted'
                }`}
              >
                {m === 'live' ? '🔴 Live' : '🟡 Shadow'}
              </button>
            ))}
          </div>
        </div>
        {v.mode === 'live' && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded-md p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            Live me bot asli viewing requests bhejega (form one-shot, undo nahi). Cap chhota rakho.
          </div>
        )}
      </section>

      {/* MESSAGE TEMPLATE */}
      <section className="rounded-lg border border-border p-5 space-y-4">
        <h2 className="font-semibold">Viewing message</h2>
        <div>
          <label className={label}>Availability text</label>
          <input className={input} value={v.availabilityText || ''} onChange={(e) => setV({ availabilityText: e.target.value })} />
        </div>
        <div>
          <label className={label}>Message template <span className="text-muted font-normal">({'{place}'}, {'{availability}'} auto-fill)</span></label>
          <textarea
            className={`${input} h-28`}
            value={v.messageTemplate || ''}
            onChange={(e) => setV({ messageTemplate: e.target.value })}
          />
        </div>
      </section>

      {/* GATES */}
      <section className="rounded-lg border border-border p-5 grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Min score (viewing bar)</label>
          <input type="number" className={input} value={v.minScore ?? 65} onChange={(e) => setV({ minScore: Number(e.target.value) })} />
        </div>
        <div>
          <label className={label}>Daily cap</label>
          <input type="number" className={input} value={v.dailyCap ?? 15} onChange={(e) => setV({ dailyCap: Number(e.target.value) })} />
        </div>
        <div>
          <label className={label}>Beds min</label>
          <input type="number" className={input} value={s.filters?.bedsMin ?? 2} onChange={(e) => setF({ bedsMin: Number(e.target.value) })} />
        </div>
        <div>
          <label className={label}>Beds max</label>
          <input type="number" className={input} value={s.filters?.bedsMax ?? 4} onChange={(e) => setF({ bedsMax: Number(e.target.value) })} />
        </div>
        <div>
          <label className={label}>Max rent (£/mo, khaali = koi cap nahi)</label>
          <input type="number" className={input} value={s.filters?.priceMax ?? ''} onChange={(e) => setF({ priceMax: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div>
          <label className={label}>Alert threshold</label>
          <input type="number" className={input} value={s.alertThreshold ?? 55} onChange={(e) => setS({ ...s, alertThreshold: Number(e.target.value) })} />
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
