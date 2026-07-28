'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Outreach page ke location "folders" (Asad, 23 Jul): Google Drive jaise folder
// tiles. Har saved search = ek folder. Tile pe folder icon + naam + count;
// corner me chhota on/off dot. Click → us location ka folder page
// (/searches/view?area=<name>) jahan uski saari listings.
//
// Add/edit yahan nahi — Search page se (paste → Save & start outreach). Yahan
// Mo sirf folder kholta ya band/chalu karta hai. Toggle dabate hi AUTO-SAVE.
//
// EK LOCATION = EK FOLDER (Asad, 23 Jul: "duplicate remove kro"). Purane
// settings me ek hi location kai dafa saved ho sakti hai (pehle dedup key me
// runtime params they). Yahan naam pe dedup karke ek hi folder dikhate hain —
// pehla wala rakh lete hain, baqi chhupa dete hain.

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

// ⋯ dropdown menu item ka style (rename/delete/toggle sab isi shakl me).
const menuItemStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 500,
  border: 'none',
  borderBottom: '1px solid var(--mist-line)',
  background: 'transparent',
  color: 'var(--paper)',
  cursor: 'pointer',
};

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

// Ek folder ki dedup/delete key — data.js ke areaKey se match honi chahiye
// (source|slug-or-name|sorted-params). Delete ke waqt yehi key server ko bhejte.
function areaKeyOf(a) {
  const IGNORE = new Set(['isLive', 'viewingProperty', 'viewingproperty', 'index']);
  const p = new URLSearchParams();
  Object.entries(a?.params || {})
    .filter(([k]) => !IGNORE.has(k))
    .sort(([x], [y]) => x.localeCompare(y))
    .forEach(([k, v]) => p.set(k, v));
  return `${a?.source || 'openrent'}|${a?.slug || a?.name || ''}|${p.toString()}`;
}

export function SearchToggles() {
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState(null); // areaLower -> { total, sent }
  const [status, setStatus] = useState('');
  const [menuFor, setMenuFor] = useState(null);   // kis folder ka ⋯ menu khula
  const [renaming, setRenaming] = useState(null);  // { idx, value }

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setStatus('error'));

    // Per-folder count (folder pe "12 · 6 sent"). Ab key = SOURCE|area, taake
    // OpenRent aur Rightmove ke Croydon ki ginti alag rahe (mix na ho). Store
    // se; fail ho to sirf count na dikhe — folders phir bhi kaam karein.
    fetch('/api/listings')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.listings || data.list || [];
        const m = {};
        for (const l of list) {
          const area = (l.area || '').trim().toLowerCase();
          if (!area) continue;
          const k = `${l.source || 'openrent'}|${area}`;
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

  // RENAME — folder ke saare duplicate entries (allIdx) ka naam ek saath badlo,
  // taake hidden twin bhi update ho (warna bot purane naam pe scrape karta rahe).
  async function renameFolder(allIdx, newName) {
    const nm = (newName || '').trim();
    if (!nm) return;
    const set = new Set(allIdx);
    const all = settings.areas || [];
    await commit(all.map((s, j) => (set.has(j) ? { ...s, name: nm } : s)));
    setRenaming(null);
    setMenuFor(null);
  }

  // DELETE — folder ke saare entries hatao. _deleteKeys server ko bhejte hain
  // (data.js saveSettings sirf inhi keys wale areas girata, baqi safe).
  async function deleteFolder(allIdx) {
    const all = settings.areas || [];
    const keys = [...new Set(allIdx.map((j) => areaKeyOf(all[j])))];
    // baqi areas (jo delete nahi) — inhe bhejo taake merge-by-key inhe rakhe.
    const keep = all.filter((_, j) => !allIdx.includes(j));
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, areas: keep, _deleteKeys: keys }),
      });
      if (res.ok) {
        try { setSettings(await res.json()); } catch {}
        setStatus('saved');
      } else setStatus('error');
    } catch { setStatus('error'); }
    setMenuFor(null);
  }

  if (!settings) {
    return <div className="text-muted" style={{ fontSize: 12.5 }}>Loading…</div>;
  }

  // Folder dedup DISPLAY ke liye SOURCE + NAAM pe (params ignore).
  //
  // 🐛 (23 Jul, Asad ne screenshot bheja: 3 "Tower Hamlets" folders): purani
  // settings me ek hi location ke thode-alag-params wale entries pade hain (jaise
  // ek me viewingProperty:16 tha). Full areaKey (params samet) unhe alag samajh
  // kar teen tile bana deta. Mo ke liye "ek location = ek folder" — is liye yahan
  // sirf source+naam pe dedup. On/off toggle phir bhi sahi row (asli index) pe
  // lagta hai; agar ek naam ke kai entries hon to sab ka enabled ek saath badal
  // jata hai (neeche allIdx), taake bot ke us naam ke saare duplicates ek jaisa
  // chalein/rukein — koi chhupa hua "on" twin peeche na reh jaye.
  const dispKey = (s) => `${s?.source || 'openrent'}|${(s?.name || s?.slug || '').trim().toLowerCase()}`;
  const groups = new Map(); // dispKey -> { s, i, allIdx:[...] }
  (settings.areas || []).forEach((s, i) => {
    const k = dispKey(s);
    if (groups.has(k)) groups.get(k).allIdx.push(i);
    else groups.set(k, { s, i, allIdx: [i] });
  });
  const searches = [...groups.values()];

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

  // toggle folder ke SAARE asli index (allIdx) pe lagta hai — agar ek naam ke
  // kai duplicate entries hon to sab ek saath on/off, koi hidden "on" twin peeche
  // na reh jaye (jo bot phir bhi scrape karta).
  const all = settings.areas || [];
  const toggle = (allIdx, on) => {
    const set = new Set(allIdx);
    commit(all.map((s, j) => (set.has(j) ? { ...s, enabled: on } : s)));
  };

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 12,
        }}
      >
        {searches.map(({ s, i, allIdx }) => {
          // Group me koi bhi entry "on" ho to folder on (taake hidden twin sach dikhe).
          const on = allIdx.some((j) => all[j]?.enabled !== false);
          const name = s.name || s.slug || 'New search';
          const source = s.source || 'openrent';
          const isRM = source === 'rightmove';
          const c = counts ? counts[`${source}|${name.trim().toLowerCase()}`] : null;
          // sub: filter summary; crossed (bot ne khud banayi) pe "auto".
          const sub = s.params ? describe(s.params) : s.crossed ? 'auto' : s.pastedUrl ? 'link' : 'saved';

          return (
            <div
              key={`${source}|${name.toLowerCase()}|${i}`}
              style={{
                position: 'relative',
                border: '1px solid var(--mist-line)',
                borderRadius: 'var(--r-tile)',
                background: 'var(--surface-2)',
                opacity: on ? 1 : 0.6,
                overflow: 'hidden',
              }}
            >
              {/* corner control — on/off dot + ⋯ menu (rename / delete / toggle) */}
              <div style={{ position: 'absolute', top: 9, right: 9, zIndex: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => toggle(allIdx, !on)}
                  title={on ? 'Turn off' : 'Turn on'}
                  aria-label={on ? 'Turn off' : 'Turn on'}
                  style={{
                    width: 11, height: 11, borderRadius: '50%', border: 'none',
                    cursor: 'pointer', padding: 0, background: on ? 'var(--green)' : 'var(--mist)',
                  }}
                />
                <button
                  onClick={(e) => { e.preventDefault(); setMenuFor(menuFor === i ? null : i); }}
                  title="More"
                  aria-label="More options"
                  style={{
                    width: 20, height: 20, borderRadius: 6, border: 'none', cursor: 'pointer',
                    padding: 0, background: 'transparent', color: 'var(--mist)',
                    fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ⋯
                </button>
              </div>

              {/* ⋯ dropdown menu */}
              {menuFor === i && (
                <>
                  {/* backdrop — bahar click se band */}
                  <div
                    onClick={(e) => { e.preventDefault(); setMenuFor(null); }}
                    style={{ position: 'fixed', inset: 0, zIndex: 8 }}
                  />
                  <div
                    style={{
                      position: 'absolute', top: 28, right: 9, zIndex: 9, minWidth: 150,
                      background: 'var(--surface)', border: '1px solid var(--mist-line)',
                      borderRadius: 10, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={(e) => { e.preventDefault(); setRenaming({ idx: i, allIdx, value: name }); setMenuFor(null); }}
                      style={menuItemStyle}
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); toggle(allIdx, !on); setMenuFor(null); }}
                      style={menuItemStyle}
                    >
                      {on ? 'Turn off' : 'Turn on'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm(`Delete “${name}”? Its outreach will stop. This can’t be undone.`)) deleteFolder(allIdx);
                      }}
                      style={{ ...menuItemStyle, color: 'var(--rust)' }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}

              {/* poora folder click → andar (folder view). Ab source bhi bhejo,
                  taake folder page sirf us site ki listings dikhaye (mix na ho). */}
              <Link
                href={`/searches/view?area=${encodeURIComponent(name)}&source=${source}`}
                style={{ display: 'block', padding: '16px 14px 14px', textDecoration: 'none', color: 'inherit' }}
                title={`Open this ${isRM ? 'Rightmove' : 'OpenRent'} folder`}
              >
                <FolderIcon off={!on} />
                {/* Source badge — folder OpenRent ka hai ya Rightmove ka. Rang se
                    bhi farq (Rightmove = blue-ish, OpenRent = brass). */}
                <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: 5,
                      color: isRM ? '#8ec7ff' : 'var(--brass)',
                      background: isRM ? 'rgba(90,160,255,.14)' : 'rgba(180,140,60,.14)',
                    }}
                  >
                    {isRM ? 'Rightmove' : 'OpenRent'}
                  </span>
                </div>
                {renaming?.idx === i ? (
                  <input
                    autoFocus
                    defaultValue={renaming.value}
                    onClick={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); renameFolder(renaming.allIdx, e.currentTarget.value); }
                      if (e.key === 'Escape') { e.preventDefault(); setRenaming(null); }
                    }}
                    onBlur={(e) => renameFolder(renaming.allIdx, e.currentTarget.value)}
                    style={{
                      marginTop: 6, width: '100%', fontSize: 14, fontWeight: 600,
                      padding: '4px 6px', borderRadius: 6, border: '1px solid var(--brass)',
                      background: 'var(--surface)', color: 'var(--paper)', outline: 'none',
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                )}
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
