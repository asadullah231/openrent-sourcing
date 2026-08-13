import { getHealth } from '@/lib/data';
import { SearchBar } from '@/components/search-bar';
import { SearchForm } from '@/components/search-form';

export const dynamic = 'force-dynamic';

// SEARCH page — pehle ye home (/) tha. 13 Aug directive: properties dhundne ka
// primary raasta ab Order → Find Properties hai, is liye Search nav se hata aur
// yahan /search pe shift hua. Functionality wahi ki wahi (form + paste-link);
// searches/view aur listing detail ke "Back to Search" links yahin aate hain.
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
        Set a location, bedrooms and rent. The bot searches OpenRent on a schedule
        and keeps only the listings that fit. Prefer a link? Paste one below instead.
      </p>

      {/* Naya default (Mo, 28 Jul): form se search — location + beds + max rent. */}
      <SearchForm />

      {/* Purana paste-link flow — secondary, collapsed. Kuch toota nahi; jab Mo
          ke paas already-built OpenRent link ho to ye rahe. */}
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--mist)', userSelect: 'none' }}>
          Or paste an OpenRent link instead
        </summary>
        <div style={{ marginTop: 14 }}>
          <SearchBar />
        </div>
      </details>
    </div>
  );
}
