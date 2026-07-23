'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Outreach page ke location "folders" (Asad, 23 Jul): Google Drive jaise folder
// tiles. Har saved search = ek folder. Tile pe folder icon + naam + count;
// corner me chhota on/off dot + ✕. Click → us location ka folder page
// (/searches/view?area=<name>) jahan uski saari listings.
//
// Add/edit yahan nahi — Search page se (paste → Save & start outreach). Yahan
// Mo sirf folder kholta, band/chalu karta, ya hata sakta hai. Toggle/delete
// dabate hi AUTO-SAVE (koi button nahi).

function describe(params = {}) {
  const bits = [];
  const bMin = params.bedrooms_min ?? params.beds_min;
  const bMax = params.bedrooms_max ?? params.beds_max;
  if (bMin && bMax) bits.push(`${bMin}-${bMax} bed`);
  else if (bMin) bits.push(`${bMin}+ bed`);
  else if (bMax) bits.push(`up to ${bMax} bed`);
  if (params.area) bits.push(`${params.area} mi`);
  const pMax = params.prices_max ?? params.price_max;
  if (pMax) bits.push(`£${pMax}`);
  return bits.join(' · ');
}

// Google Drive style folder icon
function FolderIcon({ off }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2c.4 0 .78.16 1.06.44L11 7h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z"
        fill={off ? 'var(--mist-line)' : 'var(--brass)'}
        opacity={off ? 0.5 : 1}
      />
    </svg>
  );
}

export function SearchToggles() {
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState(null); // areaLower -> { total, sent }
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setStatus('error'));

    // Per-location count (folder pe "12 · 6 sent"). Store se; fail ho to
    // sirf count na dikhe — folders phir bhi kaam karein.
    fetch('/api/listings')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.listings || data.list || [];
        const m = {};
        for (const l of list) {
          const k = (l.area || '').trim().toLowerCase();
          if (!k) continue;
          if (!m[k]) m[k] = { total: 0, sent: 0 };
          m[k].total++;
          if (l.viewing_status === 'requested') m[k].sent++;
        }
        setCounts(m);
      })
      .catch(() => setCounts({}));
  }, []);

  async function commit(nextAreas) {
    const next = { ...settings, areas: nextAreas };
    setSettings(next);
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        try {
          setSettings(await res.json());
        } catch {}
        setStatus('saved');
      } else setStatus('error');
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
          padding: '22px 14px',
          border: '1px dashed var(--mist-line)',
          borderRadius: 'var(--r-tile)',
          textAlign: 'center',
        }}
      >
        No folders yet. Paste a link on the Search page and hit “Save &amp; start outreach” — it shows up here as a folder.
      </div>
    );
  }

  const toggle = (i, on) => commit(searches.map((s, j) => (j === i ? { ...s, enabled: on } : s)));
  const remove = (i) => commit(searches.filter((_, j) => j !== i));

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 12,
        }}
      >
        {searches.map((s, i) => {
          const on = s.enabled !== false;
          const name = s.name || s.slug || 'New search';
          const c = counts ? counts[name.trim().toLowerCase()] : null;
          const sub = s.params ? describe(s.params) : s.pastedUrl ? 'link' : 'legacy';

          return (
            <div
              key={s.pastedUrl || s.slug || i}
              style={{
                position: 'relative',
                border: '1px solid var(--mist-line)',
                borderRadius: 'var(--r-tile)',
                background: 'var(--surface-2)',
                opacity: on ? 1 : 0.6,
                overflow: 'hidden',
              }}
            >
              {/* corner controls — dot (on/off) + ✕ (delete) */}
              <div style={{ position: 'absolute', top: 9, right: 9, display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
                <button
                  onClick={() => toggle(i, !on)}
                  title={on ? 'Turn off' : 'Turn on'}
                  aria-label={on ? 'Turn off' : 'Turn on'}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    background: on ? 'var(--green)' : 'var(--mist)',
                  }}
                />
                <button
                  onClick={() => remove(i)}
                  title="Remove folder"
                  aria-label="Remove folder"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--mist)',
                    cursor: 'pointer',
                    fontSize: 15,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* poora folder click → andar (folder view) */}
              <Link
                href={`/searches/view?area=${encodeURIComponent(name)}`}
                style={{ display: 'block', padding: '16px 14px 14px', textDecoration: 'none', color: 'inherit' }}
                title="Open this location's outreach folder"
              >
                <FolderIcon off={!on} />
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                <div className="text-muted" style={{ fontSize: 11, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c
                    ? `${c.total} listing${c.total === 1 ? '' : 's'}${c.sent ? ` · ${c.sent} sent` : ''}`
                    : sub}
                  {!on && ' · off'}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 10 }}>
          Couldn&apos;t save that change — try again.
        </div>
      )}
    </div>
  );
}
