// Activity timeline — reusable, din ke groups me (Today / Yesterday / date).
// Lead detail, order detail aur property detail teeno isi ko render karte hain.
//
// `activities` = NocoDB ke stored rows (insaani kaam). `derived` = machine
// events jo store NAHI hote (Property discovered / Match calculated) — caller
// unhe lead row se bana kar de deta hai, yahan sirf merge + sort hota hai.
// (Kyun store nahi hote: lib/activities.js ka nota parho.)

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d) {
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(yest)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_ICON = {
  search_run: '🔍',
  shortlisted: '⭐',
  unshortlisted: '☆',
  status_changed: '→',
  outreach_status: '💬',
  outreach_message: '✉️',
  outreach_viewing_request: '📅',
  outreach_follow_up: '↩︎',
  outreach_response: '📨',
  note: '✎',
  discovered: '🏠',
  match: '%',
};

export function ActivityTimeline({ activities = [], derived = [], emptyText = 'No activity yet.' }) {
  const items = [
    ...activities.map((a) => ({
      at: new Date(a.CreatedAt || 0),
      type: a.type,
      title: a.title,
      detail: a.detail,
      actor: a.actor,
    })),
    ...derived.map((d) => ({ ...d, at: new Date(d.at || 0) })),
  ]
    .filter((i) => !isNaN(i.at))
    .sort((a, b) => b.at - a.at);

  if (!items.length) {
    return <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>{emptyText}</p>;
  }

  // Din ke dabbe — tarteeb items ki hi rehti hai (naya din upar)
  const groups = [];
  for (const item of items) {
    const key = dayKey(item.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.at), items: [item] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {g.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {g.items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 12, padding: '8px 0',
                  borderLeft: '2px solid var(--mist-line)', paddingLeft: 14, marginLeft: 4,
                }}
              >
                <span className="font-mono text-muted" style={{ fontSize: 11.5, flexShrink: 0, width: 38, paddingTop: 1 }}>
                  {item.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    <span aria-hidden="true" style={{ marginRight: 6, opacity: 0.75 }}>{TYPE_ICON[item.type] || '·'}</span>
                    {item.title}
                  </div>
                  {item.detail && (
                    <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {item.detail}
                    </div>
                  )}
                  {item.actor && item.actor !== 'User' && (
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{item.actor}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Lead row se machine events — store nahi hote, yahin bante hain.
 * CreatedAt = jab Find run ne pehli baar dekha; match_score = scoring.
 */
export function derivedLeadEvents(lead) {
  const out = [];
  if (lead.CreatedAt) {
    out.push({
      at: lead.CreatedAt,
      type: 'discovered',
      title: 'Property discovered',
      detail: (lead.listing?.source || 'openrent') === 'openrent' ? 'OpenRent' : lead.listing?.source,
      actor: 'System',
    });
    if (lead.match_score != null) {
      out.push({
        at: lead.CreatedAt,
        type: 'match',
        title: 'Match calculated',
        detail: `${lead.match_score}% match`,
        actor: 'System',
      });
    }
  }
  return out;
}
