// Engine → CRM sync. Bot (src/viewing.js) apne bheje hue sends SIRF apne
// listings store me likhta hai (viewing_status='requested' + requested_at +
// sent_message) — usko leads ka pata hi nahi, aur src/ hum is phase me nahi
// chhoote. Ye layer parhte waqt dono ko mila deti hai: jis lead ki listing
// engine se ja chuki hai magar lead abhi tak "not contacted" hai, us lead ko
// CONTACTED + AWAITING_RESPONSE kar ke exact message, waqt aur attempt number
// record kar deti hai (activity + lead row dono me).
//
// Idempotent: OpenRent ka form one-shot hai (engine me bhi requested dobara
// nahi jata), is liye har listing ka zyada se zyada EK engine send hota hai.
// Sync sirf tab chalta hai jab lead.last_contacted_at us send se PEECHE ho —
// ek dafa likhne ke baad shart kabhi dobara sach nahi hoti.

import { getListings, getSendLog } from './data';
import { LEAD_STATUSES, updateLead, recordContact } from './leads';
import { logActivity } from './activities';

/**
 * Bot store ki halat listing_id ke hisaab se — /outreach aur lead detail dono
 * ise dikhane ke liye use karte hain (queued / draft / requested).
 */
export function engineStateByListing(botListings) {
  const m = new Map();
  for (const r of botListings || []) {
    m.set(String(r.listing_id), {
      viewing_status: r.viewing_status || 'new',
      requested_at: r.requested_at || null,
      sent_message: r.sent_message || null,
    });
  }
  return m;
}

/**
 * MAIN — engine ke ho-chuke sends leads pe utaro. leads ko in-place update
 * kar ke wapas deta hai taake page dobara fetch na kare. { synced } count.
 */
export async function syncEngineOutreach(leads) {
  let botListings = [];
  let sendLog = [];
  try {
    [botListings, sendLog] = await Promise.all([getListings(), getSendLog()]);
  } catch {
    // Bot store na mile (env missing waghera) to CRM phir bhi chale — sync skip.
    return { synced: 0, engineState: new Map(), botListings: [] };
  }
  const engineState = engineStateByListing(botListings);

  const order = LEAD_STATUSES.map((s) => s.key);
  let synced = 0;

  for (const lead of leads) {
    if ((lead.listing?.source || 'openrent') !== 'openrent') continue; // engine sirf OpenRent bhejta hai
    const bot = engineState.get(String(lead.listing_id));
    if (!bot || bot.viewing_status !== 'requested') continue;
    const sentAt = bot.requested_at;
    if (!sentAt) continue;
    if (lead.last_contacted_at && lead.last_contacted_at >= sentAt) continue; // pehle se record hai

    // Attempt number = is listing pe live send-log entries (engine har koshish
    // log karta hai) — kam se kam 1.
    const attempts = Math.max(
      1,
      sendLog.filter((r) => String(r.listing_id) === String(lead.listing_id) && r.mode === 'live').length,
      (lead.contact_attempts || 0) + 1
    );

    // "Message sent" = CONTACTED (interested NAHI — wo sirf asli jawab pe).
    const patch = { outreach_status: 'awaiting_response', next_action: 'Follow up with landlord' };
    if (order.indexOf(lead.status) < order.indexOf('contacted')) patch.lead_status = 'contacted';

    try {
      await updateLead(lead.Id, patch);
      await recordContact(lead.Id, {
        last_contacted_at: sentAt,
        contact_attempts: attempts,
        last_outreach_message: bot.sent_message || null,
        last_outreach_result: 'sent',
      });
      await logActivity({
        order_id: lead.order_id,
        listing_id: lead.listing_id,
        lead_row_id: lead.Id,
        type: 'outreach_message',
        title: 'OpenRent message sent',
        detail: bot.sent_message || null,
        actor: 'System (bot)',
        meta: {
          channel: 'openrent',
          attempt: attempts,
          sent_at: sentAt,
          result: 'sent',
          landlord: lead.listing?.landlord_name || null,
        },
      });
    } catch {
      continue; // ek lead fail ho to baqi ka sync na ruke
    }

    // Local copy bhi taza — page isi array se render karega.
    Object.assign(lead, {
      status: patch.lead_status || lead.status,
      lead_status: patch.lead_status || lead.lead_status,
      outreach_status: 'awaiting_response',
      next_action: patch.next_action,
      last_contacted_at: sentAt,
      contact_attempts: attempts,
      last_outreach_message: bot.sent_message || null,
      last_outreach_result: 'sent',
    });
    synced++;
  }

  return { synced, engineState, botListings };
}
