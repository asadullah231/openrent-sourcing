'use client';

import { useState } from 'react';

// Mo ki searches — poore OpenRent link paste kar ke.
//
// KYUN (22 Jul): asli tareeqa-e-kaar ye hai ke Mo PEHLE khud OpenRent pe search
// banata hai (area, radius, beds), phir chahta hai ke bot wahi search chalata
// rahe. Pehle areas code me likhe thay aur Mo unhe chhu bhi nahi sakta tha.
//
// Link paste karne ka faida ye ke OpenRent ke saare filters muft me mil jate
// hain — radius (area=3), beds, price, aur kal ko jo bhi wo add karein. Hamein
// har filter ke liye alag dabba banane ki zaroorat nahi.

// Link ko insaani zaban me dikhao: "2-4 bed · 3 mile · £2,500 tak"
function describe(params = {}) {
  const bits = [];
  const bMin = params.bedrooms_min ?? params.beds_min;
  const bMax = params.bedrooms_max ?? params.beds_max;
  if (bMin && bMax) bits.push(`${bMin}-${bMax} bed`);
  else if (bMin) bits.push(`${bMin}+ bed`);
  else if (bMax) bits.push(`up to ${bMax} bed`);

  // `area` OpenRent ka radius hai (miles me, unke apne search box ke mutabiq)
  if (params.area) bits.push(`${params.area} mile`);

  const pMax = params.prices_max ?? params.price_max;
  const pMin = params.prices_min ?? params.price_min;
  if (pMin && pMax) bits.push(`£${pMin}–£${pMax}`);
  else if (pMax) bits.push(`up to £${pMax}`);
  else if (pMin) bits.push(`from £${pMin}`);

  return bits.length ? bits.join(' · ') : 'no filters';
}

export function SearchList({ searches = [], onChange }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');

  function add() {
    const v = url.trim();
    if (!v) return;
    // Asal parsing server pe hoti hai (wahi parser jo bot use karta hai).
    // Yahan sirf itna dekho ke saaf ghalat cheez foran pakri jaye.
    if (!/openrent\.co\.uk/i.test(v)) {
      setErr("That doesn't look like an OpenRent link.");
      return;
    }
    if (searches.some((s) => s.pastedUrl === v)) {
      setErr('This search is already in the list.');
      return;
    }
    setErr('');
    // name/params server bhar dega jab save hoga.
    //
    // ⚠️ Yahan pehle `name: 'Naya — save karo'` daala tha. Wo bug tha: server
    // Mo ka diya naam rakhta hai (`a.name || link se`), aur placeholder bhi ek
    // asli string hai — to wo jeet jata aur save ke BAAD bhi "Naya — save karo"
    // hi likha rehta. Naam bilkul na bhejo; neeche row khud "Save karo…" dikha
    // deti hai jab tak params nahi aate.
    onChange([...searches, { pastedUrl: v, enabled: true }]);
    setUrl('');
  }

  const patch = (i, p) => onChange(searches.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const remove = (i) => onChange(searches.filter((_, j) => j !== i));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <input
          className="field"
          placeholder="Paste the full OpenRent search link here"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setErr('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          style={{ flex: 1 }}
        />
        <button onClick={add} className="btn-brass" style={{ flexShrink: 0 }}>
          Add
        </button>
      </div>

      {err ? (
        <div style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 12 }}>{err}</div>
      ) : (
        <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 14, lineHeight: 1.6 }}>
          Search on OpenRent (area, radius, beds), then paste the full address-bar link here.
          Only the filters in the link are applied.
        </div>
      )}

      {searches.length === 0 && (
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
          No searches yet. Paste a link and the bot will monitor it.
        </div>
      )}

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
              onClick={() => patch(i, { enabled: !on })}
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
                {/* Abhi add hua aur save nahi hua: naam/params server se aayenge */}
                {s.name || s.slug || 'New search'}
              </div>
              <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                {s.params
                  ? describe(s.params)
                  : s.pastedUrl
                    ? 'Save to see its filters here'
                    : 'legacy area (no link)'}
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
    </div>
  );
}
