import { getSettings, saveSettings } from '@/lib/data';
// Bot ka wahi parser dashboard bhi use karta hai (`@bot/*` → ../src/*).
// Do alag copies rakhna sab se pakka tareeqa hai ke ek din dono alag faisla
// karein: dashboard link qubool kare aur bot usi pe fail ho jaye.
import { parseSearchUrl } from '@bot/search-url.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getSettings());
}

/**
 * ⚠️ `viewing.mode` yahan se NAHI badalta — jaan boojh kar.
 *
 * Dashboard ab bina login ke khula hai (client ka faisla). Pehle ek
 * `confirmLive: true` flag guard tha, magar wo sirf galti se bachata tha —
 * koi bhi wo flag bhej sakta hai. Aur live mode ka matlab hai bot Mo ke ASLI
 * OpenRent account se landlords ko viewing requests bhejta hai. Khule URL pe
 * ye rakhna = koi bhi Mo ka account ban karwa sakta hai.
 *
 * Isliye mode ab server pe hi rehta hai. Badalna ho to NocoDB settings row me
 * seedha badlo (ya bot ke .env se).
 */
export async function POST(req) {
  const body = await req.json();

  const current = await getSettings();
  const requested = body?.viewing?.mode;

  if (requested && requested !== current?.viewing?.mode) {
    return Response.json(
      {
        error:
          'Mode dashboard se nahi badalta (safety). NocoDB settings me badlo.',
      },
      { status: 403 }
    );
  }

  // mode kabhi bhi client se na aaye — mojooda hi rehta hai
  if (body?.viewing) body.viewing.mode = current?.viewing?.mode;
  delete body.confirmLive;

  // Searches (Mo ke paste kiye link) — save karne se PEHLE parho.
  // Kharab link yahan rok lena bohot behtar hai; warna wo NocoDB me baith jata
  // hai aur agle cron pe fail hota hai, jahan Mo ko kabhi pata hi nahi chalta.
  if (Array.isArray(body?.areas)) {
    const clean = [];
    for (const a of body.areas) {
      // Purane hard-coded areas ({slug, term}) jaise ke waise chhor do —
      // wo pehle se chal rahe hain, unhe naye qanoon pe tolna theek nahi.
      if (!a?.pastedUrl) {
        clean.push(a);
        continue;
      }
      const r = parseSearchUrl(a.pastedUrl);
      if (!r.ok) {
        return Response.json({ error: `Link theek nahi: ${r.error}` }, { status: 400 });
      }
      clean.push({
        ...r.search,
        pastedUrl: a.pastedUrl,
        enabled: a.enabled !== false,
        // Mo ne apna naam diya ho to wahi rakho, warna link se nikla hua
        name: a.name?.trim() || r.search.name,
      });
    }
    body.areas = clean;
  }

  const saved = await saveSettings(body);
  return Response.json(saved);
}
