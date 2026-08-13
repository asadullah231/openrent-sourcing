import { getLead, updateLead, LEAD_STATUSES } from '@/lib/leads';
import { logActivity } from '@/lib/activities';
import { getHealth, getSettings, getListingRow, queueListings, addListingToStore } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lead ke liye outreach QUEUE karo — EXISTING engine ke raste se.
 *
 * Yahan se koi message NAHI jata. Hum sirf listing ko bot ke store me
 * 'queued' mark karte hain aur wahi webhook trigger karte hain jo folder
 * view ka "Send" use karta hai. Aage sab engine (src/viewing.js) ke haath
 * me hai: shadow/live mode, daily + per-run cap, reserve slot, fresh token,
 * idempotency, human delay, 302 success detection — kuch bypass nahi hota.
 *
 * Order-found listings bot store me nahi hotin — un ke liye snapshot se row
 * insert hoti hai (queued). Pehle se 'requested' ho to dobara kabhi nahi.
 */
export async function POST(req, { params }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: 'Lead not found.' }, { status: 404 });

  const l = lead.listing || {};
  if ((l.source || 'openrent') !== 'openrent') {
    return Response.json(
      { error: 'Outreach goes through OpenRent only — this listing is on another portal.' },
      { status: 400 }
    );
  }
  if (!lead.listing_id) {
    return Response.json({ error: 'This lead has no listing id to contact.' }, { status: 400 });
  }

  // Cap-aware — folder view ke "Send" jaisa hi guard. Cap poori = queue nahi.
  const health = await getHealth().catch(() => ({}));
  const cap = health.dailyCap ?? 15;
  const used = health.sentToday ?? 0;
  if (cap - used <= 0) {
    return Response.json({
      ok: false,
      capped: true,
      error: `Daily cap reached (${used}/${cap}). Try again tomorrow.`,
    });
  }

  // Store ki asli halat dekho — 'requested' ko KABHI dobara queue nahi karte
  // (one-shot form; engine bhi skip karta, par status clobber bhi nahi karna).
  const row = await getListingRow(lead.listing_id);
  if (row?.viewing_status === 'requested') {
    return Response.json({
      ok: false,
      already: true,
      error: 'Outreach already went to this landlord — OpenRent allows one message per property.',
    });
  }

  let queuedNow = false;
  if (row) {
    if (row.viewing_status !== 'queued') {
      await queueListings([lead.listing_id]);
    }
    queuedNow = true;
  } else {
    queuedNow = await addListingToStore(l, { score: 0 });
  }
  if (!queuedNow) {
    return Response.json({ error: 'Could not queue this listing — try again.' }, { status: 500 });
  }

  // Bot trigger — wahi webhook jo baqi dashboard use karta hai.
  let triggered = false;
  let triggerMsg = '';
  let url = process.env.N8N_OUTREACH_WEBHOOK;
  if (!url) {
    try { url = (await getSettings())?.outreachWebhook; } catch {}
  }
  if (url) {
    try {
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(55000) });
      triggered = res.ok;
    } catch (e) {
      triggerMsg = e?.name === 'TimeoutError'
        ? 'Queued — the bot is sending in the background.'
        : `Queued, but trigger failed: ${e.message}`;
    }
  } else {
    triggerMsg = 'Queued — it will send on the next scheduled run.';
  }

  // Lead pipeline: queue hua to kam az kam READY_TO_CONTACT. CONTACTED abhi
  // NAHI — wo sirf tab jab engine sach me bhej de (sync us waqt karta hai).
  const order = LEAD_STATUSES.map((s) => s.key);
  const patch = { next_action: 'Outreach queued — waiting for the bot to send' };
  if (order.indexOf(lead.status) < order.indexOf('ready_to_contact')) patch.lead_status = 'ready_to_contact';
  try { await updateLead(lead.Id, patch); } catch {}

  try {
    await logActivity({
      order_id: lead.order_id,
      listing_id: lead.listing_id,
      lead_row_id: lead.Id,
      type: 'outreach_queued',
      title: `Outreach queued (${health.mode === 'live' ? 'live' : 'preview'} mode)`,
      detail: null,
      meta: { channel: 'openrent', mode: health.mode || null, triggered },
    });
  } catch {}

  return Response.json({
    ok: true,
    queued: true,
    triggered,
    mode: health.mode || 'shadow',
    message:
      triggerMsg ||
      (health.mode === 'live'
        ? 'Queued — the bot sends it from the account with all safety limits.'
        : 'Queued — preview mode is on, so a draft is prepared instead of a real send.'),
  });
}
