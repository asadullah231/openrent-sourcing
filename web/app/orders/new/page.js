import Link from 'next/link';
import { OrderForm } from '@/components/order-form';

export const metadata = { title: 'New order — Social Housing' };

export default function NewOrderPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Link href="/orders" className="text-muted" style={{ fontSize: 12.5, textDecoration: 'none' }}>
          ← Orders
        </Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700 }}>New order</h1>
        <p className="text-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          Capture the requirement once — the property search runs on exactly these fields.
        </p>
      </div>
      <OrderForm />
    </div>
  );
}
