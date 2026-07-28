'use client';

import { useState } from 'react';
import { ListingCard } from '@/components/listing-card';

// Folder view ke rooms — Smartlead-style select + bulk actions (Asad, 27 Jul).
//
// Har room card pe checkbox. Kuch select ho to niche ek floating BULK BAR aata:
//   • Send outreach  → selected ko Mo ke account se bhejo (cap-aware, queued)
//   • Remove         → selected folder se hatao (soft hide, wapas la sakte)
// "Select all" upar. Yehi campaign management ka dil hai.

function BulkBar({ count, busy, onSend, onRemove, onClear }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 16,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        margin: '18px auto 0',
        maxWidth: 560,
        padding: '12px 16px',
        borderRadius: 14,
        background: 'var(--surface)',
        border: '1px solid var(--brass)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>{count} selected</span>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <button
          onClick={onSend}
          disabled={busy}
          style={{
            fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9,
            border: 'none', cursor: busy ? 'default' : 'pointer',
            background: 'var(--brass)', color: '#1a1400', opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Working…' : 'Send outreach'}
        </button>
        <button
          onClick={onRemove}
          disabled={busy}
          style={{
            fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9,
            border: '1px solid var(--rust)', cursor: busy ? 'default' : 'pointer',
            background: 'transparent', color: 'var(--rust)', opacity: busy ? 0.6 : 1,
          }}
        >
          Remove
        </button>
        <button
          onClick={onClear}
          disabled={busy}
          style={{
            fontSize: 13, padding: '8px 12px', borderRadius: 9,
            border: '1px solid var(--mist-line)', cursor: 'pointer',
            background: 'transparent', color: 'var(--mist)',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// min/max price input ka style
const priceInputStyle = {
  width: 80,
  fontSize: 13,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid var(--mist-line)',
  background: 'var(--surface)',
  color: 'var(--paper)',
  outline: 'none',
};

// Price presets (£/month) — ek click me common budget ranges. Mo in se ya
// khud min/max type kar ke apni pricing pe filter karta hai.
const PRICE_PRESETS = [
  { label: 'All prices', min: '', max: '' },
  { label: 'Under £1,000', min: '', max: '1000' },
  { label: '£1,000–1,500', min: '1000', max: '1500' },
  { label: '£1,500–2,000', min: '1500', max: '2000' },
  { label: '£2,000+', min: '2000', max: '' },
];

export function FolderRooms({ rooms }) {
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // rooms jinhe abhi is session me remove kiya (turant gayab dikhane ko)
  const [removed, setRemoved] = useState(() => new Set());
  // PRICE FILTER — min/max £ (khali = koi limit nahi)
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const notRemoved = rooms.filter((r) => !removed.has(String(r.listing_id)));

  // pricing filter lagao — jis room ka price range me ho wahi dikhe. price na ho
  // (null) to us ko chhupao nahi (filter tabhi lage jab dono/ek limit ho).
  const min = minPrice === '' ? null : Number(minPrice);
  const max = maxPrice === '' ? null : Number(maxPrice);
  const visible = notRemoved.filter((r) => {
    if (min == null && max == null) return true;
    const p = Number(r.price);
    if (!p) return true; // price unknown — na hatao
    if (min != null && p < min) return false;
    if (max != null && p > max) return false;
    return true;
  });
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(String(r.listing_id)));

  function toggle(id) {
    const next = new Set(selected);
    const k = String(id);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible.map((r) => String(r.listing_id))));
  }

  async function runAction(action) {
    const ids = [...selected];
    if (!ids.length) return;

    if (action === 'hide') {
      const ok = confirm(`Remove ${ids.length} room${ids.length === 1 ? '' : 's'} from this folder? You can bring them back later.`);
      if (!ok) return;
    }
    if (action === 'send') {
      const ok = confirm(`Send viewing requests for ${ids.length} room${ids.length === 1 ? '' : 's'} from Mo’s OpenRent account?`);
      if (!ok) return;
    }

    setBusy(true);
    setNote('');
    try {
      const res = await fetch('/api/listings/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, listingIds: ids }),
      });
      const j = await res.json();
      if (action === 'hide' && j.ok) {
        setRemoved((prev) => new Set([...prev, ...ids]));
        setSelected(new Set());
        setNote(`Removed ${j.count} room${j.count === 1 ? '' : 's'}.`);
      } else if (action === 'send') {
        setSelected(new Set());
        setNote(j.message || (j.ok ? 'Sent.' : j.error || 'Could not send.'));
      }
    } catch (e) {
      setNote('Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  }

  const activePreset = PRICE_PRESETS.find((p) => p.min === minPrice && p.max === maxPrice);

  // Price filter bar — presets + custom min/max. Rooms count bhi (filtered).
  const PriceFilter = (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="text-muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Filter by price
        </span>
        {PRICE_PRESETS.map((p) => {
          const on = activePreset ? activePreset.label === p.label : false;
          return (
            <button
              key={p.label}
              onClick={() => { setMinPrice(p.min); setMaxPrice(p.max); }}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid ' + (on ? 'var(--brass)' : 'var(--mist-line)'),
                background: on ? 'var(--brass)' : 'transparent',
                color: on ? '#1a1400' : 'var(--mist)',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {/* custom min / max */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="text-muted" style={{ fontSize: 12 }}>£</span>
          <input
            type="number" inputMode="numeric" placeholder="Min"
            value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
            style={priceInputStyle}
          />
          <span className="text-muted" style={{ fontSize: 12 }}>to £</span>
          <input
            type="number" inputMode="numeric" placeholder="Max"
            value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
            style={priceInputStyle}
          />
        </div>
        {(minPrice !== '' || maxPrice !== '') && (
          <>
            <button
              onClick={() => { setMinPrice(''); setMaxPrice(''); }}
              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--mist-line)', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}
            >
              Clear
            </button>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {visible.length} of {notRemoved.length} shown
            </span>
          </>
        )}
      </div>
    </div>
  );

  if (!visible.length) {
    return (
      <div>
        {PriceFilter}
        <div className="text-muted" style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13 }}>
          {notRemoved.length > 0 ? 'No rooms in this price range. Try a wider range.' : 'No rooms here right now.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {PriceFilter}
      {/* select-all + note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
          Select all ({visible.length})
        </label>
        {selected.size > 0 && (
          <span className="text-muted" style={{ fontSize: 12 }}>{selected.size} selected</span>
        )}
        {note && <span style={{ fontSize: 12.5, color: 'var(--brass)', marginLeft: 'auto' }}>{note}</span>}
      </div>

      <div className="grid-cards">
        {visible.map((l) => {
          const k = String(l.listing_id);
          const isSel = selected.has(k);
          return (
            <div key={k} style={{ position: 'relative' }}>
              {/* checkbox overlay — top-left */}
              <label
                style={{
                  position: 'absolute', top: 10, left: 10, zIndex: 5,
                  width: 24, height: 24, borderRadius: 7,
                  background: isSel ? 'var(--brass)' : 'rgba(0,0,0,0.45)',
                  border: '1px solid ' + (isSel ? 'var(--brass)' : 'rgba(255,255,255,0.5)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                title={isSel ? 'Deselect' : 'Select'}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(k)}
                  style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }}
                />
                {isSel && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l4.5 4.5L19 7" stroke="#1a1400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </label>
              <ListingCard l={l} sent={l.viewing_status === 'requested'} />
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          busy={busy}
          onSend={() => runAction('send')}
          onRemove={() => runAction('hide')}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}
