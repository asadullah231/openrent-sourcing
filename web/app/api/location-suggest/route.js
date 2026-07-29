export const dynamic = 'force-dynamic';

/**
 * Location autocomplete (Mo, 29 Jul) — OpenRent ki apni suggestions.
 *
 * KYUN proxy (browser se seedha nahi): OpenRent ka autocomplete endpoint
 * CORS allow nahi karta, aur browser se cross-site call block hota. To dashboard
 * ka server beech me — Mo type karta hai, hum OpenRent se poochte hain, wahi asli
 * suggestions ("Bexley, Greater London", "Selborne Ave, Bexley...") wapas dete.
 *
 * Endpoint (live probe se, 29 Jul):
 *   GET https://www.openrent.co.uk/autocomplete/placesautocomplete?needle=<q>
 *   → { suggestions: ["Bexley, Greater London", ...], validNeedle: true }
 *
 * GET /api/location-suggest?q=Bex  → { suggestions: [...] }
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return Response.json({ suggestions: [] });

  const url = `https://www.openrent.co.uk/autocomplete/placesautocomplete?needle=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: 'https://www.openrent.co.uk/properties-to-rent/london',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) return Response.json({ suggestions: [] });
    const j = await res.json();
    const suggestions = Array.isArray(j?.suggestions) ? j.suggestions.slice(0, 10) : [];
    return Response.json({ suggestions });
  } catch {
    // Fail par khali — form phir bhi manual type se chalta hai (autocomplete optional).
    return Response.json({ suggestions: [] });
  }
}
