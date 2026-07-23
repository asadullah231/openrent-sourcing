import { parseAnyUrl, fanOut } from '@bot/portals.js';
import { getSettings, saveSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * Aazmai hui search ko pakka kar do — settings ki list me daal do.
 *
 * Alag route is liye ke /api/search sirf DIKHATA hai, badalta kuch nahi.
 * Save ek alag, jaan boojh kar liya gaya faisla hai: yahan se aage ye search
 * har cron run pe chalegi aur is se aane wali properties pe messages jayenge.
 *
 * Auto-cross (Mo, 23 Jul): ek link paste = SAB portals ki search save. Yani
 * OpenRent Croydon paste karo → OpenRent + Rightmove dono ka folder ban jaye,
 * dono ki outreach chal pade.
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request theek nahi.' }, { status: 400 });
  }

  const parsed = parseAnyUrl(body?.url);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  // Paste ki hui + baqi portals ki equivalent searches. fanOut fail ho to sirf
  // paste wali save ho jaye (feature na chale to bhi kaam na ruke).
  let crossed = [];
  try {
    crossed = await fanOut(parsed.search);
  } catch {
    crossed = [];
  }
  const toSave = [parsed.search, ...crossed];

  const settings = (await getSettings()) || {};
  const areas = Array.isArray(settings.areas) ? [...settings.areas] : [];

  // Wahi search dobara na add ho jaye. source + slug + ASLI filter params se milao.
  // faltu/runtime params (isLive, viewingProperty, jo bot khud lagata hai) chhoro.
  const IGNORE = new Set(['isLive', 'viewingProperty', 'viewingproperty']);
  const key = (s) => {
    const p = new URLSearchParams();
    Object.entries(s.params || {})
      .filter(([k]) => !IGNORE.has(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([k, v]) => p.set(k, v));
    return `${s.source || 'openrent'}|${s.slug}|${p.toString()}`;
  };

  let added = 0;
  const savedNames = [];
  for (const search of toSave) {
    const k = key(search);
    if (areas.some((a) => a.params && key(a) === k)) continue; // pehle se hai
    areas.push({
      ...search,
      pastedUrl: search._crossed ? undefined : body.url, // sirf paste wali ka asli link
      enabled: true,
      name: body.name?.trim() && !search._crossed ? body.name.trim() : search.name,
    });
    added++;
    savedNames.push(`${search.source === 'rightmove' ? 'Rightmove' : 'OpenRent'} · ${search.name}`);
  }

  // Kuch naya nahi bana (sab pehle se) — ye ERROR nahi, Mo ne dobara dabaya.
  if (added === 0) {
    return Response.json({ ok: true, already: true, count: areas.length, name: parsed.search.name });
  }

  const saved = await saveSettings({ ...settings, areas });
  return Response.json({
    ok: true,
    count: (saved.areas || []).length,
    added,
    savedNames,
    name: parsed.search.name,
  });
}
