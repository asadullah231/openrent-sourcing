import { parseAnyUrl } from '@bot/portals.js';
import { getSettings, saveSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * Aazmai hui search ko pakka kar do — settings ki list me daal do.
 *
 * Alag route is liye ke /api/search sirf DIKHATA hai, badalta kuch nahi.
 * Save ek alag, jaan boojh kar liya gaya faisla hai: yahan se aage ye search
 * har cron run pe chalegi aur is se aane wali properties pe messages jayenge.
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

  const settings = (await getSettings()) || {};
  const areas = Array.isArray(settings.areas) ? [...settings.areas] : [];

  // Wahi search dobara na add ho jaye. Slug + ASLI filter params se milao.
  // faltu/runtime params (isLive, viewingProperty, jo bot khud lagata hai) ko
  // chhod do — warna wahi search "alag" lagti hai aur list me duplicate ban
  // jate hain (23 Jul: settings me teen Tower Hamlets isi wajah se bane).
  const IGNORE = new Set(['isLive', 'viewingProperty', 'viewingproperty']);
  const key = (s) => {
    const p = new URLSearchParams();
    Object.entries(s.params || {})
      .filter(([k]) => !IGNORE.has(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([k, v]) => p.set(k, v));
    // source bhi key me — taake OpenRent aur Rightmove ki search alag rahein
    // (theoretically slug takra sakta hai; portal se distinct rakho).
    return `${s.source || 'openrent'}|${s.slug}|${p.toString()}`;
  };
  const newKey = key(parsed.search);

  // Pehle se hai? Ye ERROR nahi — Mo ne bas dobara "Save & start" dabaya.
  // Success do (search zinda hai) taake button ✓ dikhaye aur outreach chale.
  if (areas.some((a) => a.params && key(a) === newKey)) {
    return Response.json({
      ok: true,
      already: true,
      count: areas.length,
      name: parsed.search.name,
    });
  }

  areas.push({
    ...parsed.search,
    pastedUrl: body.url,
    enabled: true,
    name: body.name?.trim() || parsed.search.name,
  });

  const saved = await saveSettings({ ...settings, areas });
  return Response.json({ ok: true, count: (saved.areas || []).length, name: parsed.search.name });
}
