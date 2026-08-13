import './globals.css';
import Link from 'next/link';
import { getHealth } from '@/lib/data';
import { ThemeToggle } from '@/components/theme-toggle';

// Ye script HTML me sab se pehle chalti hai, React se bhi pehle.
// Kyun zaroori hai: theme localStorage me hai, jo server pe nahi hota. Agar
// hum React ka intezaar karein to dark mode wale ko har refresh pe aadhe
// second ka SAFED FLASH dikhta hai — aankhon me chubhta hai. Ye script paint
// se pehle data-theme laga deti hai, is liye flash hota hi nahi.
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');
if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}
document.documentElement.setAttribute('data-theme',t);}catch(e){
document.documentElement.setAttribute('data-theme','dark');}})();`;

export const metadata = {
  title: 'Social Housing — Sourcing',
  description: 'Social housing property sourcing control panel',
};

// Asad ka faisla (23 Jul): sirf 4 pages nav me. New&pending / Requested / Queue
// hata diye — Search hi ab home hai (pehle khali, link paste karo → gallery).
// /sent aur /queue routes zinda hain (detail links unhe use karte hain), bas
// nav se nikaal diye.
// CRM phase (13 Aug): Dashboard/Leads/Properties add hue — ab ye sourcing CRM
// hai, sirf scraper dashboard nahi. Landlords/Agents/Viewings/Deals ke alag
// pages Phase 2 me banenge (abhi wo pipeline statuses ke andar hi jeete hain —
// khali placeholder pages nav me rakhna user ko dead-ends dena hota).
// Search nav se HATA (13 Aug directive): properties ab Order → Find Properties
// se dhundi jati hain. Standalone search /search pe zinda hai (paste-link flow
// wahi ka wahi), sirf primary entry point nahi raha. Root / ab dashboard pe jata hai.
// "Leads" nav se HATA (13 Aug directive): Lead = order↔property relationship,
// user ko ye lafz kabhi nahi dikhna chahiye. Wahi workspace ab "Sourcing" hai
// (/sourcing) — data model wahi ka wahi, sirf naam badla. Nav ki tarteeb
// workflow ki tarteeb hai: Order → Sourcing → Outreach.
const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/sourcing', label: 'Sourcing' },
  { href: '/outreach', label: 'Outreach' },
  { href: '/properties', label: 'Properties' },
  { href: '/map', label: 'Map' },
  { href: '/settings', label: 'Settings' },
];

export default async function RootLayout({ children }) {
  let health = {};
  try {
    health = await getHealth();
  } catch {}
  const live = health.mode === 'live';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
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
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(145deg,#edc06a,var(--brass))', display: 'grid', placeItems: 'center', color: '#1a1204', fontWeight: 700, fontSize: 12, boxShadow: '0 2px 6px rgba(0,0,0,.35)' }}>SH</span>
              <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.02em' }}>Social Housing</span>
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
              <div style={{ padding: '14px 2px 12px' }}>
                <ThemeToggle />
              </div>
              <div style={{ padding: '0 10px' }}>Each user runs on their own login. Requests go from their account.</div>
            </div>
          </aside>

          {/* maxWidth 1120 tha — bari screen pe dayen ~600px khali reh jata tha
              (Asad ne pakda, 22 Jul). 1600 pe cards ka grid khud 4-5 columns
              bana leta hai (auto-fill minmax(272px,1fr)), aur map ko bhi poori
              chaudai milti hai. Cap poori tarah hataya nahi — 2000px+ monitor pe
              text ki lambi lines parhna mushkil ho jata hai. */}
          <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1600, width: '100%' }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
