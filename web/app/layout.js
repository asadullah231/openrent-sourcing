import './globals.css';
import Link from 'next/link';
import { getHealth } from '@/lib/data';

export const metadata = {
  title: 'OpenRent Sourcing — Control',
  description: 'Property sourcing bot control panel',
};

const nav = [
  { href: '/', label: 'Board' },
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
              width: 208,
              borderRight: '1px solid var(--mist-line)',
              padding: '22px 16px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 8px 20px' }}>
              <span className="font-display" style={{ fontSize: 21, color: 'var(--brass)' }}>
                Sourcing
              </span>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {nav.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="nav-link"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--r-pill)',
                    color: 'var(--paper)',
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: 18,
                borderTop: '1px solid var(--mist-line)',
                fontSize: 11.5,
                lineHeight: 1.6,
                color: 'var(--mist)',
                padding: '18px 8px 0',
              }}
            >
              Each user runs on their own login. Requests go from their account, never a shared one.
            </div>
          </aside>

          <main style={{ flex: 1, padding: '30px 34px', maxWidth: 1040 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
