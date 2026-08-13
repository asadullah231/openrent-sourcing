'use client';

// Order detail ka workbench — FIND PROPERTIES + teen groups:
// Eligible / Over Budget (toggle ke peechay) / Shortlisted.
//
// Server (page.js) saved order_properties rows deta hai; Find Properties
// yahan se POST hota hai aur phir router.refresh() — server dobara NocoDB se
// parh kar fresh rows de deta hai. Client apni copy nahi paalta (folder-rooms
// wale lost-update sabaq se).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export function OrderMatches({ order, matches, canProfit }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [showOverBudget, setShowOverBudget] = useState(false);
  const [rowBusy, setRowBusy] = useState(null); // listing_id jis pe action chal raha

  const shortlisted = useMemo(() => matches.filter((m) => m.shortlist_status === 'shortlisted'), [matches]);
  const eligible = useMemo(
    () => matches.filter((m) => !m.over_budget && m.shortlist_status !== 'shortlisted'),
    [matches]
  );
  const overBudget = useMemo(
    () => matches.filter((m) => m.over_budget && m.shortlist_status !== 'shortlisted'),
    [matches]
  );

  async function find() {
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const res = await fetch(`/api/orders/${order.Id}/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOverBudget: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Search failed (${res.status})`);
      setSummary(j);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function shortlist(listingId, on) {
    setRowBusy(listingId);
    setError('');
    try {
      const res = await fetch(`/api/orders/${order.Id}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, shortlisted: on }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* ── Find bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="btn-brass" onClick={find} disabled={busy} style={{ fontSize: 14, padding: '11px 22px' }}>
          {busy ? 'Searching OpenRent…' : matches.length ? 'Find properties again' : 'Find properties'}
        </button>
        {order.last_search_at && !busy && (
          <span className="text-muted" style={{ fontSize: 12 }}>
            Last search {new Date(order.last_search_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {summary && (
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            {summary.totalFound} found · {summary.eligible.length} eligible · {summary.overBudgetCount} over budget · {summary.rejectedCount} rejected on hard requirements
            {summary.enrichFailed > 0 && ` · ${summary.enrichFailed} could not be verified this run (will retry next search)`}
          </span>
        )}
      </div>

      {busy && (
        <div className="text-muted" style={{ border: '1px dashed var(--mist-line-2)', borderRadius: 'var(--r-card)', padding: 24, fontSize: 13 }}>
          Searching OpenRent with this order’s requirements, applying hard filters, scoring and pricing each match… usually 10–20 seconds.
        </div>
      )}
      {error && (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '10px 14px', fontSize: 13 }}>
          {error}
        </div>
      )}
      {summary?.warning && (
        <div style={{ border: '1px solid var(--brass)', color: 'var(--brass)', borderRadius: 'var(--r-ctrl)', padding: '10px 14px', fontSize: 13 }}>
          {summary.warning}
        </div>
      )}

      {!canProfit && (
        <div className="text-muted" style={{ fontSize: 12.5, border: '1px solid var(--mist-line)', borderRadius: 'var(--r-ctrl)', padding: '10px 14px' }}>
          No order rate set — matches can be found and scored, but margins cannot be calculated. Add an order rate to see profitability.
        </div>
      )}

      {/* ── Shortlisted ── */}
      <Section
        title="Shortlisted"
        count={shortlisted.length}
        empty={matches.length ? 'Nothing shortlisted yet — shortlist the strongest matches below.' : null}
      >
        {shortlisted.map((m) => (
          <MatchCard key={m.listing_id} m={m} order={order} busy={rowBusy === m.listing_id} onShortlist={shortlist} />
        ))}
      </Section>

      {/* ── Eligible ── */}
      <Section
        title="Eligible matches"
        count={eligible.length}
        empty={
          matches.length
            ? 'No other eligible matches right now.'
            : 'No results yet. Click “Find properties” — the search runs on this order’s exact requirements and budget.'
        }
      >
        {eligible.map((m) => (
          <MatchCard key={m.listing_id} m={m} order={order} busy={rowBusy === m.listing_id} onShortlist={shortlist} />
        ))}
      </Section>

      {/* ── Over budget (negotiation research — default band) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Over budget</h2>
          <span className="text-muted" style={{ fontSize: 12.5 }}>{overBudget.length}</span>
          {overBudget.length > 0 && (
            <button className="seg" style={{ marginLeft: 'auto' }} onClick={() => setShowOverBudget((v) => !v)}>
              {showOverBudget ? 'Hide' : 'Show for negotiation research'}
            </button>
          )}
        </div>
        {overBudget.length === 0 ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            {matches.length ? 'Nothing over budget from the last search.' : '—'}
          </p>
        ) : !showOverBudget ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            {overBudget.length} propert{overBudget.length === 1 ? 'y' : 'ies'} above the £{order.max_rent} ceiling — hidden from normal matches by the budget rule.
          </p>
        ) : (
          <div className="grid-cards">
            {overBudget.map((m) => (
              <MatchCard key={m.listing_id} m={m} order={order} busy={rowBusy === m.listing_id} onShortlist={shortlist} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h2>
        <span className="text-muted" style={{ fontSize: 12.5 }}>{count}</span>
      </div>
      {count === 0 ? (
        empty ? <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>{empty}</p> : null
      ) : (
        <div className="grid-cards">{items}</div>
      )}
    </div>
  );
}

// ── Match card ──────────────────────────────────────────────────────────────
// Card ka sawal-jawab tarteeb (PRD): fit? → budget? → kitna acha match? →
// kitne paise? → ab kya karun? Photo upar (listing-card pattern), neeche
// match/margin block, aakhir me actions.

function MatchCard({ m, order, busy, onShortlist }) {
  const l = m.listing || {};
  const raw = l.address || l.area || l.title || `#${m.listing_id}`;
  const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');
  const reasons = m.reasons || [];
  const rejections = m.rejections || [];
  const shortlisted = m.shortlist_status === 'shortlisted';
  const beforeCosts = m.costs_estimated; // costs order me nahi diye gaye thay

  const statusColor = { good: 'var(--green)', ok: 'var(--brass)', low: 'var(--mist)', loss: 'var(--rust)' }[m.profitability_status] || 'var(--mist)';
  const statusLabel = { good: 'Good deal', ok: 'Fair margin', low: 'Low margin', loss: 'Loss' }[m.profitability_status] || null;

  return (
    <div
      className="gcard"
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <div className="gcard-photo">
        {l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" loading="lazy" />
        ) : (
          <div className="text-muted" style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 12 }}>
            no photo
          </div>
        )}
        {/* Match % — photo pe sab se qeemti jagah. Over-budget pe % hota hi
            nahi (PRD rule), wahan rust badge. */}
        {m.over_budget ? (
          <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: 'var(--rust)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}>
            Over budget
          </span>
        ) : m.match_score != null ? (
          <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', color: '#fff' }}>
            {m.match_score}% match
          </span>
        ) : null}
        {shortlisted && (
          <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: 'var(--green)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}>
            Shortlisted
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {place}
          </span>
          <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 14.5, fontWeight: 600, flexShrink: 0 }}>
            £{Number(l.price ?? 0).toLocaleString('en-GB')}
          </span>
        </div>
        <div className="text-muted" style={{ fontSize: 12.5 }}>
          {[l.beds != null && `${l.beds} bed`, l.baths != null && `${l.baths} bath`, l.epc && `EPC ${l.epc}`].filter(Boolean).join(' · ') || '—'}
        </div>

        {/* Reasons — "clear reasons for the score" (MVP #6) */}
        {reasons.length > 0 && (
          <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {reasons.slice(0, 4).join(' · ')}
          </div>
        )}
        {m.over_budget && rejections.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--rust)', lineHeight: 1.5 }}>{rejections[0]}</div>
        )}

        {/* Margin block — order rate se seedha hisaab */}
        {m.net_monthly_margin != null ? (
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-ctrl)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            <div style={{ display: 'flex', fontSize: 12, justifyContent: 'space-between' }}>
              <span className="text-muted">Order rate £{Number(order.order_rate).toLocaleString('en-GB')}</span>
              <span className="text-muted">Spread £{Number(m.gross_spread).toLocaleString('en-GB')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span className="font-mono" style={{ fontSize: 14.5, fontWeight: 700, color: statusColor }}>
                £{Number(m.net_monthly_margin).toLocaleString('en-GB')}/mo
                {beforeCosts && <span className="text-muted" style={{ fontWeight: 400, fontSize: 11 }}> before costs</span>}
              </span>
              {statusLabel && (
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: statusColor }}>
                  {statusLabel}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              £{Number(m.annual_margin).toLocaleString('en-GB')}/yr{m.margin_percentage != null ? ` · ${m.margin_percentage}% of rate` : ''}
            </div>
          </div>
        ) : (
          <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
            Margin not available — order has no council rate.
          </div>
        )}

        {/* Next action — shortlisted pe (MVP #8) */}
        {shortlisted && m.next_action && (
          <div style={{ fontSize: 12, color: 'var(--brass)', fontWeight: 600 }}>Next: {m.next_action}</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            className={shortlisted ? 'seg' : 'btn-brass'}
            style={{ fontSize: 12, padding: '7px 12px' }}
            disabled={busy}
            onClick={() => onShortlist(m.listing_id, !shortlisted)}
          >
            {busy ? '…' : shortlisted ? 'Remove from shortlist' : 'Shortlist'}
          </button>
          {l.url && (
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="seg"
              style={{ fontSize: 12, padding: '7px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              View property
            </a>
          )}
          <button
            className="seg"
            style={{ fontSize: 12, padding: '7px 12px', opacity: 0.5, cursor: 'default' }}
            title="Outreach comes in Phase 3 — it will use the existing viewing-request engine."
            disabled
          >
            Outreach
          </button>
        </div>
      </div>
    </div>
  );
}
