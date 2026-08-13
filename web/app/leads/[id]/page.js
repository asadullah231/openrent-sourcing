// Lead detail — CRM ka sab se aham page. Sawal ek hi hai: IS LEAD PE AGLA
// QADAM KYA HAI? Upar pehchaan + actions (client), neeche property / order /
// landlord / match / margin ke cards, aakhir me activity timeline.
//
// Server component: lead + activities NocoDB se. Sab actions LeadActions
// (client) me hain jo router.refresh() se yehi data dobara mangwata hai.

import Link from 'next/link';
import { getLead } from '@/lib/leads';
import { getActivities } from '@/lib/activities';
import { syncEngineOutreach } from '@/lib/outreach-sync';
import { LeadActions } from '@/components/lead-actions';
import { ActivityTimeline, derivedLeadEvents } from '@/components/activity-timeline';
import { LeadStatusBadge, OutreachBadge, money, leadPropertyLine, deentity, sourceLabel, SourceListingLine } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

function Card({ title, children, style }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', padding: '16px 18px', ...style }}>
      <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Fact({ label, children, strong = false }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div className={strong ? 'font-mono' : ''} style={{ fontSize: strong ? 14.5 : 13, fontWeight: strong ? 700 : 500, marginTop: 2 }}>
        {children ?? '—'}
      </div>
    </div>
  );
}

export default async function LeadDetailPage({ params }) {
  const { id } = await params;

  let lead = null;
  let activities = [];
  let engine = null;
  let loadError = null;
  try {
    lead = await getLead(id);
    if (lead) {
      // Engine ne is listing pe bhej diya ho to lead ko yahin CONTACTED
      // sync kar do (bot leads nahi likh sakta) — activities us ke BAAD
      // parhte hain taake naya "message sent" event bhi timeline me aa jaye.
      const sync = await syncEngineOutreach([lead]);
      engine = sync.engineState.get(String(lead.listing_id)) || null;
      activities = await getActivities({ leadRowId: lead.Id });
    }
  } catch (e) {
    loadError = e.message;
  }

  if (loadError) {
    return (
      <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13 }}>
        Could not load the lead: {loadError}
      </div>
    );
  }
  if (!lead) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Lead not found</p>
        <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>It may have been removed by a newer search.</p>
        <Link href="/leads" className="btn-brass" style={{ textDecoration: 'none' }}>Back to leads</Link>
      </div>
    );
  }

  const l = lead.listing || {};
  const o = lead.order;
  const orderLabel = o?.order_number || (lead.order_id != null ? `ORD-${String(lead.order_id).padStart(4, '0')}` : '—');
  const statusColor = { good: 'var(--green)', ok: 'var(--brass)', low: 'var(--mist)', loss: 'var(--rust)' }[lead.profitability_status] || 'var(--mist)';
  const statusLabel = { good: 'Good deal', ok: 'Fair margin', low: 'Low margin', loss: 'Loss' }[lead.profitability_status] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── Header ── */}
      <div>
        <Link href="/leads" className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>
          ← Leads
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 className="font-mono" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{lead.ref}</h1>
          <LeadStatusBadge status={lead.status} />
          <OutreachBadge status={lead.outreach_status} size={10.5} />
          {lead.over_budget && (
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rust)' }}>
              Over budget
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.5, fontWeight: 600 }}>{leadPropertyLine(lead)}</span>
          <span className="font-mono" style={{ fontSize: 15.5, fontWeight: 700 }}>{money(l.price)} pcm</span>
          {lead.match_score != null && (
            <span className="font-mono" style={{ fontSize: 13.5, fontWeight: 600 }}>{lead.match_score}% match</span>
          )}
          {lead.net_monthly_margin != null && (
            <span className="font-mono" style={{ fontSize: 13.5, fontWeight: 700, color: statusColor }}>
              {money(lead.net_monthly_margin)}/mo net{lead.costs_estimated ? ' (before costs)' : ''}
            </span>
          )}
        </div>
        {lead.status === 'lost' && lead.loss_reason && (
          <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--rust)' }}>
            Lost — {lead.loss_reason.replace(/_/g, ' ')}
          </div>
        )}
      </div>

      {/* ── Actions + pipeline controls (client) ── */}
      <LeadActions lead={lead} />

      {/* ── Record cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Card title="Property">
          <div style={{ display: 'flex', gap: 14 }}>
            {l.image && (
              <a href={l.url || l.image} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.image} alt="" style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 8, display: 'block', background: 'var(--skeleton)' }} />
              </a>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
              <Fact label="Rent" strong>{money(l.price)}</Fact>
              <Fact label="Bedrooms">{l.beds ?? '—'}</Fact>
              <Fact label="Bathrooms">{l.baths ?? '—'}</Fact>
              <Fact label="EPC">{l.epc || '—'}</Fact>
              <Fact label="Furnishing">{l.furnishing || (l.furnished === true ? 'Furnished' : l.furnished === false ? 'Unfurnished' : '—')}</Fact>
              <Fact label="Available">{l.available_from_days != null ? (l.available_from_days <= 0 ? 'Now' : `In ${l.available_from_days} days`) : '—'}</Fact>
            </div>
          </div>
          {(l.address || l.title) && (
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
              {l.title && <div>{deentity(l.title)}</div>}
              {l.address && <div>{deentity(l.address)}</div>}
            </div>
          )}
          {/* Original listing — persisted snapshot ki url (kabhi generate nahi hoti) */}
          <div style={{ marginTop: 10 }}>
            <SourceListingLine listing={l} size={12.5} />
          </div>
        </Card>

        <Card title="Order">
          {o ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Fact label="Order">
                <Link href={`/orders/${o.Id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }} className="font-mono">
                  {orderLabel}
                </Link>
              </Fact>
              <Fact label="Client">{o.council_client || '—'}</Fact>
              <Fact label="Area">{[o.area, o.postcodes].filter(Boolean).join(' · ')}</Fact>
              <Fact label="Requirement">
                {[o.bedrooms != null && `${o.bedrooms}${o.bedrooms_max ? `–${o.bedrooms_max}` : '+'} bed`, o.property_type !== 'any' && o.property_type].filter(Boolean).join(' ') || 'Any'}
              </Fact>
              <Fact label="Max rent" strong>{money(o.max_rent)}</Fact>
              <Fact label="Order rate" strong>{money(o.order_rate)}</Fact>
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Order {orderLabel} could not be loaded.</p>
          )}
        </Card>

        <Card title="Landlord / agent">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fact label="Name">{l.landlord_name || 'Not known yet'}</Fact>
            <Fact label="Response rate">{l.response_rate != null ? `${l.response_rate}%` : '—'}</Fact>
            <Fact label="Source">{sourceLabel(l.source)}</Fact>
            <Fact label="Contact">Via {sourceLabel(l.source)} listing</Fact>
          </div>
          <p className="text-muted" style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5 }}>
            All contact happens inside OpenRent — open the listing and message the landlord there, then log it here.
          </p>
        </Card>

        <Card title="Match">
          {lead.match_score != null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="font-mono" style={{ fontSize: 20, fontWeight: 700 }}>{lead.match_score}%</div>
              {[
                ['Budget', lead.budget_score, 30],
                ['Location', lead.location_score, 25],
                ['Bedrooms', lead.bedroom_score, 15],
                ['Type', lead.property_type_score, 10],
                ['Availability', lead.availability_score, 10],
                ['Furnishing', lead.furnishing_score, 5],
                ['EPC', lead.epc_score, 5],
              ].map(([label, v, max]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span className="text-muted" style={{ width: 78, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ((v ?? 0) / max) * 100)}%`, height: '100%', background: 'var(--accent)' }} />
                  </div>
                  <span className="font-mono text-muted" style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
                    {v ?? 0}/{max}
                  </span>
                </div>
              ))}
              {lead.reasons.length > 0 && (
                <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>
                  {lead.reasons.slice(0, 4).join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              {lead.over_budget
                ? `No match score — over the order's budget. ${lead.rejections[0] || ''}`
                : 'No match score recorded.'}
            </p>
          )}
        </Card>

        <Card title="Profitability">
          {lead.net_monthly_margin != null && o ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="text-muted">Order rate</span>
                <span className="font-mono">{money(o.order_rate)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="text-muted">Rent</span>
                <span className="font-mono">− {money(l.price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="text-muted">Costs{lead.costs_estimated ? ' (not specified)' : ''}</span>
                <span className="font-mono">− {money((lead.agent_fee ?? 0) + (lead.other_costs ?? 0))}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--mist-line)', paddingTop: 6, alignItems: 'baseline' }}>
                <span className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: statusColor }}>
                  {money(lead.net_monthly_margin)}/mo
                </span>
                {statusLabel && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: statusColor }}>
                    {statusLabel}
                  </span>
                )}
              </div>
              <div className="text-muted" style={{ fontSize: 11.5 }}>
                {money(lead.annual_margin)}/yr{lead.margin_percentage != null ? ` · ${lead.margin_percentage}% of rate` : ''}
                {lead.costs_estimated ? ' · before costs' : ''}
              </div>
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              Margin not available — the order has no rate set.
            </p>
          )}
        </Card>

        <Card title="Outreach">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fact label="Attempts" strong>{lead.contact_attempts || 0}</Fact>
            <Fact label="Last contacted">
              {lead.last_contacted_at
                ? new Date(lead.last_contacted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Not yet'}
            </Fact>
            <Fact label="Next follow-up">
              {lead.next_action_date || '—'}
              {lead.next_action_date && lead.next_action_date <= new Date().toISOString().slice(0, 10) && (
                <b style={{ color: 'var(--rust)', marginLeft: 6 }}>due</b>
              )}
            </Fact>
            <Fact label="Last result">{lead.last_outreach_result ? lead.last_outreach_result.replace(/_/g, ' ') : '—'}</Fact>
          </div>
          {/* Engine ki halat — queued/draft dikhao taake pata ho bot kya karne wala hai */}
          {engine && engine.viewing_status === 'queued' && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--brass)' }}>
              Queued — the bot sends this on its next run (within the daily cap).
            </p>
          )}
          {engine && engine.viewing_status === 'draft' && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--brass)' }}>
              Draft prepared — preview mode is on, so nothing was actually sent.
            </p>
          )}
        </Card>

        <Card title="Next action">
          {lead.next_action ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brass)' }}>{lead.next_action}</div>
              {lead.next_action_date && (
                <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  Due {lead.next_action_date}
                  {lead.next_action_date <= new Date().toISOString().slice(0, 10) && (
                    <b style={{ color: 'var(--rust)', marginLeft: 6 }}>due now</b>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              No next action set — use the controls above to add one.
            </p>
          )}
        </Card>
      </div>

      {/* ── Message history — exact message + kab + attempt + result. Audit ke
             liye "sent" akela kaafi nahi (13 Aug directive). ── */}
      {(() => {
        const msgs = activities.filter(
          (a) => a.type?.startsWith('outreach_') || a.type === 'landlord_replied'
        );
        if (!msgs.length) return null;
        return (
          <div>
            <h2 style={{ margin: '4px 0 12px', fontSize: 15, fontWeight: 600 }}>
              Message history
              <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 400, marginLeft: 8 }}>{msgs.length}</span>
            </h2>
            <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', overflow: 'hidden' }}>
              {msgs.map((a, i) => (
                <div key={a.Id ?? i} style={{ padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--mist-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</span>
                    <span className="text-muted font-mono" style={{ fontSize: 11.5 }}>
                      {a.CreatedAt ? new Date(a.CreatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
                      OpenRent
                      {a.meta?.attempt != null && ` · attempt ${a.meta.attempt}`}
                      {a.meta?.result && ` · ${a.meta.result}`}
                      {a.meta?.outcome && ` · ${String(a.meta.outcome).replace(/_/g, ' ')}`}
                    </span>
                  </div>
                  {a.detail && (
                    <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', border: '1px solid var(--mist-line)', borderRadius: 8, padding: '10px 12px', background: 'var(--ink-raise)' }}>
                      {a.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Timeline ── */}
      <div>
        <h2 style={{ margin: '4px 0 12px', fontSize: 15, fontWeight: 600 }}>Activity</h2>
        <ActivityTimeline activities={activities} derived={derivedLeadEvents(lead)} />
      </div>
    </div>
  );
}
