import { getListings, getHealth } from '@/lib/data';
import { MapPin, Clock, Star, Home as HomeIcon } from 'lucide-react';
import { scoreColor } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const [listings, health] = await Promise.all([getListings(), getHealth()]);
  const modeLive = health.mode === 'live';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted">Live property pipeline + bot status</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Listings tracked" value={health.totalListings} sub={`${health.withScore} scored`} />
        <Stat label="Above viewing bar" value={health.aboveViewingBar} sub={`score ≥ ${65}`} />
        <Stat label="Sent today" value={health.sentToday} sub={`cap ${health.dailyCap}`} />
        <Stat
          label="Mode"
          value={modeLive ? '🔴 LIVE' : '🟡 Shadow'}
          sub={`autopilot ${health.autopilot}`}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Listings (by score)</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Property</th>
                <th className="text-left px-4 py-3">Rent</th>
                <th className="text-left px-4 py-3">Beds</th>
                <th className="text-left px-4 py-3">Fresh</th>
                <th className="text-left px-4 py-3">Landlord</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {listings.slice(0, 50).map((l) => (
                <tr key={l.listing_id} className="border-t border-border hover:bg-card/50">
                  <td className={`px-4 py-3 font-bold ${scoreColor(l.score)}`}>{l.score ?? '—'}</td>
                  <td className="px-4 py-3">
                    <a href={l.url} target="_blank" rel="noreferrer" className="hover:underline text-primary">
                      {l.address || l.title || l.listing_id}
                    </a>
                    <div className="text-xs text-muted">{l.score_reason}</div>
                  </td>
                  <td className="px-4 py-3">£{l.price}</td>
                  <td className="px-4 py-3">{l.beds}</td>
                  <td className="px-4 py-3">{l.hours_live != null ? `${l.hours_live}h` : '—'}</td>
                  <td className="px-4 py-3">{l.response_rate != null ? `${l.response_rate}%` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-border">
                      {l.viewing_status || 'new'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {listings.length === 0 && (
            <div className="p-10 text-center text-sm text-muted">
              Abhi koi listing nahi. Bot chalao: <code>node src/main.js --once</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
