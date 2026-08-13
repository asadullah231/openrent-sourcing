import { getLead, updateLead } from '@/lib/leads';
import { logActivity } from '@/lib/activities';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: 'Record not found.' }, { status: 404 });
  return Response.json({ lead });
}

/**
 * Lead update — pipeline status, outreach status, next action, loss reason.
 * Status badla to timeline pe 'status_changed' likhte hain (from → to),
 * taake "kab interested hua tha" jaise sawal timeline se hi khul jayen.
 */
export async function PATCH(req, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request not valid.' }, { status: 400 });
  }

  const before = await getLead(id);
  if (!before) return Response.json({ error: 'Record not found.' }, { status: 404 });

  if (body.lead_status === 'lost' && !body.loss_reason && !before.loss_reason) {
    return Response.json({ error: 'Pick a loss reason when marking it as lost.' }, { status: 400 });
  }

  let lead;
  try {
    lead = await updateLead(id, body);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  // Timeline — best-effort (update ho chuka, log fail ho to kaam nahi rolte)
  try {
    if (body.lead_status && body.lead_status !== before.status) {
      await logActivity({
        order_id: lead.order_id,
        listing_id: lead.listing_id,
        lead_row_id: lead.Id,
        type: 'status_changed',
        title: `Status changed to ${body.lead_status.replace(/_/g, ' ')}`,
        detail: body.lead_status === 'lost' && (body.loss_reason || before.loss_reason)
          ? `Reason: ${(body.loss_reason || before.loss_reason).replace(/_/g, ' ')}`
          : null,
        meta: { from: before.status, to: body.lead_status },
      });
    } else if (body.outreach_status && body.outreach_status !== before.outreach_status) {
      await logActivity({
        order_id: lead.order_id,
        listing_id: lead.listing_id,
        lead_row_id: lead.Id,
        type: 'outreach_status',
        title: `Outreach: ${body.outreach_status.replace(/_/g, ' ')}`,
        meta: { from: before.outreach_status, to: body.outreach_status },
      });
    }
  } catch {}

  return Response.json({ ok: true, lead });
}
