'use client';

import { useState } from 'react';

// Home page ka search bar — Mo apna OpenRent link paste kare aur FORAN result dekhe.
//
// KYUN (22 Jul, Asad): "search link ko yahan lagao taake wo directly yahan se
// search kare aur result dekh sake". Pehle Mo ko Settings me jana parta, link
// add karna parta, phir 30 min cron ka intezaar — tab pata chalta ke search
// theek thi ya nahi. Ab: paste → 7 sec → saamne.
//
// Do alag qadam, jaan boojh kar:
//   1. Search  — sirf dikhata hai, kuch save nahi hota. Jitna chaho aazmao.
//   2. Save    — tab ye search pakki hoti hai aur har cron pe chalti hai.
// Milane se Mo har aazmaish pe ghalti se search list bharta jata.

function describe(params = {}) {
  const bits = [];
  const bMin = params.bedrooms_min ?? params.beds_min;
  const bMax = params.bedrooms_max ?? params.beds_max;
  if (bMin && bMax) bits.push(`${bMin}-${bMax} bed`);
  else if (bMin) bits.push(`${bMin}+ bed`);
  else if (bMax) bits.push(`${bMax} bed tak`);
  if (params.area) bits.push(`${params.area} mile`);
  const pMax = params.prices_max ?? params.price_max;
  if (pMax) bits.push(`£${pMax} tak`);
  return bits.join(' · ');
}

export function SearchBar() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');

  async function run() {
    const v = url.trim();
    if (!v || busy) return;
    setBusy(true);
    setErr('');
    setRes(null);
    setSaved('');
    try {
      const r = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: v }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j?.error || 'Search nahi chali.');
      else setRes(j);
    } catch {
      // fetch khud fail ho (net gaya, ya route 30s me na nipta)
      setErr('Search nahi chali — dobara koshish karo.');
    }
    setBusy(false);
  }

  async function save() {
    if (!res) return;
    setSaved('saving');
    try {
      const r = await fetch('/api/search/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      setSaved(r.ok ? 'ok' : j?.error || 'Save nahi hui.');
    } catch {
      setSaved('Save nahi hui.');
    }
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="field"
          placeholder="OpenRent search ka link paste karo — result foran dikhega"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setErr('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          style={{ flex: 1, height: 42, borderRadius: 999, padding: '0 18px', fontSize: 13.5 }}
        />
        <button
          onClick={run}
          disabled={busy || !url.trim()}
          className="btn-brass"
          style={{ flexShrink: 0, borderRadius: 999, padding: '0 22px', height: 42 }}
        >
          {busy ? 'Chal raha hai…' : 'Search'}
        </button>
      </div>

      {err && (
        <div style={{ fontSize: 12.5, color: 'var(--rust)', marginTop: 10 }}>{err}</div>
      )}

      {busy && (
        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          OpenRent se poochh raha hoon… 5-10 second lagte hain.
        </div>
      )}

      {res && (
        <div
          style={{
            marginTop: 14,
            border: '1px solid var(--mist-line)',
            borderRadius: 'var(--r-tile)',
            padding: '14px 16px',
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{res.search?.name}</div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                {describe(res.search?.params) || 'koi filter nahi'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', alignItems: 'baseline' }}>
              <div>
                <span className="font-mono" style={{ fontSize: 19, fontWeight: 600 }}>
                  {res.matched}
                </span>
                <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>
                  mile
                </span>
              </div>
              {res.fresh != null && (
                <div>
                  <span
                    className="font-mono"
                    style={{ fontSize: 19, fontWeight: 600, color: 'var(--green)' }}
                  >
                    {res.fresh}
                  </span>
                  <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>
                    nayi
                  </span>
                </div>
              )}
            </div>

            {saved === 'ok' ? (
              <span style={{ fontSize: 12.5, color: 'var(--green)', flexShrink: 0 }}>
                ✓ Save ho gayi — ab har run pe chalegi
              </span>
            ) : (
              <button
                onClick={save}
                disabled={saved === 'saving'}
                className="btn-brass"
                style={{ flexShrink: 0, borderRadius: 999 }}
              >
                {saved === 'saving' ? 'Save ho raha…' : 'Save kar do'}
              </button>
            )}
          </div>

          {saved && saved !== 'ok' && saved !== 'saving' && (
            <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 8 }}>{saved}</div>
          )}

          {/* OpenRent ne jitni deen vs jitni filter pe poori utrin.
              Farq hamesha bara hota hai (OpenRent ke bed params kaam nahi karte),
              is liye Mo ko dikha dena behtar hai — warna wo sochega hum listings
              kha gaye. */}
          {res.total > res.matched && (
            <div className="text-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
              OpenRent ne {res.total} deen; {res.total - res.matched} aap ke filter pe
              poori nahi utrin (OpenRent ka apna bed filter server pe nahi chalta, hum
              khud lagate hain).
            </div>
          )}

          {res.listings?.length > 0 && (
            <>
              <div
                className="text-muted"
                style={{ fontSize: 11.5, margin: '14px 0 10px', paddingTop: 12, borderTop: '1px solid var(--mist-line)' }}
              >
                {/* fresh === null ka matlab "pata nahi chala" (store nahi khula),
                    NA ke "sab purani". Dono ko ek jaisa dikhana jhoot hai —
                    ye bug NocoDB ke ek timeout pe saamne aaya (22 Jul). */}
                {res.fresh == null
                  ? 'Store se milaa nahi ja saka — nayi/purani ka pata nahi'
                  : res.fresh > 0
                    ? 'Nayi wali pehle'
                    : 'Sab pehle se store me hain'}
                {res.matched > res.listings.length && ` · pehli ${res.listings.length} dikha raha hoon`}
                {' · photo aur pata bot enrich karne ke baad aata hai'}
              </div>

              {/* ⚠️ Yahan pehle ListingCard use kiya tha — GALAT tha (screenshot pe
                  pakra). Wo card photo + address dikhata hai, magar search page se
                  ye dono aate hi nahi (enrich.js baad me har listing ka apna page
                  khol kar laata hai). Nateeja: 60 khali "no photo" dabbe, aur har
                  card ka naam "Tower Hamlets" — kuch pata hi nahi chalta tha.
                  60 listings enrich karna bohot slow hai (har ek alag request).
                  Is liye preview wahi dikhata hai jo search page SE MILTA hai:
                  daam, beds/baths, aur kitni purani. Utna kaafi hai ye faisla
                  karne ke liye ke search theek hai ya nahi. */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: 8,
                }}
              >
                {res.listings.map((l) => (
                  <a
                    key={l.listing_id}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      padding: '9px 11px',
                      border: '1px solid var(--mist-line)',
                      borderRadius: 'var(--r-ctrl)',
                      background: 'var(--ink)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                    title="OpenRent pe kholo"
                  >
                    {l._isNew && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--green)',
                          flexShrink: 0,
                        }}
                        title="nayi — store me nahi thi"
                      />
                    )}
                    <span className="font-mono" style={{ fontSize: 13.5, fontWeight: 600 }}>
                      £{Number(l.price ?? 0).toLocaleString('en-GB')}
                    </span>
                    <span className="text-muted" style={{ fontSize: 11.5 }}>
                      {l.beds != null ? `${l.beds} bed` : ''}
                      {l.baths != null ? ` · ${l.baths} bath` : ''}
                    </span>
                    <span className="text-muted" style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>
                      {l.hours_live != null
                        ? l.hours_live < 24
                          ? `${l.hours_live}h`
                          : `${Math.round(l.hours_live / 24)}d`
                        : ''}
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}

          {res.matched === 0 && (
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              Is search se kuch nahi mila. Link me filters thora khol kar dekho.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
