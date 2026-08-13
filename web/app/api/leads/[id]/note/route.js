import { getLead } from '@/lib/leads';
import { logActivity } from '@/lib/activities';

export const dynamic = 'force-dynamic';

/** Lead pe note — seedha timeline me jata hai. Body: { text } */
export async function POST(req, { params }) {
  const { id } = await params;
  let body = {};
  try { body = await req.json(); } catch {}
  const text = String(body.text || '').trim();
  if (!text) return Response.json({ error: 'Note text is required.' }, { status: 400 });

  const lead = await getLead(id);
  if (!lead) return Response.json({ error: 'Lead not found.' }, { status: 404 });

  try {
    const activity = await logActivity({
      order_id: lead.order_id,
      listing_id: lead.listing_id,
      lead_row_id: lead.Id,
      type: 'note',
      title: 'Note added',
      detail: text,
    });
    return Response.json({ ok: true, activity });
  } catch (e) {
    return Response.json({ error: `Could not save the note: ${e.message}` }, { status: 502 });
  }
}
