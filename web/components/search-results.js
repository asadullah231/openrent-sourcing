'use client';

import { useEffect, useState } from 'react';
import { ListingCard } from './listing-card';

// Ek saved search ke result gallery view me (Asad, 23 Jul): "search open karun
// to naya page khule jahan is search ke saare result gallery me dikhein — jis
// ki outreach chal rahi hai."
//
// Ye wahi /api/search chalata hai jo Search page ka bar chalata hai, bas yahan
// url prop se aata hai (saved search ka pastedUrl) aur khud fetch hota hai —
// koi paste-bar nahi. Gallery ka layout Search bar wale se milta-julta hai
// taake ek jaisa lage.

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
  return bits.join(' · ');
}

export function SearchResults({ url }) {
  const [busy, setBusy] = useState(true);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      setErr('');
      try {
        const r = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) setErr(j?.error || "Couldn't load this search.");
        else setRes(j);
      } catch {
        if (alive) setErr("Couldn't load this search — try again.");
      }
      if (alive) setBusy(false);
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  if (busy) {
    return (
      <div className="text-muted" style={{ fontSize: 13, padding: '30px 0' }}>
        Loading this search from OpenRent… takes 5-10 seconds.
      </div>
    );
  }

  if (err) {
    return <div style={{ fontSize: 13, color: 'var(--rust)', padding: '20px 0' }}>{err}</div>;
  }

  if (!res) return null;

  return (
    <div>
      {/* summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{res.search?.name}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
            {describe(res.search?.params) || 'no filters'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginLeft: 'auto', alignItems: 'baseline' }}>
          <div>
            <span className="font-mono" style={{ fontSize: 19, fontWeight: 600 }}>{res.matched}</span>
            <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>matched</span>
          </div>
          {res.fresh != null && (
            <div>
              <span className="font-mono" style={{ fontSize: 19, fontWeight: 600, color: 'var(--green)' }}>{res.fresh}</span>
              <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 6 }}>new</span>
            </div>
          )}
        </div>
      </div>

      {res.total > res.matched && (
        <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 14 }}>
          OpenRent returned {res.total}; {res.total - res.matched} didn&apos;t match your filters
          (OpenRent&apos;s own bed filter doesn&apos;t run server-side, so we apply it).
        </div>
      )}

      {res.listings?.length > 0 && (
        <>
          <div
            className="text-muted"
            style={{ fontSize: 11.5, margin: '0 0 12px', paddingTop: 12, borderTop: '1px solid var(--mist-line)' }}
          >
            {res.fresh == null
              ? "Couldn't check the store — new/seen unknown"
              : res.fresh > 0
                ? 'New ones first'
                : 'All already in the store'}
            {res.matched > res.listings.length && ` · top ${res.listings.length} with full detail`}
          </div>

          <div className="grid-cards">
            {res.listings.map((l) => (
              <div key={l.listing_id} style={{ position: 'relative' }}>
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

          {res.more?.length > 0 && (
            <>
              <div className="text-muted" style={{ fontSize: 11.5, margin: '18px 0 8px' }}>
                {res.more.length} more, without photos (the bot enriches these on its run)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
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
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                    )}
                    <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                      £{Number(l.price ?? 0).toLocaleString('en-GB')}
                    </span>
                    <span className="text-muted" style={{ fontSize: 11 }}>
                      {l.beds != null ? `${l.beds} bed` : ''}
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
          Nothing matched this search right now.
        </div>
      )}
    </div>
  );
}
