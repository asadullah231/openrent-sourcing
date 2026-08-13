// CRM ke chhote shared tukray — status badges + formatting. Server aur client
// dono components inhe use karte hain (koi state nahi, pure render).

import { leadStatusLabel, outreachStatusLabel } from '@/lib/leads';

// Pipeline stage → signal rang. Ek hi jagah, warna har page apna matlab nikalta.
export const LEAD_STATUS_COLOR = {
  new: 'var(--mist)',
  matched: 'var(--mist)',
  shortlisted: 'var(--brass)',
  ready_to_contact: 'var(--brass)',
  contacted: 'var(--accent)',
  awaiting_response: 'var(--accent)',
  interested: 'var(--green)',
  viewing: 'var(--green)',
  negotiation: 'var(--green)',
  deal: 'var(--green)',
  won: 'var(--green)',
  lost: 'var(--rust)',
};

export const OUTREACH_STATUS_COLOR = {
  not_contacted: 'var(--mist)',
  contacted: 'var(--accent)',
  awaiting_response: 'var(--accent)',
  replied: 'var(--green)',
  needs_info: 'var(--brass)',
  interested: 'var(--green)',
  no_response: 'var(--brass)',
  not_interested: 'var(--rust)',
};

// Badge = rang wala dot + neutral text (.badge class, globals.css). Rang sirf
// dot me rehta hai — colored uppercase text har row me chillata tha (DESIGN.md:
// restrained colors, small status badges). `size` param purane call-sites ke
// liye qubool hai magar ab ek hi scale use hoti hai.
export function LeadStatusBadge({ status }) {
  const color = LEAD_STATUS_COLOR[status] || 'var(--mist)';
  return (
    <span className="badge" style={{ '--badge-c': color }}>
      <span className="badge-dot" />
      {leadStatusLabel(status)}
    </span>
  );
}

export function OutreachBadge({ status }) {
  const color = OUTREACH_STATUS_COLOR[status] || 'var(--mist)';
  return (
    <span className="badge" style={{ '--badge-c': color }}>
      <span className="badge-dot" />
      {outreachStatusLabel(status)}
    </span>
  );
}

/** Scrape ke titles me kabhi HTML entities reh jati hain (&#xA3; = £) — display se pehle saaf. */
export function deentity(s) {
  if (!s) return s;
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export function money(v) {
  return v == null ? '—' : `£${Number(v).toLocaleString('en-GB')}`;
}

/** Source ka display naam — data me 'openrent'/'rightmove' hai, UI me proper naam. */
export function sourceLabel(source) {
  if (source === 'rightmove') return 'Rightmove';
  return 'OpenRent'; // default: sab purani rows OpenRent hi hain
}

/**
 * "Source: OpenRent · View listing ↗" — har property surface pe wahi ek shakal.
 * URL sirf persisted listing.url se aata hai (scraper ki di hui original listing
 * URL) — yahan kabhi koi URL banai nahi jati. url na ho to broken link ke
 * bajaye "Listing URL unavailable".
 */
export function SourceListingLine({ listing, size = 12 }) {
  const url = listing?.url || null;
  return (
    <span style={{ fontSize: size, display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
      <span className="text-muted" style={{ whiteSpace: 'nowrap' }}>
        Source: <span style={{ color: 'var(--paper)', fontWeight: 600 }}>{sourceLabel(listing?.source)}</span>
      </span>
      <span className="text-muted">·</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--brass)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          View listing ↗
        </a>
      ) : (
        <span className="text-muted" style={{ whiteSpace: 'nowrap' }}>Listing URL unavailable</span>
      )}
    </span>
  );
}

/** Property ki ek-line pehchaan: "2 bed house · Bromley BR1" jaisi. */
export function leadPropertyLine(lead) {
  const l = lead.listing || {};
  const beds = l.beds != null ? `${l.beds} bed` : null;
  const raw = l.address || l.area || l.title || `#${lead.listing_id}`;
  const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');
  return [beds, place].filter(Boolean).join(' · ');
}
