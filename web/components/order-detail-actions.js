'use client';

// Order header ke Edit/Delete buttons (13 Aug: "order edit/delete nahi kar
// sakte" feedback). Delete confirm window.confirm se hi (folder-rooms.js
// aur search-toggles.js me pehle se yehi pattern hai) — nayi modal nahi.
// Cascade delete (matches + activities) backend me hoti hai
// (lib/orders.js deleteOrder) — yahan sirf trigger + naveigate.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OrderDetailActions({ order }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const label = order.order_number || `ORD-${String(order.Id).padStart(4, '0')}`;

  async function del() {
    const matchCount = order._matchCount || 0;
    const warn = matchCount > 0
      ? `Delete ${label}? This also deletes its ${matchCount} matched propert${matchCount === 1 ? 'y' : 'ies'}. This cannot be undone.`
      : `Delete ${label}? This cannot be undone.`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/${order.Id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      router.push('/orders');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
      {error && (
        <span style={{ fontSize: 12, color: 'var(--rust)' }}>{error}</span>
      )}
      <Link href={`/orders/${order.Id}/edit`} className="seg" style={{ textDecoration: 'none', fontSize: 12.5 }}>
        Edit
      </Link>
      <button type="button" className="seg" style={{ fontSize: 12.5, color: 'var(--rust)' }} onClick={del} disabled={busy}>
        {busy ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  );
}
