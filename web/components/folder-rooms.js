'use client';

import { useMemo, useState } from 'react';
import { ListingCard } from '@/components/listing-card';

// Folder view ke rooms — ADVANCED campaign panel (Smartlead + Twenty CRM jaisa).
// (Asad, 27 Jul) Features:
//   • Search (address / postcode)
//   • Status filter chips (All / Pending / Queued / Sent)
//   • Price filter (presets + custom min/max)
//   • Sort (newest, price low→high, price high→low, best score)
//   • Table ⇄ Card view toggle
//   • Select + bulk: Send outreach (cap-aware, queued) · Remove (soft-hide)
//   • Har room pe status badge (Pending grey · Queued amber · Sent green)

const priceInputStyle = {
  width: 80, fontSize: 13, padding: '6px 8px', borderRadius: 8,
  border: '1px solid var(--mist-line)', background: 'var(--surface)',
  color: 'var(--paper)', outline: 'none',
};

const PRICE_PRESETS = [
  { label: 'All prices', min: '', max: '' },
  { label: 'Under £1,000', min: '', max: '1000' },
  { label: '£1,000–1,500', min: '1000', max: '1500' },
  { label: '£1,500–2,000', min: '1500', max: '2000' },
  { label: '£2,000+', min: '2000', max: '' },
];

const SORTS = {
  newest: { label: 'Newest first', fn: (a, b) => new Date(b.CreatedAt || b.scraped_at || 0) - new Date(a.CreatedAt || a.scraped_at || 0) },
  price_asc: { label: 'Price: low → high', fn: (a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity) },
  price_desc: { label: 'Price: high → low', fn: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0) },
  score: { label: 'Best score', fn: (a, b) => (b.score ?? 0) - (a.score ?? 0) },
};

// Room ka status → { key, label, color, bg }
function statusOf(l) {
  const s = l.viewing_status || 'new';
  if (s === 'requested') return { key: 'sent', label: 'Sent', color: 'var(--green)', bg: 'rgba(60,160,80,0.14)' };
  if (s === 'queued') return { key: 'queued', label: 'Queued', color: 'var(--brass)', bg: 'rgba(180,140,60,0.16)' };
  return { key: 'pending', label: 'Pending', color: 'var(--mist)', bg: 'rgba(140,140,150,0.14)' };
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'queued', label: 'Queued' },
  { key: 'sent', label: 'Sent' },
];

function Badge({ st }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 999, color: st.color, background: st.bg,
      whiteSpace: 'nowrap',
    }}>
      {st.label}
    </span>
  );
}

function BulkBar({ count, busy, onSend, onRemove, onClear }) {
  return (
    <div style={{
      position: 'sticky', bottom: 16, zIndex: 20, display: 'flex', alignItems: 'center',
      gap: 12, flexWrap: 'wrap', margin: '18px auto 0', maxWidth: 560, padding: '12px 16px',
      borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--brass)',
      boxShadow: 'var(--shadow-card)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{count} selected</span>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
        <button onClick={onSend} disabled={busy} style={{
          fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9, border: 'none',
          cursor: busy ? 'default' : 'pointer', background: 'var(--brass)', color: '#1a1400', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Working…' : 'Send outreach'}</button>
        <button onClick={onRemove} disabled={busy} style={{
          fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 9,
          border: '1px solid var(--rust)', cursor: busy ? 'default' : 'pointer',
          background: 'transparent', color: 'var(--rust)', opacity: busy ? 0.6 : 1,
        }}>Remove</button>
        <button onClick={onClear} disabled={busy} style={{
          fontSize: 13, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--mist-line)',
          cursor: 'pointer', background: 'transparent', color: 'var(--mist)',
        }}>Clear</button>
      </div>
    </div>
  );
}

export function FolderRooms({ rooms }) {
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [removed, setRemoved] = useState(() => new Set());
  // controls
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('card'); // 'card' | 'table'

  const notRemoved = useMemo(
    () => rooms.filter((r) => !removed.has(String(r.listing_id))),
    [rooms, removed]
  );

  // Counts per status (tabs pe number dikhane ko) — filtered se pehle, notRemoved pe.
  const statusCounts = useMemo(() => {
    const c = { all: notRemoved.length, pending: 0, queued: 0, sent: 0 };
    for (const r of notRemoved) c[statusOf(r).key]++;
    return c;
  }, [notRemoved]);

  const min = minPrice === '' ? null : Number(minPrice);
  const max = maxPrice === '' ? null : Number(maxPrice);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = notRemoved.filter((r) => {
      // status
      if (statusTab !== 'all' && statusOf(r).key !== statusTab) return false;
      // price
      const p = Number(r.price);
      if ((min != null || max != null) && p) {
        if (min != null && p < min) return false;
        if (max != null && p > max) return false;
      }
      // search — address / postcode / title
      if (q) {
        const hay = `${r.address || ''} ${r.postcode || ''} ${r.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort(SORTS[sort].fn);
    return out;
  }, [notRemoved, statusTab, min, max, query, sort]);

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(String(r.listing_id)));

  function toggle(id) {
    const next = new Set(selected);
    const k = String(id);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelected(next);
  }
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible.map((r) => String(r.listing_id))));
  }

  async function runAction(action) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === 'hide' && !confirm(`Remove ${ids.length} room${ids.length === 1 ? '' : 's'} from this folder? You can bring them back later.`)) return;
    if (action === 'send' && !confirm(`Send viewing requests for ${ids.length} room${ids.length === 1 ? '' : 's'} from Mo’s OpenRent account?`)) return;

    setBusy(true); setNote('');
    try {
      const res = await fetch('/api/listings/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } catch {
      setNote('Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  }

  const activePreset = PRICE_PRESETS.find((p) => p.min === minPrice && p.max === maxPrice);
  const anyFilter = query || statusTab !== 'all' || minPrice !== '' || maxPrice !== '';

  const chip = (on) => ({
    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
    border: '1px solid ' + (on ? 'var(--brass)' : 'var(--mist-line)'),
    background: on ? 'var(--brass)' : 'transparent', color: on ? '#1a1400' : 'var(--mist)',
  });

  const Controls = (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* row 1: search + sort + view toggle */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address or postcode…"
          style={{ flex: '1 1 220px', minWidth: 180, fontSize: 13, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--mist-line)', background: 'var(--surface)', color: 'var(--paper)', outline: 'none' }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          style={{ fontSize: 13, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--mist-line)', background: 'var(--surface)', color: 'var(--paper)', cursor: 'pointer' }}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ display: 'flex', border: '1px solid var(--mist-line)', borderRadius: 9, overflow: 'hidden' }}>
          {['card', 'table'].map((m) => (
            <button key={m} onClick={() => setView(m)} title={`${m} view`}
              style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', border: 'none', cursor: 'pointer',
                background: view === m ? 'var(--brass)' : 'transparent', color: view === m ? '#1a1400' : 'var(--mist)', textTransform: 'capitalize' }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* row 2: status tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_TABS.map((t) => (
          <button key={t.key} onClick={() => setStatusTab(t.key)} style={chip(statusTab === t.key)}>
            {t.label} <span style={{ opacity: 0.7 }}>{statusCounts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* row 3: price presets + custom */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="text-muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</span>
        {PRICE_PRESETS.map((p) => (
          <button key={p.label} onClick={() => { setMinPrice(p.min); setMaxPrice(p.max); }}
            style={chip(activePreset ? activePreset.label === p.label : false)}>{p.label}</button>
        ))}
        <span className="text-muted" style={{ fontSize: 12 }}>£</span>
        <input type="number" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={priceInputStyle} />
        <span className="text-muted" style={{ fontSize: 12 }}>–</span>
        <input type="number" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={priceInputStyle} />
      </div>

      {/* row 4: count + clear + note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
          Select all
        </label>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {visible.length}{visible.length !== notRemoved.length ? ` of ${notRemoved.length}` : ''} shown
          {selected.size > 0 && ` · ${selected.size} selected`}
        </span>
        {anyFilter && (
          <button onClick={() => { setQuery(''); setStatusTab('all'); setMinPrice(''); setMaxPrice(''); }}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid var(--mist-line)', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
        {note && <span style={{ fontSize: 12.5, color: 'var(--brass)', marginLeft: 'auto' }}>{note}</span>}
      </div>
    </div>
  );

  const Checkbox = ({ id, sel }) => (
    <label style={{
      width: 22, height: 22, borderRadius: 6,
      background: sel ? 'var(--brass)' : 'rgba(0,0,0,0.35)',
      border: '1px solid ' + (sel ? 'var(--brass)' : 'rgba(255,255,255,0.4)'),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    }} title={sel ? 'Deselect' : 'Select'}>
      <input type="checkbox" checked={sel} onChange={() => toggle(id)} style={{ position: 'absolute', opacity: 0, width: 22, height: 22, cursor: 'pointer', margin: 0 }} />
      {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l4.5 4.5L19 7" stroke="#1a1400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </label>
  );

  if (!visible.length) {
    return (
      <div>
        {Controls}
        <div className="text-muted" style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13 }}>
          {notRemoved.length > 0 ? 'No rooms match these filters. Try widening them.' : 'No rooms here right now.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {Controls}

      {view === 'card' ? (
        <div className="grid-cards">
          {visible.map((l) => {
            const k = String(l.listing_id);
            const sel = selected.has(k);
            const st = statusOf(l);
            return (
              <div key={k} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5 }}><Checkbox id={k} sel={sel} /></div>
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}><Badge st={st} /></div>
                <ListingCard l={l} sent={st.key === 'sent'} />
              </div>
            );
          })}
        </div>
      ) : (
        // TABLE view — compact rows, Twenty CRM jaisa
        <div style={{ border: '1px solid var(--mist-line)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
          {visible.map((l, i) => {
            const k = String(l.listing_id);
            const sel = selected.has(k);
            const st = statusOf(l);
            return (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--mist-line)',
                background: sel ? 'rgba(180,140,60,0.06)' : 'transparent',
              }}>
                <Checkbox id={k} sel={sel} />
                <a href={`/listing/${l.listing_id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {l.address || l.title || `#${l.listing_id}`}
                  </span>
                  <Badge st={st} />
                  <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, minWidth: 66, textAlign: 'right' }}>
                    {l.price ? `£${Number(l.price).toLocaleString('en-GB')}` : '—'}
                  </span>
                </a>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <BulkBar count={selected.size} busy={busy}
          onSend={() => runAction('send')} onRemove={() => runAction('hide')} onClear={() => setSelected(new Set())} />
      )}
    </div>
  );
}
