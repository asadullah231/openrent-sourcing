'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ListingCard } from './listing-card';

const SORTS = {
  score: { label: 'Best score', fn: (a, b) => (b.score ?? 0) - (a.score ?? 0) },
  newest: { label: 'Newest', fn: (a, b) => (a.hours_live ?? 9e9) - (b.hours_live ?? 9e9) },
  cheapest: { label: 'Cheapest', fn: (a, b) => (a.price ?? 9e9) - (b.price ?? 9e9) },
  dearest: { label: 'Highest price', fn: (a, b) => (b.price ?? 0) - (a.price ?? 0) },
  nearest: { label: 'Nearest', fn: (a, b) => (a._distance_km ?? 9e9) - (b._distance_km ?? 9e9) },
};

export function ListingGallery({ listings, sent = false }) {
  const [sort, setSort] = useState('score');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [beds, setBeds] = useState('any');
  const [furnished, setFurnished] = useState('any');
  const [minScore, setMinScore] = useState('');

  const filtered = useMemo(() => {
    let out = [...listings];
    if (minPrice) out = out.filter((l) => (l.price ?? 0) >= Number(minPrice));
    if (maxPrice) out = out.filter((l) => (l.price ?? 9e9) <= Number(maxPrice));
    if (beds !== 'any') out = out.filter((l) => String(l.beds) === beds);
    if (furnished !== 'any')
      out = out.filter((l) => (l.furnishing || '').toLowerCase() === furnished);
    if (minScore) out = out.filter((l) => (l.score ?? 0) >= Number(minScore));
    out.sort(SORTS[sort].fn);
    return out;
  }, [listings, sort, minPrice, maxPrice, beds, furnished, minScore]);

  const anyFilter = minPrice || maxPrice || beds !== 'any' || furnished !== 'any' || minScore;
  const reset = () => {
    setMinPrice(''); setMaxPrice(''); setBeds('any'); setFurnished('any'); setMinScore('');
  };

  const field = {
    background: 'var(--ink-raise)', border: '1px solid var(--mist-line)', borderRadius: 8,
    color: 'var(--paper)', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
  };

  return (
    <div>
      {/* filter bar
          Map yahan se hata diya (22 Jul) — 340px ka dabba na theek map tha na
          cards ko jagah deta tha. Ab apna poora page hai: /map */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <Link
          href="/map"
          style={{ background: 'var(--ink-raise)', border: '1px solid var(--mist-line)', borderRadius: 8, color: 'var(--paper)', padding: '7px 12px', fontSize: 13, textDecoration: 'none', fontFamily: 'inherit' }}
        >
          Open map
        </Link>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...field, fontWeight: 500 }}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <input type="number" placeholder="Min £" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...field, width: 82 }} />
        <input type="number" placeholder="Max £" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...field, width: 82 }} />

        <select value={beds} onChange={(e) => setBeds(e.target.value)} style={field}>
          <option value="any">Any beds</option>
          {[1, 2, 3, 4, 5].map((b) => <option key={b} value={String(b)}>{b} bed</option>)}
        </select>

        <select value={furnished} onChange={(e) => setFurnished(e.target.value)} style={field}>
          <option value="any">Any</option>
          <option value="furnished">Furnished</option>
          <option value="unfurnished">Unfurnished</option>
        </select>

        <input type="number" placeholder="Min score" value={minScore} onChange={(e) => setMinScore(e.target.value)} style={{ ...field, width: 100 }} />

        {anyFilter && (
          <button onClick={reset} style={{ ...field, cursor: 'pointer', color: 'var(--mist)' }}>Clear</button>
        )}

        <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
          {filtered.length} of {listings.length}
        </span>
      </div>

      <div className="grid-cards" style={{ marginTop: 16 }}>
        {filtered.map((l, i) => (
          <ListingCard key={l.listing_id} l={l} rank={i} sent={sent} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-muted" style={{ padding: 48, textAlign: 'center', fontSize: 13, border: '1px solid var(--mist-line)', borderRadius: 12 }}>
          {listings.length ? 'No listings match these filters.' : 'Nothing here yet.'}
        </div>
      )}
    </div>
  );
}
