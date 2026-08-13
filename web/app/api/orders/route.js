import { getOrders, createOrder, getMatchCounts } from '@/lib/orders';

export const dynamic = 'force-dynamic';

/** Orders list + per-order match counts (list page ek hi call me bhar jaye). */
export async function GET() {
  try {
    const orders = await getOrders();
    const counts = await getMatchCounts();
    return Response.json({ orders, counts });
  } catch (e) {
    return Response.json({ error: `Could not load orders: ${e.message}` }, { status: 502 });
  }
}

/** Naya order banao. area + max_rent lazmi — inke baghair sourcing ho hi nahi sakti. */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request not valid.' }, { status: 400 });
  }

  const area = String(body?.area || '').trim();
  if (!area) return Response.json({ error: 'Area is required.' }, { status: 400 });

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== '' && v != null ? n : null;
  };
  const max_rent = num(body.max_rent);
  if (max_rent == null || max_rent <= 0) {
    return Response.json({ error: 'Maximum rent is required (hard budget rule).' }, { status: 400 });
  }

  const bedrooms = num(body.bedrooms);
  const bedrooms_max = num(body.bedrooms_max);
  if (bedrooms != null && bedrooms_max != null && bedrooms > bedrooms_max) {
    return Response.json({ error: 'Min bedrooms cannot be more than max bedrooms.' }, { status: 400 });
  }

  try {
    const order = await createOrder({
      order_number: String(body.order_number || '').trim() || undefined,
      council_client: String(body.council_client || '').trim() || null,
      area,
      postcodes: String(body.postcodes || '').trim() || null,
      property_type: String(body.property_type || '').trim().toLowerCase() || null,
      bedrooms,
      bedrooms_max,
      min_rent: num(body.min_rent),
      max_rent,
      order_rate: num(body.order_rate),
      availability: String(body.availability || '').trim() || 'ASAP',
      furnished: String(body.furnished || '').trim().toLowerCase() || null,
      special_requirements: String(body.special_requirements || '').trim() || null,
      priority: String(body.priority || '').trim().toLowerCase() || 'normal',
      deadline: String(body.deadline || '').trim() || null,
      notes: String(body.notes || '').trim() || null,
      agent_fee: num(body.agent_fee),
      other_costs: num(body.other_costs),
    });
    return Response.json({ ok: true, order });
  } catch (e) {
    return Response.json({ error: `Could not create the order: ${e.message}` }, { status: 502 });
  }
}
