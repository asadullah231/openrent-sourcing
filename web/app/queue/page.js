import { getDrafts, getSendLog, getSettings } from '@/lib/data';
import { Send, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Queue() {
  const [drafts, log, settings] = await Promise.all([getDrafts(), getSendLog(), getSettings()]);
  const live = settings.viewing?.mode === 'live';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Viewing Queue</h1>
        <p className="text-sm text-muted">
          {live
            ? '🔴 LIVE — requests asli bhej rahe hain'
            : '🟡 Shadow — requests ban rahe hain, bheje NAHI ja rahe (review karo)'}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Drafts / built requests
        </h2>
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                  {d.address}
                </a>
                <span className="text-sm font-bold">score {d.score}</span>
              </div>
              <p className="text-sm text-muted mt-2">{d.message}</p>
            </div>
          ))}
          {drafts.length === 0 && <div className="text-sm text-muted">Abhi koi draft nahi.</div>}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Send className="h-4 w-4" /> Send log
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card text-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Day</th>
                <th className="text-left px-4 py-2">Mode</th>
                <th className="text-left px-4 py-2">Property</th>
                <th className="text-left px-4 py-2">Score</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((x, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2">{x.day}</td>
                  <td className="px-4 py-2">
                    <span className={x.mode === 'live' ? 'text-red-500' : 'text-amber-500'}>{x.mode}</span>
                  </td>
                  <td className="px-4 py-2">{x.address}</td>
                  <td className="px-4 py-2">{x.score}</td>
                  <td className="px-4 py-2">{x.status ?? 'built'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {log.length === 0 && <div className="p-6 text-center text-sm text-muted">Koi send log nahi.</div>}
        </div>
      </div>
    </div>
  );
}
