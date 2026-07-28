import { hideListings, unhideListings, queueListings, getSettings, getHealth } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Bulk actions on selected rooms (folder view — Smartlead-style).
 *
 * POST body: { action: 'hide'|'unhide'|'send', listingIds: [<listing_id>, ...] }
 *
 *   hide   → rooms folder se hatao (soft: viewing_status='hidden'). Wapas la sakte.
 *   unhide → hidden rooms wapas.
 *   send   → selected ko 'queued' mark karo, phir bot trigger karo. Bot ke asli
 *            OpenRent session (Mo ka account) se message jata hai — dashboard
 *            seedha nahi bhej sakta (Vercel serverless). Cap-aware: cap me jitni
 *            jagah hai utni hi queue hoti, baqi rok deta.
 *
 * SAFETY: 'send' live account se jata hai. Daily cap respect hota — cap poori ho
 * to kuch queue nahi hota (message ke sath). Mode server-locked (settings guard).
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body?.action;
  const listingIds = Array.isArray(body?.listingIds) ? body.listingIds : [];

  if (!listingIds.length) {
    return Response.json({ error: 'No rooms selected.' }, { status: 400 });
  }

  if (action === 'hide') {
    const n = await hideListings(listingIds);
    return Response.json({ ok: true, action, count: n });
  }

  if (action === 'unhide') {
    const n = await unhideListings(listingIds);
    return Response.json({ ok: true, action, count: n });
  }

  if (action === 'send') {
    // Cap-aware: sirf itni queue karo jitni cap me bacha hai.
    const health = await getHealth().catch(() => ({}));
    const cap = health.dailyCap ?? 15;
    const sentToday = health.sentToday ?? 0;
    const room = Math.max(0, cap - sentToday);

    if (room === 0) {
      return Response.json({
        ok: false,
        capped: true,
        error: `Daily cap reached (${sentToday}/${cap}). Try again tomorrow, or these will send on the next run.`,
      });
    }

    const toQueue = listingIds.slice(0, room);
    const queued = await queueListings(toQueue);
    const skipped = listingIds.length - toQueue.length;

    // Bot trigger — same webhook jo "Send batch" button use karta hai.
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
          ? 'Queued — bot is sending in the background.'
          : `Queued, but trigger failed: ${e.message}`;
      }
    } else {
      triggerMsg = 'Queued — will send on the next scheduled run (trigger URL not set).';
    }

    return Response.json({
      ok: true,
      action,
      queued,
      skipped,
      triggered,
      message: triggerMsg || (skipped > 0
        ? `Queued ${queued} to send now. ${skipped} skipped (daily cap) — they’ll go next.`
        : `Queued ${queued} to send from Mo’s account.`),
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
