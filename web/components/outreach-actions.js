'use client';

// /outreach row ke quick actions — Open OpenRent / Queue / Log follow-up /
// Mark interested / not interested / no response. Har action ke baad
// router.refresh() — server dobara NocoDB parh kar page taza karta hai
// (lead-actions wala hi usool, client apni copy nahi paalta).
//
// Queue button seedha kuch NAHI bhejta — /api/leads/[id]/queue existing
// engine ko trigger karta hai (cap/mode/idempotency sab engine ke paas).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OutreachActions({ lead, show = [] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupDate, setFollowupDate] = useState('');

  async function call(url, method, body) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error(j.error || `Failed (${res.status})`);
      if (j.message) setMsg(j.message);
      router.refresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const url = lead.listing?.url || null;
  const has = (k) => show.includes(k);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="seg" style={{ textDecoration: 'none' }}>
            Open OpenRent ↗
          </a>
        ) : (
          <span className="text-muted" style={{ fontSize: 11.5, alignSelf: 'center' }}>Listing URL unavailable</span>
        )}
        {has('queue') && (
          <button className="btn-brass" disabled={busy} onClick={() => call(`/api/leads/${lead.Id}/queue`, 'POST')}>
            {busy ? 'Queuing…' : 'Queue outreach'}
          </button>
        )}
        {has('followup') && (
          <button
            className="seg"
            disabled={busy}
            style={followupOpen ? { color: 'var(--paper)', borderColor: 'var(--accent)' } : undefined}
            onClick={() => setFollowupOpen(!followupOpen)}
          >
            Log follow-up
          </button>
        )}
        {has('interested') && (
          <button
            className="seg"
            disabled={busy}
            style={{ color: 'var(--green)' }}
            onClick={() => call(`/api/leads/${lead.Id}/response`, 'POST', { outcome: 'interested' })}
          >
            Interested
          </button>
        )}
        {has('not_interested') && (
          <button
            className="seg"
            disabled={busy}
            onClick={() => call(`/api/leads/${lead.Id}/response`, 'POST', { outcome: 'not_interested' })}
          >
            Not interested
          </button>
        )}
        {has('no_response') && (
          <button
            className="seg"
            disabled={busy}
            style={{ color: 'var(--rust)' }}
            onClick={() =>
              call(`/api/leads/${lead.Id}`, 'PATCH', {
                lead_status: 'lost',
                loss_reason: 'no_response',
                outreach_status: 'no_response',
              })
            }
          >
            No response
          </button>
        )}
      </div>

      {followupOpen && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label className="text-muted" style={{ fontSize: 11 }}>Next follow-up</label>
          <input
            type="date"
            className="field"
            style={{ width: 140 }}
            value={followupDate}
            onChange={(e) => setFollowupDate(e.target.value)}
          />
          <button
            className="btn-brass"
            disabled={busy}
            onClick={async () => {
              await call(`/api/leads/${lead.Id}/outreach`, 'POST', {
                type: 'follow_up',
                next_followup: followupDate || undefined,
              });
              setFollowupOpen(false);
              setFollowupDate('');
            }}
          >
            {busy ? 'Saving…' : 'Log it'}
          </button>
        </div>
      )}

      {msg && (
        <div className="text-muted" style={{ fontSize: 11.5, maxWidth: 340, textAlign: 'right' }}>{msg}</div>
      )}
    </div>
  );
}
