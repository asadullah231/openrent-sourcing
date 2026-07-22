import { getSettings, saveSettings } from '@/lib/data';

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

  const saved = await saveSettings(body);
  return Response.json(saved);
}
