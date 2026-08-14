import './globals.css';
import { getHealth } from '@/lib/data';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavLinks } from '@/components/nav-links';
import { BrandLogo } from '@/components/brand';

// Ye script HTML me sab se pehle chalti hai, React se bhi pehle.
// Kyun zaroori hai: theme localStorage me hai, jo server pe nahi hota. Agar
// hum React ka intezaar karein to dark mode wale ko har refresh pe aadhe
// second ka SAFED FLASH dikhta hai — aankhon me chubhta hai. Ye script paint
// se pehle data-theme laga deti hai, is liye flash hota hi nahi.
// microRealEstate redesign: product ka default LIGHT hai (real-estate SaaS
// light-first hota hai) — system preference nahi dekhte, sirf user ka apna
// toggle yaad rehta hai.
// Key 'sh-theme' hai (purani 'theme' NAHI): dark-default zamane ki saved
// 'dark' values sab ke browsers me pari hain — nayi key se wo ek dafa
// ignore ho jati hain aur har user light pe aa jata hai. Toggle ab isi
// nayi key me yaad rakhta hai.
const NO_FLASH = `(function(){try{var t=localStorage.getItem('sh-theme')||'light';
document.documentElement.setAttribute('data-theme',t);}catch(e){
document.documentElement.setAttribute('data-theme','light');}})();`;

// Brand directive (13 Aug): customer-facing naam sirf "Social Housing".
export const metadata = {
  title: 'Social Housing',
  description: 'Social Housing: property sourcing platform',
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
// (/sourcing) — data model wahi ka wahi, sirf naam badla.
// Redesign directive (13 Aug, raat): nav EXACT ye tarteeb — Dashboard, Orders,
// Properties, Sourcing, Outreach, Viewings, Deals, Settings. Viewings/Deals
// alag pages hain (wahi lead data, pipeline-end lens). Map primary nav se
// bahar — /map route zinda hai, Properties page se link milta hai.
const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/properties', label: 'Properties' },
  { href: '/sourcing', label: 'Sourcing' },
  { href: '/outreach', label: 'Outreach' },
  { href: '/viewings', label: 'Viewings' },
  { href: '/deals', label: 'Deals' },
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
            {/* Official horizontal logo (brand directive) — mark + wordmark */}
            <div style={{ padding: '4px 10px 24px' }}>
              <BrandLogo markSize={30} />
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 12px 8px' }}>Menu</div>
            <NavLinks items={nav} />

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
