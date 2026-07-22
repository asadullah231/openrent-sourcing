import './globals.css';
import Link from 'next/link';
import { getHealth } from '@/lib/data';

export const metadata = {
  title: 'OpenRent Sourcing — Control',
  description: 'Property sourcing bot control panel',
};

const nav = [
  { href: '/', label: 'New & pending' },
  { href: '/map', label: 'Map' },
  { href: '/sent', label: 'Requested' },
  { href: '/queue', label: 'Queue' },
  { href: '/settings', label: 'Settings' },
];

export default async function RootLayout({ children }) {
  let health = {};
  try {
    health = await getHealth();
  } catch {}
  const live = health.mode === 'live';

  return (
    <html lang="en">
      <body>
        {/* live-wire: ambient signal that the system is armed */}
        {live && <div className="live-wire" aria-hidden="true" />}

        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* left rail */}
          <aside
            style={{
              width: 220,
              borderRight: '1px solid var(--mist-line)',
              padding: '20px 14px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              position: 'sticky',
              top: 0,
              height: '100vh',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 10px 24px' }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(145deg,#edc06a,var(--brass))', display: 'grid', placeItems: 'center', color: '#1a1204', fontWeight: 700, fontSize: 14, boxShadow: '0 2px 6px rgba(0,0,0,.35)' }}>S</span>
              <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.02em' }}>Sourcing</span>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 12px 8px' }}>Menu</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="nav-link"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--r-ctrl)',
                    textDecoration: 'none',
                    fontSize: 13.5,
                    fontWeight: 500,
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--mist-line)', fontSize: 11.5, lineHeight: 1.6, color: 'var(--mist)' }}>
              <div style={{ padding: '14px 10px 0' }}>Each user runs on their own login. Requests go from their account.</div>
            </div>
          </aside>

          <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1120, width: '100%' }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
