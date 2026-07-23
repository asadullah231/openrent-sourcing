import { parseAnyUrl, fanOut } from '@bot/portals.js';
import { getSettings, saveSettings, areaKey } from '@/lib/data';

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

  // Dedup ek hi canonical key pe (areaKey) — bilkul wahi jo data.js/UI use karte
  // hain. Pehle yahan alag key thi (guard `a.params` require karta tha), jis se
  // legacy entries kabhi dedup na hotin aur duplicate folder ban jaate.
  const existingKeys = new Set(areas.map(areaKey));

  let added = 0;
  const savedNames = [];
  for (const search of toSave) {
    const k = areaKey(search);
    if (existingKeys.has(k)) continue; // pehle se hai
    existingKeys.add(k);
    const isCrossed = !!search._crossed;
    areas.push({
      ...search,
      _crossed: undefined, // internal flag store me na jaye
      crossed: isCrossed, // 🐛 FIX (23 Jul): persist karo — warna UI ise "legacy" samajhta
      pastedUrl: isCrossed ? undefined : body.url, // sirf paste wali ka asli link
      enabled: true,
      name: body.name?.trim() && !isCrossed ? body.name.trim() : search.name,
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
