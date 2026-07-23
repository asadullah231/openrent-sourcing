'use client';

import { useState } from 'react';
import { ListingCard } from './listing-card';

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
  else if (bMax) bits.push(`up to ${bMax} bed`);
  if (params.area) bits.push(`${params.area} mile`);
  const pMax = params.prices_max ?? params.price_max;
  if (pMax) bits.push(`up to £${pMax}`);
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
          placeholder="Paste an OpenRent search link — results show instantly"
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
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>

      {err && (
        <div style={{ fontSize: 12.5, color: 'var(--rust)', marginTop: 10 }}>{err}</div>
      )}

      {busy && (
        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          Asking OpenRent… takes 5-10 seconds.
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
                {describe(res.search?.params) || 'no filters'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', alignItems: 'baseline' }}>
              <div>
                <span className="font-mono" style={{ fontSize: 19, fontWeight: 600 }}>
                  {res.matched}
                </span>
                <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>
                  matched
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
                    new
                  </span>
                </div>
              )}
            </div>

            {saved === 'ok' ? (
              <span style={{ fontSize: 12.5, color: 'var(--green)', flexShrink: 0 }}>
                ✓ Saved — runs on every batch now
              </span>
            ) : (
              <button
                onClick={save}
                disabled={saved === 'saving'}
                className="btn-brass"
                style={{ flexShrink: 0, borderRadius: 999 }}
              >
                {saved === 'saving' ? 'Saving…' : 'Save this search'}
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
              OpenRent returned {res.total}; {res.total - res.matched} didn&apos;t match your
              filters (OpenRent&apos;s own bed filter doesn&apos;t run server-side, so we apply it).
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
                  ? "Couldn't check the store — new/seen unknown"
                  : res.fresh > 0
                    ? 'New ones first'
                    : 'All already in the store'}
                {res.matched > res.listings.length &&
                  ` · top ${res.listings.length} with full detail`}
              </div>

              {/* Upar wali 12 — poore photo cards, bilkul neeche "Worth a look"
                  jaise (Asad: "yani aisa show ho jab me link paste karun wahan").
                  Ye is liye mumkin hua ke enrich naapa: 6 listings parallel me
                  1.5 sec. Pehle andaza tha ke bohot mehnga hai — ghalat tha. */}
              <div className="grid-cards">
                {res.listings.map((l) => (
                  <div key={l.listing_id} style={{ position: 'relative' }}>
                    {/* Source badge — ye listing OpenRent se aayi. Asad (23 Jul):
                        "new" ki jagah source "OpenRent". Har card pe lagta hai
                        (sabhi OpenRent se hain), _isNew pe nahi. */}
                    <span
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        zIndex: 2,
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: 'rgba(0,0,0,.6)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)',
                        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
                      }}
                    >
                      OpenRent
                    </span>
                    <ListingCard l={l} />
                  </div>
                ))}
              </div>

              {/* Baqi 48 — patli list. Inhe enrich nahi kiya (60 requests ek dam
                  us hi account se jata hai jis se bot messages bhejta hai; 429
                  khana bohot mehnga sauda hai sirf preview ke liye). */}
              {res.more?.length > 0 && (
                <>
                  <div
                    className="text-muted"
                    style={{ fontSize: 11.5, margin: '18px 0 8px' }}
                  >
                    {res.more.length} more, without photos (the bot enriches these on its run)
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 6,
                    }}
                  >
                    {res.more.map((l) => (
                      <a
                        key={l.listing_id}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 7,
                          padding: '7px 10px',
                          border: '1px solid var(--mist-line)',
                          borderRadius: 'var(--r-ctrl)',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                        title="Open on OpenRent"
                      >
                        {l._isNew && (
                          <span
                            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }}
                          />
                        )}
                        <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                          £{Number(l.price ?? 0).toLocaleString('en-GB')}
                        </span>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          {l.beds != null ? `${l.beds} bed` : ''}
                        </span>
                        <span className="text-muted" style={{ fontSize: 10.5, marginLeft: 'auto', flexShrink: 0 }}>
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
            </>
          )}

          {res.matched === 0 && (
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              Nothing matched this search. Try loosening the filters in the link.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
