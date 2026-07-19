// Email alerts via Resend (Car Arbitrage wala hi setup reuse).
// Key .env se: RESEND_API_KEY. Key na ho to DRY-RUN — email console pe print, crash nahi.
// M3 me is se pehle "bot X min me viewing request bhejega" line juregi.

import { config } from './config.js';

const RESEND_URL = 'https://api.resend.com/emails';

function buildDealsHtml(listings) {
  const rows = listings
    .map(
      (l) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        <a href="${l.url}" style="color:#0a58ca;text-decoration:none;font-weight:600;">${l.address || l.title || l.listing_id}</a><br>
        <span style="color:#666;font-size:13px;">£${l.price}/mo · ${l.beds} bed · ${l.hours_live}h old${
          l.response_rate != null ? ` · landlord ${l.response_rate}%` : ''
        }${l._distance_km != null ? ` · ${l._distance_km}km` : ''}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
        <b style="font-size:16px;">${l.score}</b><br><span style="color:#888;font-size:12px;">${l.score_reason}</span>
      </td>
    </tr>`
    )
    .join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;">
    <h2 style="margin:0 0 4px;">🏠 ${listings.length} new listing${listings.length > 1 ? 's' : ''} worth a look</h2>
    <p style="color:#666;margin:0 0 16px;">Fresh on OpenRent, sorted by score.</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="color:#999;font-size:12px;margin-top:16px;">Score = response rate + freshness + distance + price fit. First viewing request wins — move fast.</p>
  </div>`;
}

export async function sendAlert(listings) {
  if (!listings.length) return { sent: false, reason: 'no listings' };

  const subject =
    listings.length === 1
      ? `🏠 New: ${listings[0].address || listings[0].title} (£${listings[0].price}/mo, score ${listings[0].score})`
      : `🏠 ${listings.length} new OpenRent listings (top score ${listings[0].score})`;

  const html = buildDealsHtml(listings);
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.log('\n  ⚠️  RESEND_API_KEY not set — DRY RUN (email NOT sent):');
    console.log(`      To: ${config.alertEmail}`);
    console.log(`      Subject: ${subject}`);
    console.log(`      (${listings.length} listings in body)`);
    return { sent: false, reason: 'dry-run (no key)' };
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.alertFrom, to: config.alertEmail, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `resend ${res.status}: ${body.slice(0, 120)}` };
  }
  return { sent: true, id: (await res.json()).id };
}

// Pipeline fail hone pe Asad/Mo ko alert (K3 pattern)
export async function sendError(message) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n  ⚠️  [DRY RUN] error alert: ${message}`);
    return;
  }
  await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.alertFrom,
      to: config.errorEmail,
      subject: '⚠️ OpenRent bot pipeline error',
      text: message,
    }),
  }).catch(() => {});
}
