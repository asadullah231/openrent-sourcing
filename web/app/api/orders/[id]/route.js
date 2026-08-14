import { getOrder, updateOrder, deleteOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return Response.json({ error: 'Order not found.' }, { status: 404 });
  return Response.json({ order });
}

/** Order edit — sirf bheje gaye fields patch hote hain (partial update). */
export async function PATCH(req, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request not valid.' }, { status: 400 });
  }

  const existing = await getOrder(id);
  if (!existing) return Response.json({ error: 'Order not found.' }, { status: 404 });

  // Sirf jaane-pehchaane fields — client jo bhi bheje, table me kachra na jaye.
  const ALLOWED = new Set([
    'order_number', 'council_client', 'area', 'postcodes', 'property_type',
    'bedrooms', 'bedrooms_max', 'min_rent', 'max_rent', 'order_rate',
    'availability', 'furnished', 'special_requirements', 'priority',
    'deadline', 'status', 'notes', 'agent_fee', 'other_costs',
  ]);
  const NUMERIC = new Set(['bedrooms', 'bedrooms_max', 'min_rent', 'max_rent', 'order_rate', 'agent_fee', 'other_costs']);

  const patch = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (!ALLOWED.has(k)) continue;
    if (NUMERIC.has(k)) {
      const n = Number(v);
      patch[k] = Number.isFinite(n) && v !== '' && v != null ? n : null;
    } else {
      patch[k] = v == null ? null : String(v).trim() || null;
    }
  }
  if (patch.max_rent === null) {
    return Response.json({ error: 'Maximum rent cannot be removed (hard budget rule).' }, { status: 400 });
  }
  if (!Object.keys(patch).length) {
    return Response.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const order = await updateOrder(id, patch);
    return Response.json({ ok: true, order });
  } catch (e) {
    return Response.json({ error: `Could not update the order: ${e.message}` }, { status: 502 });
  }
}

/** Order delete — matched/shortlisted properties aur activities bhi sath jate hain (cascade). */
export async function DELETE(_req, { params }) {
  const { id } = await params;
  const existing = await getOrder(id);
  if (!existing) return Response.json({ error: 'Order not found.' }, { status: 404 });

  try {
    const result = await deleteOrder(id);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: `Could not delete the order: ${e.message}` }, { status: 502 });
  }
}
