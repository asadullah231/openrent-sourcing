import { setShortlist } from '@/lib/orders';
import { logActivity } from '@/lib/activities';

export const dynamic = 'force-dynamic';

/**
 * Shortlist toggle — MVP criteria #7: "Shortlist a property and associate it
 * with the order." Row order_properties me pehle se hoti hai (Find Properties
 * ne banayi); ye sirf shortlist_status + next_action set/clear karta hai.
 *
 * Body: { listing_id, shortlisted: true|false, next_action? }
 */
export async function POST(req, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request not valid.' }, { status: 400 });
  }

  const listingId = String(body?.listing_id || '').trim();
  if (!listingId) return Response.json({ error: 'listing_id is required.' }, { status: 400 });

  try {
    const row = await setShortlist(id, listingId, !!body.shortlisted, body.next_action);
    if (!row) {
      return Response.json(
        { error: 'This property is not linked to the order — run Find Properties first.' },
        { status: 404 }
      );
    }
    // Timeline entry — fail ho to shortlist phir bhi ho chuki hai, isliye
    // best-effort (log ke liye user ka kaam wapas nahi rolte).
    try {
      await logActivity({
        order_id: id,
        listing_id: listingId,
        lead_row_id: row.Id,
        type: body.shortlisted ? 'shortlisted' : 'unshortlisted',
        title: body.shortlisted ? 'Lead shortlisted' : 'Removed from shortlist',
        detail: row.match_score != null ? `Match score: ${row.match_score}%` : null,
      });
    } catch {}
    return Response.json({ ok: true, row });
  } catch (e) {
    return Response.json({ error: `Could not update the shortlist: ${e.message}` }, { status: 502 });
  }
}
