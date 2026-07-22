import { parseSearchUrl } from '@bot/search-url.js';
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

  const parsed = parseSearchUrl(body?.url);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const settings = (await getSettings()) || {};
  const areas = Array.isArray(settings.areas) ? [...settings.areas] : [];

  // Wahi search dobara na add ho jaye. Slug+params se milao, poore link se nahi —
  // OpenRent ka link har baar thora alag ban sakta hai (params ki tarteeb badal
  // jati hai) magar search wahi hoti hai.
  const key = (s) => `${s.slug}|${new URLSearchParams(s.params || {}).toString()}`;
  const newKey = key(parsed.search);
  if (areas.some((a) => a.params && key(a) === newKey)) {
    return Response.json({ error: 'Ye search pehle se list me hai.' }, { status: 409 });
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
