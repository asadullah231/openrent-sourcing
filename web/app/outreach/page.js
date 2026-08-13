import Link from 'next/link';
import { getHealth, getSendLog } from '@/lib/data';
import { getLeads, outreachBuckets, leadFunnel } from '@/lib/leads';
import { syncEngineOutreach } from '@/lib/outreach-sync';
import { SendBatchButton } from '@/components/send-batch-button';
import { SearchToggles } from '@/components/search-toggles';
import { OutreachActions } from '@/components/outreach-actions';
import { LeadStatusBadge, OutreachBadge, money, leadPropertyLine } from '@/components/crm-bits';

export const dynamic = 'force-dynamic';

// Outreach — ab CRM ka main outreach workspace (13 Aug funnel directive).
// Upar funnel: tabs + counts + har lead pe agla qadam. Neeche sending engine
// ki aaj ki halat (cap, mode, locations, sent list) — wo hissa waisa hi hai,
// bas funnel ke baad aata hai. Bhejta aaj bhi SIRF engine hai (src/viewing.js);
// ye page uske gird orchestration hai.

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready to Contact' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'awaiting', label: 'Awaiting Response' },
  { key: 'replies', label: 'Replies' },
  { key: 'interested', label: 'Interested' },
  { key: 'followups', label: 'Follow-ups Due' },
  { key: 'noResponse', label: 'No Response' },
];

// Har tab pe kaunse quick actions banté hain (Open OpenRent hamesha hota hai).
const TAB_ACTIONS = {
  ready: ['queue'],
  contacted: ['followup', 'interested', 'not_interested', 'no_response'],
  awaiting: ['followup', 'interested', 'not_interested', 'no_response'],
  replies: ['followup', 'interested', 'not_interested'],
  interested: ['followup'],
  followups: ['followup', 'interested', 'not_interested', 'no_response'],
  noResponse: [],
};

function timeOnly(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function dateOnly(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

function daysSince(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d >= 0 ? d : null;
}

// Metric-strip cell (globals.css) — alag stat cards nahi (DESIGN.md).
function Stat({ value, label, accent = false, hint }) {
  return (
    <div className="metric">
      <div className="metric-value" style={accent ? { color: 'var(--brass)' } : undefined}>{value}</div>
      <div className="metric-label">{label}</div>
      {hint && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function LeadRow({ lead, actions, engine }) {
  const l = lead.listing || {};
  const o = lead.order;
  const orderLabel = o?.order_number || (lead.order_id != null ? `ORD-${String(lead.order_id).padStart(4, '0')}` : null);
  const waited = daysSince(lead.last_contacted_at);
  const today = new Date().toISOString().slice(0, 10);
  const engineNote =
    engine?.viewing_status === 'queued'
      ? 'Queued — the bot sends it next run'
      : engine?.viewing_status === 'draft'
        ? 'Draft prepared (preview mode)'
        : null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '14px 16px',
        borderTop: '1px solid var(--mist-line)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <Link href={`/sourcing/${lead.Id}`} className="font-mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
            {lead.ref}
          </Link>
          <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {leadPropertyLine(lead)}
          </span>
          <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>{money(l.price)}</span>
          <LeadStatusBadge status={lead.status} size={9.5} />
          <OutreachBadge status={lead.outreach_status} size={9.5} />
        </div>
        <div className="text-muted" style={{ fontSize: 11.5, marginTop: 5, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {l.landlord_name && <span>Landlord: <b style={{ color: 'var(--paper)', fontWeight: 600 }}>{l.landlord_name}</b></span>}
          {orderLabel && (
            <span>
              Order:{' '}
              <Link href={`/orders/${lead.order_id}`} className="font-mono" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                {orderLabel}
              </Link>
            </span>
          )}
          {lead.last_contacted_at && (
            <span>
              Last contact: {dateOnly(lead.last_contacted_at)}
              {waited != null && waited > 0 && ` · waiting ${waited} day${waited === 1 ? '' : 's'}`}
              {lead.contact_attempts > 1 && ` · attempt ${lead.contact_attempts}`}
            </span>
          )}
          {lead.next_action && (
            <span>
              Next: <b style={{ color: 'var(--brass)', fontWeight: 600 }}>{lead.next_action}</b>
              {lead.next_action_date && (
                <>
                  {' '}({lead.next_action_date}
                  {lead.next_action_date <= today && <b style={{ color: 'var(--rust)' }}> due</b>})
                </>
              )}
            </span>
          )}
          {engineNote && <span style={{ color: 'var(--brass)' }}>{engineNote}</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <OutreachActions lead={{ Id: lead.Id, listing: { url: l.url || null, source: l.source } }} show={actions} />
      </div>
    </div>
  );
}

export default async function OutreachPage({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp?.tab) ? sp.tab : 'all';

  const today = new Date().toISOString().slice(0, 10);

  let leads = [];
  let leadsError = null;
  try {
    leads = await getLeads();
  } catch (e) {
    leadsError = e.message;
  }

  // Engine ke ho-chuke sends leads pe utaro (bot sirf apna store likhta hai) —
  // idempotent, sirf naye sends pe kuch karta hai.
  let engineState = new Map();
  if (leads.length) {
    const sync = await syncEngineOutreach(leads);
    engineState = sync.engineState;
  }

  const [health, log] = await Promise.all([
    getHealth().catch(() => ({})),
    getSendLog().catch(() => []),
  ]);

  const buckets = outreachBuckets(leads);
  const funnel = leadFunnel(leads);

  // Tab ki list — kaam ke hisaab se sort (funnel recency default hai).
  const listFor = {
    all: buckets.all,
    ready: [...buckets.ready].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)),
    contacted: [...buckets.contacted].sort((a, b) => (b.last_contacted_at || '').localeCompare(a.last_contacted_at || '')),
    awaiting: [...buckets.awaiting].sort((a, b) => (a.last_contacted_at || '').localeCompare(b.last_contacted_at || '')),
    replies: buckets.replies,
    interested: buckets.interested,
    followups: [...buckets.followups].sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || '')),
    noResponse: buckets.noResponse,
  };
  const rows = listFor[tab] || [];
  const countFor = (key) => (listFor[key] || []).length;

  const todayRows = log.filter((r) => r.day === today);
  const liveToday = todayRows.filter((r) => r.mode === 'live');
  const shadowToday = todayRows.filter((r) => r.mode === 'shadow');
  const fails = todayRows.filter((r) => r.status && !/sent|ok|success|302/i.test(String(r.status)));

  const live = health.mode === 'live';
  const sent = health.sentToday ?? 0;
  const cap = health.dailyCap ?? 0;
  const left = Math.max(0, cap - sent);
  const pct = cap > 0 ? Math.min(100, Math.round((sent / cap) * 100)) : 0;
  const engineRows = live ? liveToday : shadowToday;

  const actionsFor = (lead) => {
    if (TAB_ACTIONS[tab]) return TAB_ACTIONS[tab];
    // 'all' tab — lead ki halat ke hisaab se
    if (lead.outreach_status === 'not_contacted') {
      return lead.status === 'shortlisted' || lead.status === 'ready_to_contact' ? ['queue'] : [];
    }
    if (lead.status === 'lost' || lead.status === 'won') return [];
    return ['followup', 'interested', 'not_interested'];
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 30, margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>Outreach</h1>
          <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            The outreach funnel — who to contact, who replied, and what needs a follow-up.
          </p>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 999,
            border: `1px solid ${live ? 'var(--green)' : 'var(--mist-line)'}`,
            color: live ? 'var(--green)' : 'var(--mist)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? 'var(--green)' : 'var(--mist)', boxShadow: live ? '0 0 8px var(--green)' : 'none' }} />
          {live ? 'Live' : 'Preview'} · autopilot {health.autopilot}
        </span>
      </div>

      {leadsError && (
        <div style={{ border: '1px solid var(--rust)', color: 'var(--rust)', borderRadius: 'var(--r-ctrl)', padding: '12px 16px', fontSize: 13, marginBottom: 18 }}>
          Could not load the funnel: {leadsError}
        </div>
      )}

      {/* ── FUNNEL METRICS ── */}
      <div className="metric-strip" style={{ marginBottom: 20 }}>
        <Stat value={countFor('ready')} label="Ready to contact" accent />
        <Stat value={countFor('contacted')} label="Contacted" />
        <Stat value={countFor('awaiting')} label="Awaiting response" />
        <Stat value={countFor('replies')} label="Replies" />
        <Stat value={countFor('interested')} label="Interested" />
        <Stat value={funnel.viewings} label="Viewings" />
        <Stat value={funnel.deals} label="Deals" />
      </div>

      {/* ── FUNNEL TABS — wahi tabbar jo Sourcing pe hai (ek system) ── */}
      <div className="tabbar">
        {TABS.map((t) => {
          const active = t.key === tab;
          const n = countFor(t.key);
          return (
            <Link
              key={t.key}
              href={t.key === 'all' ? '/outreach' : `/outreach?tab=${t.key}`}
              className={active ? 'tab active' : 'tab'}
            >
              {t.label}<span className="count">{n}</span>
            </Link>
          );
        })}
      </div>

      {/* ── LEAD LIST ── */}
      <section style={{ marginTop: 14, marginBottom: 36 }}>
        {rows.length === 0 ? (
          <div
            className="text-muted"
            style={{ padding: '44px 20px', textAlign: 'center', fontSize: 13.5, border: '1px dashed var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)' }}
          >
            {tab === 'ready' && 'Nothing waiting for outreach. Shortlist properties on an order to fill this list.'}
            {tab === 'followups' && 'No follow-ups due. Set a follow-up date when you log outreach.'}
            {tab === 'all' && 'Nothing here yet — run Find Properties on an order first.'}
            {!['ready', 'followups', 'all'].includes(tab) && 'Nothing here yet.'}
          </div>
        ) : (
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
            {rows.map((lead, i) => (
              <div key={lead.Id} style={i === 0 ? { marginTop: -1 } : undefined}>
                <LeadRow
                  lead={lead}
                  actions={actionsFor(lead)}
                  engine={engineState.get(String(lead.listing_id))}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SENDING ENGINE (aaj) ── */}
      <section style={{ borderTop: '1px solid var(--mist-line)', paddingTop: 26 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 4px', fontWeight: 600 }}>Sending engine</h2>
        <p className="text-muted" style={{ fontSize: 12.5, margin: '0 0 16px', lineHeight: 1.6 }}>
          All messages go out through the bot on the OpenRent account — with the daily cap, human pacing and one-message-per-property protection.
        </p>

        <div className="metric-strip" style={{ marginBottom: 10 }}>
          <Stat value={sent} label="Sent today" accent />
          <Stat value={left} label="Left today" hint={`of ${cap} daily cap`} />
          <Stat value={health.autopilot === 'on' ? 'On' : 'Off'} label="Autopilot" />
          <Stat value={shadowToday.length} label="Drafts (preview)" />
        </div>
        <div style={{ marginBottom: 26 }}>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brass)', borderRadius: 999, transition: 'width .3s' }} />
          </div>
          <div className="text-muted" style={{ fontSize: 11.5, marginTop: 6 }}>{sent} of {cap} sent today · {left} remaining</div>
        </div>

        {/* Locations + batch send — purana engine control, waisa hi */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
            <h3 style={{ fontSize: 15.5, margin: 0, fontWeight: 600 }}>Locations</h3>
            <span className="text-muted" style={{ fontSize: 11.5 }}>green dot = on · outreach runs only on these</span>
          </div>
          <SearchToggles />
        </div>

        <div style={{ marginBottom: 30, padding: '18px 20px', border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15.5, margin: '0 0 4px', fontWeight: 600 }}>Send requests now</h3>
            <p className="text-muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
              Runs every location that&apos;s on, finds fresh listings, and sends one batch right away.
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <SendBatchButton />
          </div>
        </div>

        {fails.length > 0 && (
          <div style={{ marginBottom: 24, padding: '13px 16px', border: '1px solid var(--rust)', borderRadius: 'var(--r-card)', background: 'rgba(196,53,26,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rust)', marginBottom: 6 }}>
              {fails.length} didn&apos;t go through today
            </div>
            {fails.slice(0, 5).map((f, i) => (
              <div key={i} className="text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                #{f.listing_id} · {f.status} · {timeOnly(f.created_at || f.time)}
              </div>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: 15.5, margin: '0 0 12px', fontWeight: 600 }}>
          {live ? 'Sent today' : 'Drafts today'}
          <span className="text-muted" style={{ fontSize: 13, fontWeight: 400, marginLeft: 9 }}>{engineRows.length}</span>
        </h3>
        {engineRows.length === 0 ? (
          <div
            className="text-muted"
            style={{ padding: '34px 20px', textAlign: 'center', fontSize: 13, border: '1px dashed var(--mist-line)', borderRadius: 'var(--r-card)', background: 'var(--surface)', marginBottom: 20 }}
          >
            Nothing yet today.
          </div>
        ) : (
          <div style={{ border: '1px solid var(--mist-line)', borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--surface)', marginBottom: 20 }}>
            {engineRows.map((r, i) => (
              <a
                key={i}
                href={`/listing/${r.listing_id}`}
                className="row-hover"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--mist-line)', textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <span className="font-mono text-muted" style={{ fontSize: 11.5, width: 44, flexShrink: 0 }}>
                  {timeOnly(r.CreatedAt || r.built_at)}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.address || `#${r.listing_id}`}
                </span>
                <span className="text-muted" style={{ fontSize: 11.5, marginLeft: 'auto', flexShrink: 0 }}>OpenRent</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
