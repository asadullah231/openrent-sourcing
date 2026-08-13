'use client';

// Rail ke nav links — current route pe "selected" state ke liye client
// component chahiye (usePathname), warna layout server component hi rehta.
// Selected state design bar ka hissa hai (DESIGN.md: "strong hover/selected
// states") — operator ko ek nazar me pata ho ke wo kahan khara hai.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items }) {
  const pathname = usePathname() || '';
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={active ? 'nav-link active' : 'nav-link'}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
