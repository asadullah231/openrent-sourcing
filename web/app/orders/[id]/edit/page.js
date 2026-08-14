import Link from 'next/link';
import { getOrder } from '@/lib/orders';
import { OrderForm } from '@/components/order-form';

export const dynamic = 'force-dynamic';

export default async function EditOrderPage({ params }) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Order not found</p>
        <p className="text-muted" style={{ margin: '6px 0 16px', fontSize: 13 }}>It may have been deleted.</p>
        <Link href="/orders" className="btn-brass" style={{ textDecoration: 'none' }}>Back to orders</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Link href={`/orders/${order.Id}`} className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>
          ← {order.order_number || `ORD-${String(order.Id).padStart(4, '0')}`}
        </Link>
        <h1 style={{ margin: '8px 0 0' }}>Edit order</h1>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>
          Changing area, bedrooms or budget only affects future searches, existing matches keep their saved numbers.
        </p>
      </div>
      <OrderForm order={order} />
    </div>
  );
}
