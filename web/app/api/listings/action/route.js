import { hideListings, unhideListings, queueListings, getSettings, getHealth, setRoomNote } from '@/lib/data';

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

  // NOTE action — single room ka note save/clear. listingIds gate se pehle,
  // kyunki ye ek hi listingId + text leta hai (bulk nahi).
  if (action === 'note') {
    const id = body?.listingId;
    if (!id) return Response.json({ error: 'No room given.' }, { status: 400 });
    const saved = await setRoomNote(id, body?.text ?? '');
    return Response.json({ ok: true, action, note: saved });
  }

  if (!listingIds.length) {
    return Response.json({ error: 'No rooms selected.' }, { status: 400 });
  }

  // MOVE action — kanban drag/drop. Target column ke hisaab se status set.
  //   'pending' → unhide/new (score gate wapas)  ·  'queued' → queue+trigger
  //   'sent' column pe drag = queue+send (same as send).
  // 'sent' se wapas kheechna allow nahi (ja chuki request wapas nahi hoti) —
  // client wahan drop rok deta, par yahan bhi guard.
  if (action === 'move') {
    const to = body?.to;
    if (to === 'pending') {
      const n = await unhideListings(listingIds);
      return Response.json({ ok: true, action, to, count: n });
    }
    if (to === 'queued' || to === 'sent') {
      // queued/sent dono = queue kar ke bot trigger (neeche send block reuse).
      body.action = 'send';
    } else {
      return Response.json({ error: `Bad move target: ${to}` }, { status: 400 });
    }
  }

  if (body.action === 'hide' || action === 'hide') {
    const n = await hideListings(listingIds);
    return Response.json({ ok: true, action, count: n });
  }

  if (action === 'unhide') {
    const n = await unhideListings(listingIds);
    return Response.json({ ok: true, action, count: n });
  }

  if (body.action === 'send' || action === 'send') {
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
