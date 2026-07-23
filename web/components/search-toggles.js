'use client';

import { useEffect, useState } from 'react';

// Outreach page ka searches box (Asad, 23 Jul): SIRF list + ON/OFF.
//
// KYUN: Asad ne kaha "add-box aur Save changes yahan se hata do — jo Search
// page se save hoti hai bas wo yahan dikhe". Add karna sirf Search page se
// (paste → Save). Yahan Mo ka kaam ek hi hai: kisi search ko band ya chalu
// karna. Isi liye toggle dabate hi AUTO-SAVE ho jata hai — koi button nahi.
//
// SearchesManager (add + Save changes wala) ab Outreach pe use nahi hota;
// wo abhi bhi /searches route ke liye zinda hai.

// Link ko insaani zaban me: "2-4 bed · 3 mile · £1000–£4000"
function describe(params = {}) {
  const bits = [];
  const bMin = params.bedrooms_min ?? params.beds_min;
  const bMax = params.bedrooms_max ?? params.beds_max;
  if (bMin && bMax) bits.push(`${bMin}-${bMax} bed`);
  else if (bMin) bits.push(`${bMin}+ bed`);
  else if (bMax) bits.push(`up to ${bMax} bed`);
  if (params.area) bits.push(`${params.area} mile`);
  const pMax = params.prices_max ?? params.price_max;
  const pMin = params.prices_min ?? params.price_min;
  if (pMin && pMax) bits.push(`£${pMin}–£${pMax}`);
  else if (pMax) bits.push(`up to £${pMax}`);
  else if (pMin) bits.push(`from £${pMin}`);
  return bits.length ? bits.join(' · ') : 'no filters';
}

export function SearchToggles() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setStatus('error'));
  }, []);

  // Ek row badal kar foran server pe likho — Mo ko kuch dabana na pare.
  async function commit(nextAreas) {
    const next = { ...settings, areas: nextAreas };
    setSettings(next); // optimistic — UI foran badle
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        // Server params/naam bhar kar wapas deta hai — wahi rakho
        try {
          setSettings(await res.json());
        } catch {}
        setStatus('saved');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (!settings) {
    return <div className="text-muted" style={{ fontSize: 12.5 }}>Loading…</div>;
  }

  const searches = settings.areas || [];

  if (searches.length === 0) {
    return (
      <div
        className="text-muted"
        style={{
          fontSize: 12.5,
          padding: '18px 14px',
          border: '1px dashed var(--mist-line)',
          borderRadius: 'var(--r-ctrl)',
          textAlign: 'center',
        }}
      >
        No searches yet. Paste a link on the Search page and hit Save — it shows up here.
      </div>
    );
  }

  const toggle = (i, on) =>
    commit(searches.map((s, j) => (j === i ? { ...s, enabled: on } : s)));
  const remove = (i) => commit(searches.filter((_, j) => j !== i));

  return (
    <div>
      {searches.map((s, i) => {
        const on = s.enabled !== false;
        return (
          <div
            key={s.pastedUrl || s.slug || i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 13px',
              border: '1px solid var(--mist-line)',
              borderRadius: 'var(--r-ctrl)',
              marginBottom: 8,
              opacity: on ? 1 : 0.55,
            }}
          >
            <button
              onClick={() => toggle(i, !on)}
              title={on ? 'Turn off' : 'Turn on'}
              aria-label={on ? 'Turn off' : 'Turn on'}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: 'none',
                flexShrink: 0,
                cursor: 'pointer',
                padding: 0,
                background: on ? 'var(--green)' : 'var(--mist)',
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {s.name || s.slug || 'New search'}
              </div>
              <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                {s.params ? describe(s.params) : s.pastedUrl ? 'link (no filters read yet)' : 'legacy area (no link)'}
                {!on && ' · off'}
              </div>
            </div>
            {s.pastedUrl && (
              <a
                href={s.pastedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted"
                style={{ fontSize: 11.5, flexShrink: 0 }}
                title="Open on OpenRent"
              >
                open ↗
              </a>
            )}
            <button
              onClick={() => remove(i)}
              title="Remove"
              aria-label="Remove"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--mist)',
                cursor: 'pointer',
                fontSize: 15,
                lineHeight: 1,
                flexShrink: 0,
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}

      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 4 }}>
          Couldn&apos;t save that change — try again.
        </div>
      )}
    </div>
  );
}
