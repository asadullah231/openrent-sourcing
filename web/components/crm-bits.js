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
  interested: 'var(--green)',
  no_response: 'var(--brass)',
  not_interested: 'var(--rust)',
};

export function LeadStatusBadge({ status, size = 11 }) {
  const color = LEAD_STATUS_COLOR[status] || 'var(--mist)';
  return (
    <span
      style={{
        fontSize: size, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        color, whiteSpace: 'nowrap',
      }}
    >
      {leadStatusLabel(status)}
    </span>
  );
}

export function OutreachBadge({ status, size = 11 }) {
  const color = OUTREACH_STATUS_COLOR[status] || 'var(--mist)';
  return (
    <span
      style={{
        fontSize: size, fontWeight: 600, letterSpacing: '0.02em', color, whiteSpace: 'nowrap',
        border: `1px solid ${color}`, borderRadius: 999, padding: '2px 9px', opacity: 0.9,
      }}
    >
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

/** Property ki ek-line pehchaan: "2 bed house · Bromley BR1" jaisi. */
export function leadPropertyLine(lead) {
  const l = lead.listing || {};
  const beds = l.beds != null ? `${l.beds} bed` : null;
  const raw = l.address || l.area || l.title || `#${lead.listing_id}`;
  const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');
  return [beds, place].filter(Boolean).join(' · ');
}
