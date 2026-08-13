import { getLead, updateLead, recordContact, LEAD_STATUSES, RESPONSE_OUTCOMES } from '@/lib/leads';
import { logActivity } from '@/lib/activities';

export const dynamic = 'force-dynamic';

/**
 * Landlord ka JAWAB record karo. Yehi wahid raasta hai jis se lead
 * REPLIED/INTERESTED banta hai — "message sent" kabhi interested nahi karta
 * (business rule, 13 Aug directive).
 *
 * Body: { outcome: interested|not_interested|needs_info|property_unavailable|already_let|other,
 *         notes?, next_followup? (YYYY-MM-DD) }
 */
export async function POST(req, { params }) {
  const { id } = await params;
  let body = {};
  try { body = await req.json(); } catch {}

  const outcome = RESPONSE_OUTCOMES.some((o) => o.key === body.outcome) ? body.outcome : null;
  if (!outcome) {
    return Response.json({ error: 'Pick what the landlord said.' }, { status: 400 });
  }

  const lead = await getLead(id);
  if (!lead) return Response.json({ error: 'Record not found.' }, { status: 404 });

  const order = LEAD_STATUSES.map((s) => s.key);
  const before = (key) => order.indexOf(lead.status) < order.indexOf(key);

  // Outcome → pipeline + outreach halat. Terminal jawab (declined/unavailable)
  // lead ko LOST karta hai — reason ke sath, taake funnel sach bole.
  const patch = {};
  let title = 'Landlord replied';
  switch (outcome) {
    case 'interested':
      patch.outreach_status = 'interested';
      if (before('interested')) patch.lead_status = 'interested';
      patch.next_action = 'Arrange viewing';
      title = 'Landlord replied — interested';
      break;
    case 'not_interested':
      patch.outreach_status = 'not_interested';
      patch.lead_status = 'lost';
      patch.loss_reason = 'landlord_declined';
      title = 'Landlord replied — not interested';
      break;
    case 'needs_info':
      patch.outreach_status = 'needs_info';
      if (before('contacted')) patch.lead_status = 'contacted';
      patch.next_action = 'Send the requested information';
      title = 'Landlord replied — needs more information';
      break;
    case 'property_unavailable':
      patch.outreach_status = 'replied';
      patch.lead_status = 'lost';
      patch.loss_reason = 'property_unavailable';
      title = 'Landlord replied — property unavailable';
      break;
    case 'already_let':
      patch.outreach_status = 'replied';
      patch.lead_status = 'lost';
      patch.loss_reason = 'property_unavailable';
      title = 'Landlord replied — already let';
      break;
    default: // other
      patch.outreach_status = 'replied';
      if (before('contacted')) patch.lead_status = 'contacted';
      title = 'Landlord replied';
  }
  if (body.next_followup) patch.next_action_date = String(body.next_followup).slice(0, 10);

  let updated;
  try {
    updated = await updateLead(lead.Id, patch);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  try {
    await recordContact(lead.Id, { last_outreach_result: `reply: ${outcome}` });
  } catch {}

  try {
    await logActivity({
      order_id: lead.order_id,
      listing_id: lead.listing_id,
      lead_row_id: lead.Id,
      type: 'landlord_replied',
      title,
      detail: body.notes || null,
      meta: {
        channel: 'openrent',
        outcome,
        next_followup: body.next_followup || null,
        landlord: lead.listing?.landlord_name || null,
      },
    });
  } catch (e) {
    return Response.json({
      ok: true, lead: updated,
      warning: `Response saved but the activity could not be logged (${e.message}).`,
    });
  }

  return Response.json({ ok: true, lead: updated });
}
