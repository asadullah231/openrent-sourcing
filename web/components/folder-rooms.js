'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ListingCard } from '@/components/listing-card';

// Folder view ke rooms — ADVANCED campaign suite (Smartlead + Twenty CRM jaisa).
// (Asad, 28 Jul) Features:
//   • Analytics strip (rooms · sent today/cap · queued · this week · avg price)
//   • Search (address / postcode) + status tabs + price filter + sort
//   • THREE views: Card · Table · Kanban (Pending → Queued → Sent, drag-drop)
//   • Saved Views — Mo apna filter+sort combo naam de kar save/recall kare
//   • Per-room notes + activity timeline (kab queue/send hua)
//   • Select + bulk: Send outreach (cap-aware) · Remove (soft-hide)

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

// Kanban columns — left→right pipeline. 'sent' me drop = send.
const KANBAN_COLS = [
  { key: 'pending', label: 'Pending', hint: 'Not sent yet', color: 'var(--mist)' },
  { key: 'queued', label: 'Queued', hint: 'Waiting for bot', color: 'var(--brass)' },
  { key: 'sent', label: 'Sent', hint: 'Request went out', color: 'var(--green)' },
];

const SAVED_VIEWS_KEY = 'openrent.savedViews.v1';

function fmtGBP(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? `£${v.toLocaleString('en-GB')}` : '-';
}

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24; if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

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

// ── Analytics strip ────────────────────────────────────────────────────────
function Analytics({ rooms, counts, health }) {
  const stats = useMemo(() => {
    const prices = rooms.map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
    const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    // is week sent — activity nahi, sirf 'requested' count best-effort (folder scope)
    return { avg };
  }, [rooms]);
  const cap = health?.dailyCap ?? 15;
  const sentToday = health?.sentToday ?? 0;
  const capPct = Math.min(100, cap ? Math.round((sentToday / cap) * 100) : 0);

  const tile = (big, small, color) => (
    <div style={{ minWidth: 0 }}>
      <div className="font-mono" style={{ fontSize: 19, fontWeight: 700, color: color || 'var(--paper)', lineHeight: 1.1 }}>{big}</div>
      <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{small}</div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end', padding: '14px 18px',
      border: '1px solid var(--mist-line)', borderRadius: 14, background: 'var(--surface)', marginBottom: 16,
    }}>
      {tile(counts.all, 'rooms in folder')}
      {tile(counts.pending, 'pending', 'var(--mist)')}
      {tile(counts.queued, 'queued', 'var(--brass)')}
      {tile(counts.sent, 'sent', 'var(--green)')}
      <div style={{ minWidth: 130 }}>
        <div className="font-mono" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>
          {sentToday}<span className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}> / {cap}</span>
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 2, marginBottom: 4 }}>sent today (daily cap)</div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(140,140,150,0.2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${capPct}%`, background: capPct >= 100 ? 'var(--rust)' : 'var(--brass)' }} />
        </div>
      </div>
      {tile(fmtGBP(stats.avg), 'avg price here')}
    </div>
  );
}

// ── Notes popover (per room) ───────────────────────────────────────────────
function NoteEditor({ listingId, initial, onSaved }) {
  const [text, setText] = useState(initial?.text || '');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const has = !!(initial?.text);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/listings/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'note', listingId, text }),
      });
      const j = await res.json();
      if (j.ok) { onSaved?.(listingId, j.note); setOpen(false); }
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title={has ? initial.text : 'Add a note'}
        style={{
          fontSize: 11.5, padding: '3px 9px', borderRadius: 8, cursor: 'pointer',
          border: '1px solid ' + (has ? 'var(--brass)' : 'var(--mist-line)'),
          background: has ? 'rgba(180,140,60,0.12)' : 'transparent',
          color: has ? 'var(--brass)' : 'var(--mist)', maxWidth: 180,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
        {has ? `🗒 ${initial.text}` : '+ Note'}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus
        placeholder="landlord called back, from Facebook…"
        style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--mist-line)', background: 'var(--surface)', color: 'var(--paper)', resize: 'vertical', outline: 'none' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={save} disabled={busy} style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 12px', borderRadius: 7, border: 'none', background: 'var(--brass)', color: '#1a1400', cursor: 'pointer' }}>{busy ? '…' : 'Save'}</button>
        <button onClick={() => setOpen(false)} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--mist-line)', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

export function FolderRooms({ rooms, notes: notesInit = {}, activity = {}, health = {} }) {
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [removed, setRemoved] = useState(() => new Set());
  const [notes, setNotes] = useState(notesInit);
  // controls
  const [query, setQuery] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('card'); // 'card' | 'table' | 'kanban'
  // saved views
  const [savedViews, setSavedViews] = useState([]);
  const [activeView, setActiveView] = useState('');
  // kanban local status overrides (drag turant dikhe, refresh se pehle)
  const [statusOverride, setStatusOverride] = useState({}); // listing_id -> 'pending'|'queued'|'sent'
  const [dragOver, setDragOver] = useState('');
  const dragId = useRef(null);

  // localStorage se saved views load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw));
    } catch {}
  }, []);

  function persistViews(next) {
    setSavedViews(next);
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch {}
  }

  const notRemoved = useMemo(
    () => rooms.filter((r) => !removed.has(String(r.listing_id))),
    [rooms, removed]
  );

  // Effective status — drag override ya asli. Kanban + counts dono yehi dekhte.
  function effStatus(r) {
    const o = statusOverride[String(r.listing_id)];
    if (o) return o;
    return statusOf(r).key;
  }

  // Counts per status — override-aware, notRemoved pe.
  const statusCounts = useMemo(() => {
    const c = { all: notRemoved.length, pending: 0, queued: 0, sent: 0 };
    for (const r of notRemoved) c[effStatus(r)]++;
    return c;
  }, [notRemoved, statusOverride]);

  const min = minPrice === '' ? null : Number(minPrice);
  const max = maxPrice === '' ? null : Number(maxPrice);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = notRemoved.filter((r) => {
      if (statusTab !== 'all' && effStatus(r) !== statusTab) return false;
      const p = Number(r.price);
      if ((min != null || max != null) && p) {
        if (min != null && p < min) return false;
        if (max != null && p > max) return false;
      }
      if (q) {
        const hay = `${r.address || ''} ${r.postcode || ''} ${r.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort(SORTS[sort].fn);
    return out;
  }, [notRemoved, statusTab, min, max, query, sort, statusOverride]);

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

  async function runAction(action, ids = [...selected], opts = {}) {
    if (!ids.length) return;
    if (action === 'hide' && !opts.silent && !confirm(`Remove ${ids.length} room${ids.length === 1 ? '' : 's'} from this folder? You can bring them back later.`)) return;
    if (action === 'send' && !opts.silent && !confirm(`Send viewing requests for ${ids.length} room${ids.length === 1 ? '' : 's'} from Mo’s OpenRent account?`)) return;

    setBusy(true); setNote('');
    try {
      const res = await fetch('/api/listings/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, listingIds: ids, ...opts.body }),
      });
      const j = await res.json();
      if (action === 'hide' && j.ok) {
        setRemoved((prev) => new Set([...prev, ...ids]));
        setSelected(new Set());
        setNote(`Removed ${j.count} room${j.count === 1 ? '' : 's'}.`);
      } else if (action === 'send') {
        setSelected(new Set());
        setNote(j.message || (j.ok ? 'Sent.' : j.error || 'Could not send.'));
      } else if (action === 'move') {
        setNote(j.ok ? '' : (j.error || 'Move failed.'));
      }
    } catch {
      setNote('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  // Kanban drop — card ko `to` column me daalo.
  async function dropTo(to) {
    const id = dragId.current;
    dragId.current = null; setDragOver('');
    if (!id) return;
    const room = notRemoved.find((r) => String(r.listing_id) === String(id));
    if (!room) return;
    const from = effStatus(room);
    if (from === to) return;
    if (from === 'sent') { setNote('Sent requests can’t be moved back.'); return; }

    // Optimistic — turant column badlo, phir server.
    setStatusOverride((prev) => ({ ...prev, [String(id)]: to }));
    if (to === 'pending') await runAction('move', [id], { silent: true, body: { to: 'pending' } });
    else await runAction('move', [id], { silent: true, body: { to } });
  }

  const activePreset = PRICE_PRESETS.find((p) => p.min === minPrice && p.max === maxPrice);
  const anyFilter = query || statusTab !== 'all' || minPrice !== '' || maxPrice !== '' || sort !== 'newest';

  function clearFilters() {
    setQuery(''); setStatusTab('all'); setMinPrice(''); setMaxPrice(''); setSort('newest'); setActiveView('');
  }

  // ── Saved Views ──
  const currentViewState = { query, statusTab, minPrice, maxPrice, sort };
  function saveCurrentView() {
    const name = prompt('Name this view (e.g. “Cheap East London”):');
    if (!name || !name.trim()) return;
    const v = { id: `${name}-${savedViews.length}`, name: name.trim(), state: currentViewState };
    persistViews([...savedViews.filter((x) => x.name !== v.name), v]);
    setActiveView(v.name);
  }
  function applyView(v) {
    const s = v.state || {};
    setQuery(s.query || ''); setStatusTab(s.statusTab || 'all');
    setMinPrice(s.minPrice || ''); setMaxPrice(s.maxPrice || ''); setSort(s.sort || 'newest');
    setActiveView(v.name);
  }
  function deleteView(v) {
    persistViews(savedViews.filter((x) => x.name !== v.name));
    if (activeView === v.name) setActiveView('');
  }

  const chip = (on) => ({
    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
    border: '1px solid ' + (on ? 'var(--brass)' : 'var(--mist-line)'),
    background: on ? 'var(--brass)' : 'transparent', color: on ? '#1a1400' : 'var(--mist)',
  });

  const onNoteSaved = (id, saved) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (saved) next[String(id)] = saved; else delete next[String(id)];
      return next;
    });
  };

  const SavedViewsBar = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="text-muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Views</span>
      <button onClick={clearFilters} style={chip(!activeView && !anyFilter)}>All rooms</button>
      {savedViews.map((v) => (
        <span key={v.name} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button onClick={() => applyView(v)} style={{ ...chip(activeView === v.name), borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>{v.name}</button>
          <button onClick={() => deleteView(v)} title="Delete view"
            style={{ fontSize: 12, padding: '5px 8px', borderRadius: 999, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
              border: '1px solid ' + (activeView === v.name ? 'var(--brass)' : 'var(--mist-line)'), borderLeft: 'none',
              background: activeView === v.name ? 'var(--brass)' : 'transparent', color: activeView === v.name ? '#1a1400' : 'var(--mist)', cursor: 'pointer' }}>×</button>
        </span>
      ))}
      <button onClick={saveCurrentView} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', border: '1px dashed var(--mist-line)', background: 'transparent', color: 'var(--mist)' }}>+ Save current</button>
    </div>
  );

  const Controls = (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* saved views */}
      {SavedViewsBar}

      {/* row 1: search + sort + view toggle */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={query} onChange={(e) => { setQuery(e.target.value); setActiveView(''); }}
          placeholder="Search address or postcode…"
          style={{ flex: '1 1 220px', minWidth: 180, fontSize: 13, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--mist-line)', background: 'var(--surface)', color: 'var(--paper)', outline: 'none' }}
        />
        <select value={sort} onChange={(e) => { setSort(e.target.value); setActiveView(''); }}
          style={{ fontSize: 13, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--mist-line)', background: 'var(--surface)', color: 'var(--paper)', cursor: 'pointer' }}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ display: 'flex', border: '1px solid var(--mist-line)', borderRadius: 9, overflow: 'hidden' }}>
          {['card', 'table', 'kanban'].map((m) => (
            <button key={m} onClick={() => setView(m)} title={`${m} view`}
              style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', border: 'none', cursor: 'pointer',
                background: view === m ? 'var(--brass)' : 'transparent', color: view === m ? '#1a1400' : 'var(--mist)', textTransform: 'capitalize' }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* row 2: status tabs (kanban me chhupa do — columns hi status hain) */}
      {view !== 'kanban' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => { setStatusTab(t.key); setActiveView(''); }} style={chip(statusTab === t.key)}>
              {t.label} <span style={{ opacity: 0.7 }}>{statusCounts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* row 3: price presets + custom */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="text-muted" style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</span>
        {PRICE_PRESETS.map((p) => (
          <button key={p.label} onClick={() => { setMinPrice(p.min); setMaxPrice(p.max); setActiveView(''); }}
            style={chip(activePreset ? activePreset.label === p.label : false)}>{p.label}</button>
        ))}
        <span className="text-muted" style={{ fontSize: 12 }}>£</span>
        <input type="number" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setActiveView(''); }} style={priceInputStyle} />
        <span className="text-muted" style={{ fontSize: 12 }}>–</span>
        <input type="number" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setActiveView(''); }} style={priceInputStyle} />
      </div>

      {/* row 4: count + clear + note (kanban me select-all chhupa do) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {view !== 'kanban' && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
            Select all
          </label>
        )}
        <span className="text-muted" style={{ fontSize: 12 }}>
          {visible.length}{visible.length !== notRemoved.length ? ` of ${notRemoved.length}` : ''} shown
          {selected.size > 0 && ` · ${selected.size} selected`}
        </span>
        {anyFilter && (
          <button onClick={clearFilters}
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
      width: 22, height: 22, borderRadius: 6, position: 'relative',
      background: sel ? 'var(--brass)' : 'rgba(0,0,0,0.35)',
      border: '1px solid ' + (sel ? 'var(--brass)' : 'rgba(255,255,255,0.4)'),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    }} title={sel ? 'Deselect' : 'Select'}>
      <input type="checkbox" checked={sel} onChange={() => toggle(id)} style={{ position: 'absolute', opacity: 0, width: 22, height: 22, cursor: 'pointer', margin: 0 }} />
      {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l4.5 4.5L19 7" stroke="#1a1400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </label>
  );

  // Activity + note ki chhoti timeline line (card/table pe)
  const MetaLine = ({ id }) => {
    const acts = (activity[String(id)] || []).filter((a) => a.at);
    const last = acts.sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    const n = notes[String(id)];
    if (!last && !n) return null;
    return (
      <div className="text-muted" style={{ fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {last && <span>✉ Sent {timeAgo(last.at)}</span>}
        {n && <span title={n.text}>🗒 {n.text.length > 40 ? n.text.slice(0, 40) + '…' : n.text}</span>}
      </div>
    );
  };

  if (!notRemoved.length) {
    return (
      <div>
        <Analytics rooms={notRemoved} counts={statusCounts} health={health} />
        {Controls}
        <div className="text-muted" style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13 }}>No rooms here right now.</div>
      </div>
    );
  }

  // ── KANBAN VIEW ──
  if (view === 'kanban') {
    const byCol = { pending: [], queued: [], sent: [] };
    for (const r of visible) byCol[effStatus(r)]?.push(r);
    return (
      <div>
        <Analytics rooms={notRemoved} counts={statusCounts} health={health} />
        {Controls}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {KANBAN_COLS.map((col) => (
            <div key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver((d) => (d === col.key ? '' : d))}
              onDrop={(e) => { e.preventDefault(); dropTo(col.key); }}
              style={{
                border: '1px solid ' + (dragOver === col.key ? 'var(--brass)' : 'var(--mist-line)'),
                borderRadius: 14, background: dragOver === col.key ? 'rgba(180,140,60,0.06)' : 'var(--surface)',
                padding: 12, minHeight: 200, transition: 'border-color .12s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: col.color }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{col.label}</span>
                <span className="text-muted" style={{ fontSize: 12 }}>{byCol[col.key].length}</span>
                <span className="text-muted" style={{ fontSize: 10.5, marginLeft: 'auto' }}>{col.hint}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byCol[col.key].map((l) => {
                  const k = String(l.listing_id);
                  return (
                    <div key={k} draggable={col.key !== 'sent'}
                      onDragStart={() => { dragId.current = k; }}
                      style={{
                        border: '1px solid var(--mist-line)', borderRadius: 10, padding: '9px 11px',
                        background: 'var(--bg)', cursor: col.key === 'sent' ? 'default' : 'grab',
                      }}>
                      <a href={`/listing/${l.listing_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.address || l.title || `#${l.listing_id}`}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
                          <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>{fmtGBP(l.price)}</span>
                          {l.score != null && <span className="text-muted" style={{ fontSize: 11 }}>· score {l.score}</span>}
                        </div>
                      </a>
                      <div style={{ marginTop: 6 }}>
                        <NoteEditor listingId={k} initial={notes[k]} onSaved={onNoteSaved} />
                      </div>
                    </div>
                  );
                })}
                {byCol[col.key].length === 0 && (
                  <div className="text-muted" style={{ fontSize: 11.5, textAlign: 'center', padding: '14px 0' }}>
                    {col.key === 'pending' ? 'Nothing pending' : `Drag rooms here to ${col.key === 'sent' ? 'send' : 'queue'}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          Drag a card into <strong>Queued</strong> to line it up, or into <strong>Sent</strong> to fire the request now (from Mo’s account, daily cap applies). Sent cards can’t move back.
        </p>
      </div>
    );
  }

  // ── CARD / TABLE VIEW ──
  if (!visible.length) {
    return (
      <div>
        <Analytics rooms={notRemoved} counts={statusCounts} health={health} />
        {Controls}
        <div className="text-muted" style={{ padding: '30px 20px', textAlign: 'center', fontSize: 13 }}>
          No rooms match these filters. Try widening them.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Analytics rooms={notRemoved} counts={statusCounts} health={health} />
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
                <div style={{ padding: '2px 4px 0', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <MetaLine id={k} />
                  <NoteEditor listingId={k} initial={notes[k]} onSaved={onNoteSaved} />
                </div>
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
                <a href={`/listing/${l.listing_id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {l.address || l.title || `#${l.listing_id}`}
                    </span>
                    <Badge st={st} />
                    <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, minWidth: 66, textAlign: 'right' }}>{fmtGBP(l.price)}</span>
                  </div>
                  <MetaLine id={k} />
                </a>
                <NoteEditor listingId={k} initial={notes[k]} onSaved={onNoteSaved} />
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
