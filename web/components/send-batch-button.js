'use client';

import { useState } from 'react';

// "Send a batch now" — Asad ka qadam #3 (23 Jul).
//
// Dabate hi bot VPS pe ek batch chalata hai (scrape + jitni perRunCap kehti
// hai utni viewing requests). Cron se alag — ye Mo ka "abhi bhejo" control.
//
// ⚠️ Live mode me ye ASLI messages Mo ke account se bhejta hai. Flood se
// bachao bot ke andar hai (perRunCap + delay). Yahan sirf double-click rokte
// hain — chalte hue dobara na dabe.
export function SendBatchButton() {
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [summary, setSummary] = useState([]);
  const [err, setErr] = useState('');

  async function run() {
    if (state === 'running') return;
    setState('running');
    setSummary([]);
    setErr('');
    try {
      const res = await fetch('/api/outreach/run', { method: 'POST' });
      const j = await res.json();
      if (res.ok) {
        setSummary(j.summary || []);
        setState('done');
      } else {
        setErr(j?.error || "Batch didn't run.");
        setState('error');
      }
    } catch {
      setErr("Couldn't trigger. Try again.");
      setState('error');
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={state === 'running'}
        className="btn-brass"
        style={{ fontSize: 14, padding: '11px 20px' }}
      >
        {state === 'running' ? 'Sending…' : 'Send a batch now'}
      </button>

      {state === 'running' && (
        <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          The bot is running: scraping and sending. Takes 30-60 seconds.
        </div>
      )}

      {state === 'done' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500, marginBottom: 6 }}>
            ✓ Batch done
          </div>
          {summary.length > 0 ? (
            <div
              className="font-mono text-muted"
              style={{
                fontSize: 11.5,
                lineHeight: 1.7,
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--mist-line)',
                borderRadius: 'var(--r-ctrl)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary.join('\n')}
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: 12.5 }}>
              See details on the Outreach page.
            </div>
          )}
        </div>
      )}

      {state === 'error' && (
        <div style={{ fontSize: 12.5, color: 'var(--rust)', marginTop: 10 }}>{err}</div>
      )}
    </div>
  );
}
