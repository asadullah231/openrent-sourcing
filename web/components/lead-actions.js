'use client';

// Lead ke sab actions — Open OpenRent / shortlist / Log outreach / note /
// pipeline status / next action. Har mutation ke baad router.refresh():
// server dobara NocoDB se parh kar poora page taza kar deta hai — client
// apni copy nahi paalta (order-matches wala hi usool).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEAD_STATUSES, OUTREACH_STATUSES, LOSS_REASONS } from '@/lib/leads';
import { sourceLabel } from '@/components/crm-bits';

export function LeadActions({ lead }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState(null); // 'outreach' | 'note' | null
  const [pendingLost, setPendingLost] = useState(false);

  // Outreach form
  const [oType, setOType] = useState('message');
  const [oNotes, setONotes] = useState('');
  const [oFollowup, setOFollowup] = useState('');
  // Note form
  const [noteText, setNoteText] = useState('');
  // Next action editor
  const [action, setAction] = useState(lead.next_action || '');
  const [actionDate, setActionDate] = useState(lead.next_action_date || '');
  // Lost reason
  const [lossReason, setLossReason] = useState(lead.loss_reason || 'other');

  async function call(url, method, body) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      if (j.warning) setError(j.warning);
      router.refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const patch = (body) => call(`/api/leads/${lead.Id}`, 'PATCH', body);

  async function onStatusChange(value) {
    if (value === 'lost') {
      setPendingLost(true); // pehle wajah, phir mark — bina reason 'lost' nahi
      return;
    }
    setPendingLost(false);
    await patch({ lead_status: value });
  }

  async function logOutreach() {
    const ok = await call(`/api/leads/${lead.Id}/outreach`, 'POST', {
      type: oType,
      notes: oNotes.trim() || undefined,
      next_followup: oFollowup || undefined,
    });
    if (ok) {
      setPanel(null);
      setONotes('');
      setOFollowup('');
    }
  }

  async function addNote() {
    const ok = await call(`/api/leads/${lead.Id}/note`, 'POST', { text: noteText });
    if (ok) {
      setPanel(null);
      setNoteText('');
    }
  }

  const shortlisted = lead.shortlist_status === 'shortlisted';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Primary actions ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Original listing URL persisted snapshot se — na ho to broken link
            nahi, saaf "unavailable" (URL kabhi generate nahi karte). */}
        {lead.listing?.url ? (
          <a href={lead.listing.url} target="_blank" rel="noreferrer" className="btn-brass" style={{ textDecoration: 'none' }}>
            Open {sourceLabel(lead.listing?.source)} ↗
          </a>
        ) : (
          <span className="text-muted" style={{ fontSize: 12.5, alignSelf: 'center' }}>Listing URL unavailable</span>
        )}
        <button
          className="seg"
          disabled={busy}
          onClick={() => patch({ lead_status: shortlisted ? 'matched' : 'shortlisted' })}
        >
          {shortlisted ? 'Remove from shortlist' : 'Shortlist'}
        </button>
        <button
          className="seg"
          style={panel === 'outreach' ? { color: 'var(--paper)', borderColor: 'var(--accent)' } : undefined}
          onClick={() => setPanel(panel === 'outreach' ? null : 'outreach')}
        >
          Log outreach
        </button>
        <button
          className="seg"
          style={panel === 'note' ? { color: 'var(--paper)', borderColor: 'var(--accent)' } : undefined}
          onClick={() => setPanel(panel === 'note' ? null : 'note')}
        >
          Add note
        </button>

        {/* ── Pipeline controls ── */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="text-muted" style={{ fontSize: 11.5 }}>Status</label>
          <select
            className="field"
            style={{ width: 170 }}
            value={pendingLost ? 'lost' : lead.status}
            disabled={busy}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <label className="text-muted" style={{ fontSize: 11.5 }}>Outreach</label>
          <select
            className="field"
            style={{ width: 160 }}
            value={lead.outreach_status}
            disabled={busy}
            onChange={(e) => patch({ outreach_status: e.target.value })}
          >
            {OUTREACH_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Lost needs a reason first ── */}
      {pendingLost && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '10px 12px' }}>
          <span style={{ fontSize: 12.5, color: 'var(--rust)', fontWeight: 600 }}>Why was this lead lost?</span>
          <select className="field" style={{ width: 190 }} value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
            {LOSS_REASONS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <button
            className="btn-brass"
            disabled={busy}
            style={{ background: 'var(--rust)' }}
            onClick={async () => {
              const ok = await patch({ lead_status: 'lost', loss_reason: lossReason });
              if (ok) setPendingLost(false);
            }}
          >
            Mark as lost
          </button>
          <button className="seg" onClick={() => setPendingLost(false)}>Cancel</button>
        </div>
      )}

      {/* ── Log outreach panel ── */}
      {panel === 'outreach' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Send the message inside OpenRent first, then record it here. Channel: OpenRent.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="field" style={{ width: 200 }} value={oType} onChange={(e) => setOType(e.target.value)}>
              <option value="message">Message sent</option>
              <option value="viewing_request">Viewing request sent</option>
              <option value="follow_up">Follow-up sent</option>
              <option value="response">Landlord responded</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label className="text-muted" style={{ fontSize: 11.5 }}>Next follow-up</label>
              <input type="date" className="field" style={{ width: 150 }} value={oFollowup} onChange={(e) => setOFollowup(e.target.value)} />
            </div>
          </div>
          <textarea
            className="field"
            rows={3}
            placeholder="Notes (optional) — what was said, price discussed, availability…"
            value={oNotes}
            onChange={(e) => setONotes(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-brass" disabled={busy} onClick={logOutreach}>
              {busy ? 'Saving…' : 'Log it'}
            </button>
            <button className="seg" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Note panel ── */}
      {panel === 'note' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            className="field"
            rows={3}
            placeholder="Note for the timeline…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-brass" disabled={busy || !noteText.trim()} onClick={addNote}>
              {busy ? 'Saving…' : 'Save note'}
            </button>
            <button className="seg" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Next action editor ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="text-muted" style={{ fontSize: 11.5 }}>Next action</label>
        <input
          className="field"
          style={{ maxWidth: 280 }}
          placeholder="e.g. Contact landlord on OpenRent"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <input type="date" className="field" style={{ width: 150 }} value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
        {(action !== (lead.next_action || '') || actionDate !== (lead.next_action_date || '')) && (
          <button
            className="seg"
            disabled={busy}
            onClick={() => patch({ next_action: action.trim(), next_action_date: actionDate })}
          >
            Save
          </button>
        )}
      </div>

      {error && (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '10px 14px', fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}
