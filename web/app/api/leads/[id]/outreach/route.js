import { getLead, updateLead, LEAD_STATUSES } from '@/lib/leads';
import { logActivity } from '@/lib/activities';

export const dynamic = 'force-dynamic';

/**
 * OpenRent outreach LOG — composer nahi. Asli message user OpenRent ke andar
 * khud bhejta hai (Open OpenRent button se); yahan sirf record hota hai ke
 * bheja, kab bheja, kya note hai, follow-up kab. (Email-CRM pattern jaan kar
 * nahi banaya — OpenRent hi channel hai.)
 *
 * Body: { type?: 'message'|'viewing_request'|'call'|'follow_up',
 *         notes?, next_followup? (YYYY-MM-DD), status?: 'sent' }
 */
const TYPES = {
  message: 'OpenRent message sent',
  viewing_request: 'Viewing request sent',
  follow_up: 'Follow-up sent',
  response: 'Landlord response received',
};

export async function POST(req, { params }) {
  const { id } = await params;
  let body = {};
  try { body = await req.json(); } catch {}

  const type = TYPES[body.type] ? body.type : 'message';
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: 'Lead not found.' }, { status: 404 });

  // Outreach hua → pipeline aage. 'response' pe awaiting nahi lagta (jawab to
  // aa gaya); baqi sab pe: contacted + awaiting_response.
  const order = LEAD_STATUSES.map((s) => s.key);
  const isEarly = order.indexOf(lead.status) < order.indexOf('contacted');
  const patch = {};
  if (type === 'response') {
    patch.outreach_status = 'interested';
    if (order.indexOf(lead.status) < order.indexOf('interested')) patch.lead_status = 'interested';
    patch.next_action = 'Arrange viewing';
  } else {
    patch.outreach_status = 'awaiting_response';
    if (isEarly) patch.lead_status = 'contacted';
    patch.next_action = 'Follow up with landlord';
  }
  if (body.next_followup) patch.next_action_date = String(body.next_followup).slice(0, 10);

  let updated;
  try {
    updated = await updateLead(id, patch);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  try {
    await logActivity({
      order_id: lead.order_id,
      listing_id: lead.listing_id,
      lead_row_id: lead.Id,
      type: `outreach_${type}`,
      title: TYPES[type],
      detail: body.notes || null,
      meta: {
        channel: 'openrent',
        next_followup: body.next_followup || null,
        landlord: lead.listing?.landlord_name || null,
      },
    });
  } catch (e) {
    // Log hi is endpoint ka maqsad hai — yahan fail chhupana nahi banta
    return Response.json(
      { ok: true, lead: updated, warning: `Status updated but the activity could not be logged (${e.message}).` }
    );
  }

  return Response.json({ ok: true, lead: updated });
}
