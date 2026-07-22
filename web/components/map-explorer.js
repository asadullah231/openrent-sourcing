'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const PropertyMap = dynamic(() => import('./property-map').then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface)',
        borderRadius: 'var(--r-tile)',
        border: '1px solid var(--mist-line)',
      }}
      className="text-muted"
    >
      Loading map…
    </div>
  ),
});

const money = (p) => (p == null ? '—' : `£${Number(p).toLocaleString('en-GB')}`);

export function MapExplorer({ listings }) {
  const [beds, setBeds] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [show, setShow] = useState('all'); // all | pending | sent

  const filtered = useMemo(() => {
    return listings
      .filter((l) => l.lat != null && l.lng != null)
      .filter((l) => (beds ? String(l.beds) === beds : true))
      .filter((l) => (maxPrice ? (l.price ?? 0) <= Number(maxPrice) : true))
      .filter((l) => {
        if (show === 'sent') return l.viewing_status === 'requested';
        if (show === 'pending') return l.viewing_status !== 'requested';
        return true;
      })
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  }, [listings, beds, maxPrice, show]);

  const sentCount = filtered.filter((l) => l.viewing_status === 'requested').length;
  const noCoords = listings.length - listings.filter((l) => l.lat != null).length;

  // Height select/input ke barabar rakhi hai, warna filter bar tedhi lagti hai
  const chip = (active) => ({
    height: 36,
    padding: '0 15px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--brass)' : 'var(--mist-line)'}`,
    background: active ? 'rgba(224,169,78,0.12)' : 'transparent',
    color: active ? 'var(--brass)' : 'var(--paper-2)',
    fontSize: 12.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>Map</h1>
        <span className="text-muted font-mono" style={{ fontSize: 12 }}>
          {filtered.length} on map · {sentCount} requested
        </span>
      </div>

      {/* controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setShow('all')} style={chip(show === 'all')}>
          All
        </button>
        <button onClick={() => setShow('pending')} style={chip(show === 'pending')}>
          Not contacted
        </button>
        <button onClick={() => setShow('sent')} style={chip(show === 'sent')}>
          Requested
        </button>

        <span style={{ width: 1, height: 22, background: 'var(--mist-line)', margin: '0 4px' }} />

        <select className="field" style={{ width: 118 }} value={beds} onChange={(e) => setBeds(e.target.value)}>
          <option value="">Any beds</option>
          {[1, 2, 3, 4, 5].map((b) => (
            <option key={b} value={b}>
              {b} bed
            </option>
          ))}
        </select>
        <input
          className="field"
          style={{ width: 120 }}
          placeholder="Max £"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))}
        />

        <span className="text-muted" style={{ fontSize: 12, marginLeft: 'auto', display: 'flex', gap: 14 }}>
          <span>
            <b style={{ color: 'var(--brass)' }}>●</b> not contacted
          </span>
          <span>
            <b style={{ color: 'var(--green)' }}>●</b> requested
          </span>
        </span>
      </div>

      {/* map + side list */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 420 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PropertyMap listings={filtered} height="100%" interactive />
        </div>

        <div
          style={{
            width: 290,
            flexShrink: 0,
            overflowY: 'auto',
            border: '1px solid var(--mist-line)',
            borderRadius: 'var(--r-tile)',
            background: 'var(--surface)',
          }}
        >
          {filtered.length === 0 && (
            <div className="text-muted" style={{ padding: 18, fontSize: 13 }}>
              Nothing matches those filters.
            </div>
          )}
          {filtered.map((l) => {
            const sent = l.viewing_status === 'requested';
            return (
              <Link
                key={l.listing_id}
                href={`/listing/${l.listing_id}`}
                style={{
                  display: 'block',
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--mist-line)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="font-mono" style={{ fontSize: 14, fontWeight: 600 }}>
                    {money(l.price)}
                  </span>
                  <span className="text-muted" style={{ fontSize: 11.5 }}>
                    {l.beds != null ? `${l.beds} bed` : ''}
                  </span>
                  {sent && (
                    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--green)' }}>requested</span>
                  )}
                </div>
                {/* Address sirf enrich hone ke baad milta hai. Jab tak nahi mila,
                    khali "address abhi nahi" likhna bekaar hai — uski jagah wo
                    dikhao jo har listing pe hota hai: listing kitni purani hai. */}
                <div className="text-muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>
                  {l.address ||
                    (l.hours_live != null
                      ? `${l.hours_live}h pehle listed · #${l.listing_id}`
                      : `#${l.listing_id}`)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {noCoords > 0 && (
        <div className="text-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          {noCoords} listing{noCoords > 1 ? 's' : ''} map pe nahi — location nahi mili.
        </div>
      )}
    </div>
  );
}
