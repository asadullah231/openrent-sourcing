import { getHealth } from '@/lib/data';
import { SearchBar } from '@/components/search-bar';

export const dynamic = 'force-dynamic';

// SEARCH page (home) — Asad ka faisla (23 Jul): pehle kuch na dikhe, sirf
// search bar. Mo apna OpenRent link paste kare → result gallery me aaye.
//
// Pehle yahan "New & pending" ki poori listings gallery + ticker thi. Wo hata
// di — ab ye saaf search page hai. (Purani listings /outreach aur detail pages
// pe abhi bhi milti hain; sirf ye page saaf kiya.)
function StatusLine({ health }) {
  const live = health.mode === 'live';
  return (
    <span className="font-mono text-muted" style={{ fontSize: 12 }}>
      {live ? 'LIVE' : 'SHADOW'} · autopilot {health.autopilot} · {health.sentToday}/{health.dailyCap} today
    </span>
  );
}

export default async function SearchPage() {
  let health = {};
  try {
    health = await getHealth();
  } catch {}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>Search</h1>
        <StatusLine health={health} />
      </div>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 22, fontSize: 13, maxWidth: 560, lineHeight: 1.6 }}>
        OpenRent pe search banao, us ka poora link yahan paste karo. Result foran
        neeche dikhega — pasand aaye to Save karo, bot usi ko chalata rahega.
      </p>

      <SearchBar />
    </div>
  );
}
