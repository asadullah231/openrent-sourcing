'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// "New Search" form (Mo, 28 Jul) — link paste ki jagah seedha requirement bharo.
//
// KYUN: Mo ka asli flow (Social Housing) link-based nahi. Wo ek requirement pe
// kaam karta hai — borough + beds (2-4) + max rent. Max rent har borough+bed ka
// alag hota hai (LHA rate + incentive). To wo ye teen cheezein bhare, hum us se
// seedha OpenRent search bana kar save kar dete hain (sirf OpenRent, no cross).
//
// LHA helper: agar Mo LHA rate + monthly incentive daale, max rent apne-aap jud
// jata hai — PAR wo edit bhi kar sakta hai (incentive negotiate hota, fixed nahi).
// Rates hardcode NAHI — har baar Mo apne daale (Excel sirf ek example tha).

const inputStyle = {
  width: '100%', height: 40, borderRadius: 10, padding: '0 12px', fontSize: 13.5,
  border: '1px solid var(--mist-line)', background: 'var(--surface)', color: 'var(--paper)', outline: 'none',
};
const labelStyle = {
  fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--mist)', marginBottom: 6, display: 'block',
};

const BEDS = [1, 2, 3, 4, 5, 6];

export function SearchForm() {
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('3'); // km — OpenRent 'area' param, km default
  const [bedsMin, setBedsMin] = useState('2');
  const [bedsMax, setBedsMax] = useState('4');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  // Autocomplete (OpenRent ki apni suggestions)
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [activeSug, setActiveSug] = useState(-1);
  const pickedRef = useRef(false); // suggestion select hua to dobara fetch na karo
  const boxRef = useRef(null);
  // LHA helper (optional) — Mo ise bharkar max rent auto-fill kar sakta hai.
  const [showHelper, setShowHelper] = useState(false);
  const [lhaRate, setLhaRate] = useState('');
  const [incentive, setIncentive] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  // LHA rate + incentive = suggested max rent (Mo edit kar sakta hai).
  const suggested = useMemo(() => {
    const r = Number(lhaRate), i = Number(incentive);
    if (!Number.isFinite(r) || r <= 0) return null;
    const inc = Number.isFinite(i) ? i : 0;
    return Math.round(r + inc);
  }, [lhaRate, incentive]);

  function applySuggested() {
    if (suggested != null) setPriceMax(String(suggested));
  }

  // Location autocomplete — jaise Mo type kare, OpenRent se asli suggestions.
  // Debounced (250ms) taake har keystroke pe call na jaye. Suggestion select
  // karne ke baad wapas fetch na ho (pickedRef).
  useEffect(() => {
    const q = location.trim();
    if (pickedRef.current) { pickedRef.current = false; return; }
    if (q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/location-suggest?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
        setShowSug(true);
        setActiveSug(-1);
      } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [location]);

  // Bahar click = dropdown band.
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowSug(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pickSuggestion(s) {
    pickedRef.current = true;
    setLocation(s);
    setShowSug(false);
    setSuggestions([]);
  }

  function onLocationKey(e) {
    if (showSug && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && activeSug >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeSug]); return; }
      if (e.key === 'Escape') { setShowSug(false); return; }
    }
    if (e.key === 'Enter') save();
  }

  async function save() {
    const loc = location.trim();
    if (!loc) { setOk(false); setMsg('Enter a location first.'); return; }
    setBusy(true); setMsg(''); setOk(false);
    try {
      const r = await fetch('/api/search/save-filter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: loc,
          radius: radius === '' ? null : Number(radius), // km
          bedsMin: bedsMin === '' ? null : Number(bedsMin),
          bedsMax: bedsMax === '' ? null : Number(bedsMax),
          priceMin: priceMin === '' ? null : Number(priceMin),
          priceMax: priceMax === '' ? null : Number(priceMax),
        }),
      });
      const j = await r.json();
      if (!r.ok) { setOk(false); setMsg(j?.error || "Couldn't save."); }
      else if (j.already) { setOk(true); setMsg(`"${j.name}" is already saved.`); }
      else {
        setOk(true);
        setMsg(`Saved "${j.name}". The bot will scrape it on its next run and only keep ${describeRange(j.filters)}.`);
      }
    } catch {
      setOk(false); setMsg("Couldn't save — try again.");
    }
    setBusy(false);
  }

  return (
    <div style={{ border: '1px solid var(--mist-line)', borderRadius: 14, padding: '18px 18px 20px', background: 'var(--surface)', marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>New search</div>
      <div className="text-muted" style={{ fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
        Set the location, bedrooms and rent. The bot searches OpenRent on a schedule
        and only keeps listings that fit. No links to paste.
      </div>

      {/* Location + radius row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-start' }}>
        {/* Location with OpenRent autocomplete */}
        <div ref={boxRef} style={{ flex: '1 1 280px', position: 'relative' }}>
          <label style={labelStyle}>Location</label>
          <input
            style={inputStyle}
            placeholder="Start typing — e.g. Bexley, Bromley, SE9"
            value={location}
            autoComplete="off"
            onChange={(e) => setLocation(e.target.value)}
            onFocus={() => suggestions.length && setShowSug(true)}
            onKeyDown={onLocationKey}
          />
          {showSug && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4,
              background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 10,
              boxShadow: 'var(--shadow-card)', overflow: 'hidden', maxHeight: 320, overflowY: 'auto',
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                  onMouseEnter={() => setActiveSug(i)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                    fontSize: 13, border: 'none', cursor: 'pointer', color: 'var(--paper)',
                    background: i === activeSug ? 'rgba(180,140,60,0.14)' : 'transparent',
                    borderTop: i === 0 ? 'none' : '1px solid var(--mist-line)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Radius (km) — OpenRent 'area' param, km */}
        <div style={{ flex: '0 1 150px' }}>
          <label style={labelStyle}>Within (km)</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={radius} onChange={(e) => setRadius(e.target.value)}>
            <option value="0">This area only</option>
            <option value="1">1 km</option>
            <option value="3">3 km</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="15">15 km</option>
            <option value="20">20 km</option>
            <option value="25">25 km</option>
          </select>
        </div>
      </div>

      {/* Beds + Price row */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={labelStyle}>Bedrooms</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select style={{ ...inputStyle, width: 'auto', flex: 1, cursor: 'pointer' }} value={bedsMin} onChange={(e) => setBedsMin(e.target.value)}>
              {BEDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <span className="text-muted" style={{ fontSize: 12 }}>to</span>
            <select style={{ ...inputStyle, width: 'auto', flex: 1, cursor: 'pointer' }} value={bedsMax} onChange={(e) => setBedsMax(e.target.value)}>
              {BEDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div style={{ flex: '1 1 240px' }}>
          <label style={labelStyle}>Rent per month (£)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" inputMode="numeric" style={inputStyle} placeholder="Min (optional)" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
            <span className="text-muted" style={{ fontSize: 12 }}>to</span>
            <input type="number" inputMode="numeric" style={inputStyle} placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
          </div>
        </div>
      </div>

      {/* LHA helper — optional, to auto-fill the max rent */}
      <button
        type="button"
        onClick={() => setShowHelper((s) => !s)}
        style={{ fontSize: 12, color: 'var(--brass)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showHelper ? 12 : 4 }}
      >
        {showHelper ? '− Hide rent helper' : '+ Work out max rent from LHA rate + incentive'}
      </button>

      {showHelper && (
        <div style={{ border: '1px dashed var(--mist-line)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, background: 'var(--bg)' }}>
          <div className="text-muted" style={{ fontSize: 11.5, marginBottom: 10, lineHeight: 1.5 }}>
            Enter the borough&apos;s LHA rate and the council incentive for this bed size.
            Max rent is worked out for you — you can still edit it after.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 130px' }}>
              <label style={labelStyle}>LHA rate (PM)</label>
              <input type="number" inputMode="numeric" style={inputStyle} placeholder="e.g. 1196" value={lhaRate} onChange={(e) => setLhaRate(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label style={labelStyle}>Incentive (PM)</label>
              <input type="number" inputMode="numeric" style={inputStyle} placeholder="e.g. 417" value={incentive} onChange={(e) => setIncentive(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={labelStyle}>Max rent</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, minWidth: 70 }}>
                  {suggested != null ? `£${suggested.toLocaleString('en-GB')}` : '—'}
                </div>
                <button
                  type="button"
                  onClick={applySuggested}
                  disabled={suggested == null}
                  className="btn-brass"
                  style={{ borderRadius: 9, padding: '7px 12px', fontSize: 12, opacity: suggested == null ? 0.5 : 1 }}
                >
                  Use this
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        <button onClick={save} disabled={busy || !location.trim()} className="btn-brass" style={{ borderRadius: 999, padding: '0 22px', height: 42 }}>
          {busy ? 'Saving…' : 'Save search'}
        </button>
        {msg && (
          <span style={{ fontSize: 12.5, color: ok ? 'var(--green)' : 'var(--rust)', maxWidth: 420, lineHeight: 1.5 }}>{msg}</span>
        )}
      </div>
    </div>
  );
}

function describeRange(f = {}) {
  const bits = [];
  if (f.bedsMin != null && f.bedsMax != null) bits.push(`${f.bedsMin}-${f.bedsMax} bed`);
  else if (f.bedsMin != null) bits.push(`${f.bedsMin}+ bed`);
  else if (f.bedsMax != null) bits.push(`up to ${f.bedsMax} bed`);
  if (f.priceMin != null && f.priceMax != null) bits.push(`£${f.priceMin}-${f.priceMax}`);
  else if (f.priceMax != null) bits.push(`up to £${f.priceMax}`);
  else if (f.priceMin != null) bits.push(`£${f.priceMin}+`);
  return bits.length ? bits.join(', ') : 'matching listings';
}
