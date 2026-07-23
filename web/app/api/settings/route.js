import { getSettings, saveSettings } from '@/lib/data';
// Bot ka wahi parser dashboard bhi use karta hai (`@bot/*` → ../src/*).
// parseAnyUrl OpenRent + Rightmove dono qubool karta hai (23 Jul auto-cross).
import { parseAnyUrl } from '@bot/portals.js';

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

  // Searches — save karte waqt saaf karo, lekin KABHI poora save na giraao.
  //
  // 🐛 BUG (23 Jul, Asad ne pakda: "wapas aaun to saari searches gayab"):
  // Pehle yahan har area ko parseSearchUrl (OpenRent-only) se re-validate karte
  // the, aur ek bhi fail hone pe POORA request 400 kar dete the. Auto-cross ke
  // baad Rightmove searches aa gayin — unka pastedUrl Rightmove ka hai, jise
  // OpenRent parser reject karta tha → har toggle/save 400 → kuch save hi na
  // hota → reload pe list wapas purani/khaali. Ab:
  //   • parseAnyUrl (dono portal), aur
  //   • ek area re-parse na ho to use JAISE KA WAISE rakho (giraao mat) —
  //     ek kharab entry ki saza poori list ko na mile.
  if (Array.isArray(body?.areas)) {
    const clean = [];
    for (const a of body.areas) {
      // Bina pastedUrl (purane hard-coded, ya bot ke banaye crossed) jaise ke waise.
      if (!a?.pastedUrl) {
        clean.push(a);
        continue;
      }
      const r = parseAnyUrl(a.pastedUrl);
      if (!r.ok) {
        // Re-parse fail — phir bhi save me rakho (drop mat karo). Toggle jaisi
        // aam harkat pe pori list gawaana is se bahot bura hai.
        clean.push(a);
        continue;
      }
      clean.push({
        ...r.search,
        pastedUrl: a.pastedUrl,
        enabled: a.enabled !== false,
        source: r.search.source || a.source || 'openrent',
        name: a.name?.trim() || r.search.name,
      });
    }
    body.areas = clean;
  }

  const saved = await saveSettings(body);
  return Response.json(saved);
}
