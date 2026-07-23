// Rightmove location-lookup — area ka NAAM le kar Rightmove ka andaruni code
// (locationIdentifier, jaise REGION^391) nikaalo.
//
// KYUN (23 Jul, Mo: "ek link paste karun, bot khud baqi sites pe wohi search
// banaye"): OpenRent link me area ka naam hota hai ("Croydon"), lekin Rightmove
// URL me naam nahi chalta — usko REGION^391 chahiye. Rightmove ki apni typeahead
// API se wahi code milta hai jo un ki site istemaal karti hai.
//
// Endpoint (live probe se): https://los.rightmove.co.uk/typeahead?query=Croydon
//   -> { matches: [ { type:'REGION', id:'391', displayName:'Croydon, London' }, ... ] }

import { config } from './config.js';

/**
 * Area naam -> Rightmove locationIdentifier (e.g. "REGION^391"), ya null.
 *
 * Match rule: pehla REGION match lo (STREET/STATION chhoro). London areas ke liye
 * "London"/"Borough" wala tarjeeh — warna pehla REGION. Ye wahi natija deta hai
 * jo Rightmove ki site pe user ko dropdown me sab se upar milta hai.
 */
export async function rightmoveLocationId(name) {
  const q = String(name || '').trim();
  if (!q) return null;

  let matches;
  try {
    const res = await fetch(
      `https://los.rightmove.co.uk/typeahead?query=${encodeURIComponent(q)}&limit=8`,
      {
        headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) return null;
    matches = (await res.json())?.matches || [];
  } catch {
    return null;
  }
  if (!matches.length) return null;

  const regions = matches.filter((m) => m.type === 'REGION');
  if (!regions.length) return null;

  // Behtar match (23 Jul fix). Pehle exact/normalized naam, phir London-hint,
  // phir contains, phir jhak ke regions[0]. Pehle sirf startsWith tha — jo
  // "London Borough of X" jaise naamon pe fail ho kar galat chhoti jagah utha leta.
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const qn = norm(q);
  const nameOf = (m) => norm(m.displayName.split(/[,(]/)[0]); // "Croydon, London" → "croydon"

  const exact = regions.find((m) => nameOf(m) === qn);
  if (exact) return `${exact.type}^${exact.id}`;

  // London/borough wala jisme query naam mojood ho
  const londonHint = regions.find(
    (m) => /london|borough/i.test(m.displayName) && norm(m.displayName).includes(qn)
  );
  if (londonHint) return `${londonHint.type}^${londonHint.id}`;

  const contains = regions.find((m) => norm(m.displayName).includes(qn));
  const chosen = contains || regions[0];
  return `${chosen.type}^${chosen.id}`;
}
