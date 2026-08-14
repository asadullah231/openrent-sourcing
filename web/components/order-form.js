'use client';

// New Order form — PRD section 2 ke fields. Search-form.js wale patterns
// (fields grid, .field class, inline validation, busy state).
//
// Sab se aham do cheezein UPAR aur required: Area (search isi pe chalti hai)
// aur Max Rent (hard budget rule). Order Rate profitability ke liye — required
// nahi, magar na ho to detail page saaf batata hai ke margin nahi ban sakta.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const L = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--mist)', marginBottom: 5 };
const ROW = { display: 'grid', gap: 14 };

export function OrderForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({
    council_client: '', area: '', postcodes: '', property_type: '',
    bedrooms: '2', bedrooms_max: '', min_rent: '', max_rent: '', order_rate: '',
    availability: 'ASAP', furnished: '', priority: 'normal', deadline: '',
    special_requirements: '', notes: '', agent_fee: '', other_costs: '',
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // ── Paste an OpenRent search link → fields fill khud (13 Aug directive) ──
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkOk, setLinkOk] = useState(false);

  async function parseLink() {
    setLinkError('');
    setLinkOk(false);
    if (!link.trim()) return setLinkError('Paste an OpenRent search link first.');
    setLinkBusy(true);
    try {
      const res = await fetch('/api/orders/parse-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Could not read that link (${res.status})`);
      setF((p) => ({
        ...p,
        area: j.order.area || p.area,
        bedrooms: j.order.bedrooms !== '' ? String(j.order.bedrooms) : p.bedrooms,
        bedrooms_max: j.order.bedrooms_max !== '' ? String(j.order.bedrooms_max) : p.bedrooms_max,
        max_rent: j.order.max_rent !== '' ? String(j.order.max_rent) : p.max_rent,
        min_rent: j.order.min_rent !== '' ? String(j.order.min_rent) : p.min_rent,
        notes: [p.notes, j.order.notes].filter(Boolean).join('\n'),
      }));
      setLinkOk(true);
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!f.area.trim()) return setError('Area is required. The property search runs on it.');
    if (!f.max_rent || Number(f.max_rent) <= 0) return setError('Maximum rent is required. It is the hard budget ceiling.');
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      router.push(`/orders/${j.order.Id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── Paste a link ── */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-card)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Paste an OpenRent search link</h2>
        <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
          Build a search on OpenRent (area, beds, max price), copy the address bar link, paste it here.
          Area, bedrooms and max rent fill in below, ready to check and create.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="field"
            style={{ flex: '1 1 320px' }}
            placeholder="https://www.openrent.co.uk/properties-to-rent/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button type="button" className="btn-brass" onClick={parseLink} disabled={linkBusy}>
            {linkBusy ? 'Reading…' : 'Fill from link'}
          </button>
        </div>
        {linkError && (
          <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '8px 12px', fontSize: 12.5 }}>
            {linkError}
          </div>
        )}
        {linkOk && !linkError && (
          <div style={{ color: 'var(--green)', fontSize: 12.5 }}>
            Filled in below. Check the area, bedrooms and max rent, then add a council rate if you have one.
          </div>
        )}
      </section>

      {/* ── Requirement ── */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Requirement</h2>
        <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={L}>Council / Client</label>
            <input className="field" placeholder="e.g. Bromley Council" value={f.council_client} onChange={set('council_client')} />
          </div>
          <div>
            <label style={L}>Area *</label>
            <input className="field" placeholder="e.g. Bromley" value={f.area} onChange={set('area')} required />
          </div>
        </div>
        <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={L}>Postcodes (optional)</label>
            <input className="field" placeholder="e.g. BR1, BR2" value={f.postcodes} onChange={set('postcodes')} />
          </div>
          <div>
            <label style={L}>Property type</label>
            <select className="field" value={f.property_type} onChange={set('property_type')}>
              <option value="">Any</option>
              <option value="house">House</option>
              <option value="flat">Flat</option>
              <option value="maisonette">Maisonette</option>
              <option value="studio">Studio</option>
              <option value="bungalow">Bungalow</option>
            </select>
          </div>
        </div>
        <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label style={L}>Bedrooms (min)</label>
            <input className="field" type="number" min="0" value={f.bedrooms} onChange={set('bedrooms')} />
          </div>
          <div>
            <label style={L}>Bedrooms (max, optional)</label>
            <input className="field" type="number" min="0" value={f.bedrooms_max} onChange={set('bedrooms_max')} />
          </div>
          <div>
            <label style={L}>Furnished</label>
            <select className="field" value={f.furnished} onChange={set('furnished')}>
              <option value="">Any</option>
              <option value="furnished">Furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Budget & rate ── */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Budget & rate</h2>
        <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label style={L}>Maximum rent (pcm) *</label>
            <input className="field" type="number" min="0" placeholder="Hard ceiling, e.g. 1500" value={f.max_rent} onChange={set('max_rent')} required />
          </div>
          <div>
            <label style={L}>Minimum rent (optional)</label>
            <input className="field" type="number" min="0" value={f.min_rent} onChange={set('min_rent')} />
          </div>
          <div>
            <label style={L}>Order / council rate (pcm)</label>
            <input className="field" type="number" min="0" placeholder="e.g. 1800" value={f.order_rate} onChange={set('order_rate')} />
          </div>
        </div>
        <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={L}>Agent fee (pcm, optional)</label>
            <input className="field" type="number" min="0" placeholder="Leave empty if none" value={f.agent_fee} onChange={set('agent_fee')} />
          </div>
          <div>
            <label style={L}>Other costs (pcm, optional)</label>
            <input className="field" type="number" min="0" placeholder="Leave empty if none" value={f.other_costs} onChange={set('other_costs')} />
          </div>
        </div>
        <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
          Net margin = order rate − rent − agent fee − other costs. If costs are left empty they count as £0 and margins are labelled “before costs”.
        </p>
      </section>

      {/* ── Timing & context ── */}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Timing & context</h2>
        <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label style={L}>Availability needed</label>
            <input className="field" placeholder="ASAP or a date" value={f.availability} onChange={set('availability')} />
          </div>
          <div>
            <label style={L}>Priority</label>
            <select className="field" value={f.priority} onChange={set('priority')}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label style={L}>Deadline (optional)</label>
            <input className="field" type="date" value={f.deadline} onChange={set('deadline')} />
          </div>
        </div>
        <div>
          <label style={L}>Special requirements</label>
          <textarea className="field" rows={2} placeholder="e.g. ground floor, garden, near schools" value={f.special_requirements} onChange={set('special_requirements')} />
        </div>
        <div>
          <label style={L}>Notes</label>
          <textarea className="field" rows={2} value={f.notes} onChange={set('notes')} />
        </div>
      </section>

      {error && (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '10px 14px', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn-brass" disabled={busy}>
          {busy ? 'Creating…' : 'Create order'}
        </button>
        <button type="button" className="seg" onClick={() => router.push('/orders')} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
