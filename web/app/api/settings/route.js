import { getSettings, saveSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getSettings());
}

export async function POST(req) {
  const body = await req.json();

  // Safety guard: live + autopilot on ek sath tabhi jab explicitly confirm ho.
  // Dashboard se galti se live na ho jaye — mode change ke liye confirm flag chahiye.
  if (body?.viewing?.mode === 'live' && !body?.confirmLive) {
    return Response.json(
      { error: 'Live mode ke liye confirmLive: true chahiye (safety).' },
      { status: 400 }
    );
  }
  delete body.confirmLive;

  const saved = await saveSettings(body);
  return Response.json(saved);
}
