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
import { sourceLabel } from '@/components/crm-bits';

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
          No order rate set. Matches can be found and scored, but margins cannot be calculated. Add an order rate to see profitability.
        </div>
      )}

      {/* ── Shortlisted ── */}
      <Section
        title="Shortlisted"
        count={shortlisted.length}
        empty={matches.length ? 'Nothing shortlisted yet. Shortlist the strongest matches below.' : null}
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
            : 'No results yet. Click “Find properties”: the search runs on this order’s exact requirements and budget.'
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
            {matches.length ? 'Nothing over budget from the last search.' : '-'}
          </p>
        ) : !showOverBudget ? (
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            {overBudget.length} propert{overBudget.length === 1 ? 'y' : 'ies'} above the £{order.max_rent} ceiling, hidden from normal matches by the budget rule.
          </p>
        ) : (
          <div className="presult-grid">
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
        <div className="presult-grid">{items}</div>
      )}
    </div>
  );
}

// ── Compact property result ─────────────────────────────────────────────────
// Redesign directive: property cards huge NAHI. Thumbnail left (sirf pehchan),
// facts right: place + rent → match/budget checks → margin → actions.
// Sawal wahi hai: fit? budget? kitne paise? ab kya karun? — bas ek nazar me.

function MatchCard({ m, order, busy, onShortlist }) {
  const l = m.listing || {};
  const raw = l.address || l.area || l.title || `#${m.listing_id}`;
  const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');
  const reasons = m.reasons || [];
  const rejections = m.rejections || [];
  const shortlisted = m.shortlist_status === 'shortlisted';
  const beforeCosts = m.costs_estimated; // costs order me nahi diye gaye thay
  const underBudget = !m.over_budget && order.max_rent != null && l.price != null
    ? Number(order.max_rent) - Number(l.price)
    : null;

  const statusColor = { good: 'var(--green)', ok: 'var(--brass)', low: 'var(--mist)', loss: 'var(--rust)' }[m.profitability_status] || 'var(--mist)';

  return (
    <div className="presult" style={{ opacity: busy ? 0.6 : 1 }}>
      <div className="presult-thumb">
        {l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" loading="lazy" />
        ) : (
          <div className="text-muted" style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 11 }}>
            no photo
          </div>
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* line 1: pehchan + rent */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {[l.beds != null && `${l.beds} bed`, place].filter(Boolean).join(' · ')}
          </span>
          <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 700, flexShrink: 0 }}>
            £{Number(l.price ?? 0).toLocaleString('en-GB')} pcm
          </span>
        </div>

        {/* line 2: match + budget position + margin — faislay ke numbers */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, alignItems: 'baseline' }}>
          {m.over_budget ? (
            <span style={{ fontWeight: 700, color: 'var(--rust)' }}>Over budget</span>
          ) : m.match_score != null ? (
            <span className="font-mono" style={{ fontWeight: 700 }}>{m.match_score}% match</span>
          ) : null}
          {underBudget != null && underBudget > 0 && (
            <span style={{ color: 'var(--green)' }}>£{underBudget.toLocaleString('en-GB')} under budget</span>
          )}
          {m.net_monthly_margin != null ? (
            <span className="font-mono" style={{ fontWeight: 700, color: statusColor }}>
              £{Number(m.net_monthly_margin).toLocaleString('en-GB')}/mo
              {beforeCosts && <span className="text-muted" style={{ fontWeight: 400 }}> before costs</span>}
            </span>
          ) : (
            <span className="text-muted">no rate set</span>
          )}
          {shortlisted && (
            <span className="badge" style={{ '--badge-c': 'var(--brass)' }}><span className="badge-dot" />Shortlisted</span>
          )}
        </div>

        {/* line 3: reasons/checks + baths/epc */}
        <div className="text-muted" style={{ fontSize: 11.5, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.over_budget && rejections.length > 0
            ? rejections[0]
            : [
                ...reasons.slice(0, 3),
                l.baths != null && `${l.baths} bath`,
                l.epc && `EPC ${l.epc}`,
              ].filter(Boolean).join(' · ') || '-'}
        </div>

        {/* line 4: source + actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="text-muted" style={{ fontSize: 11.5 }}>{sourceLabel(l.source)}</span>
          {shortlisted && m.next_action && (
            <span style={{ fontSize: 11.5, color: 'var(--brass)', fontWeight: 600 }}>Next: {m.next_action}</span>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              className={shortlisted ? 'seg' : 'btn-brass'}
              style={{ fontSize: 11.5, padding: '5px 10px' }}
              disabled={busy}
              onClick={() => onShortlist(m.listing_id, !shortlisted)}
            >
              {busy ? '…' : shortlisted ? 'Remove' : 'Shortlist'}
            </button>
            {l.url && (
              <a href={l.url} target="_blank" rel="noreferrer" className="seg" style={{ fontSize: 11.5, padding: '5px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                View listing ↗
              </a>
            )}
            {m.Id != null && (
              <a
                href={`/sourcing/${m.Id}`}
                className="seg"
                style={{ fontSize: 11.5, padding: '5px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                title="Open the sourcing record: outreach, status and timeline live there."
              >
                Open
              </a>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
