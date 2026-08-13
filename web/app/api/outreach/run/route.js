import { getSettings } from '@/lib/data';

export const dynamic = 'force-dynamic';
// run.sh scrape + viewing chalata hai — 60s tak le sakta hai.
export const maxDuration = 60;

/**
 * "Send a batch now" button ka backend (Asad ka qadam #3, 23 Jul).
 *
 * ARCHITECTURE (kyun seedha nahi):
 *   Dashboard Vercel pe hai (serverless) — wahan bot ki process nahi chal
 *   sakti, na hi VPS pe koi command. Bot VPS pe hai. Beech me n8n webhook:
 *
 *     [button] → /api/outreach/run → n8n webhook → SSH → VPS: ./run.sh
 *
 *   n8n webhook (`OR outreach trigger`, path openrent-outreach-run) VPS pe
 *   permanent + active hai. run.sh wahi hai jo cron chalata hai — proxy set
 *   kar ke node main.js --once. Yani button aur cron BILKUL same kaam karte
 *   hain, sirf trigger alag (haath se vs waqt pe).
 *
 * SAFETY:
 *   - Live mode me ye asli messages Mo ke account se bhejta hai. Magar flood
 *     nahi hota: perRunCap (~3) aur 45-90s delay bot ke andar pehle se hain.
 *     Button sirf "abhi ek batch" chalata hai, poora din ka cap nahi.
 *   - Mode server-locked hai — button shadow/live badal nahi sakta.
 */
export async function POST() {
  // Webhook URL do jagah se: pehle Vercel env, warna NocoDB settings.
  //
  // Kyun dono: Vercel env sab se saaf hai, magar us ke liye Vercel token/CLI
  // chahiye (is machine pe nahi tha). NocoDB settings me daalna foran chal
  // jata hai — dashboard waise bhi wahin se settings padhta hai. Jab kabhi
  // Vercel env set ho jaye, wo jeet jayega.
  let url = process.env.N8N_OUTREACH_WEBHOOK;
  if (!url) {
    try {
      const s = await getSettings();
      url = s?.outreachWebhook;
    } catch {}
  }
  if (!url) {
    return Response.json(
      { error: 'Outreach trigger set nahi (webhook URL missing).' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      // run.sh ka intezaar — synchronous, taake result wapas dikha sakein
      signal: AbortSignal.timeout(55000),
    });

    // n8n stdout wapas deta hai; usme se kaam ki lines nikaal lo
    let out = '';
    try {
      const j = await res.json();
      out = j?.stdout || '';
    } catch {
      out = await res.text().catch(() => '');
    }

    // "X sent" / "candidate(s)" / fail — ye lines Mo ke liye kaam ki hain
    const lines = out
      .split('\n')
      .filter((l) => /sent|candidate|viewing|fail|error|scrape|NEW saved/i.test(l))
      .slice(-8);

    return Response.json({ ok: res.ok, summary: lines, raw: out.slice(-1500) });
  } catch (err) {
    // timeout ya net — button ko batao ke shuru to ho gaya
    const msg = err?.name === 'TimeoutError'
      ? 'Batch chal rahi hai (background me). Outreach page pe thodi der me natija.'
      : `Trigger nahi hua: ${err.message}`;
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
