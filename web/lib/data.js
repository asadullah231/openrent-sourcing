// Data layer — dashboard bot ki asli files se parhta/likhta hai.
// Abhi single-tenant (Mo). SaaS ke liye: har user ka apna data folder (userId se scope).
// Jab NocoDB pe move karenge, sirf ye file badlegi — pages same rahenge.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// bot ke data folder ka path (web/ ke parent me)
const DATA = resolve(process.cwd(), '..', 'data');

async function readJson(name, fallback) {
  const p = resolve(DATA, name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(await readFile(p, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function readJsonl(name) {
  const p = resolve(DATA, name);
  if (!existsSync(p)) return [];
  const txt = await readFile(p, 'utf-8');
  return txt
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function getListings() {
  const map = await readJson('listings.json', {});
  return Object.values(map).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// Jinpe abhi tak request nahi gayi (naye/pending) — action lene layak
export async function getPending() {
  const all = await getListings();
  return all.filter((l) => (l.viewing_status || 'new') !== 'requested');
}

// Jinpe request ja chuki (sent) — history, requested_at pe sorted (naya upar)
export async function getSent() {
  const all = await getListings();
  return all
    .filter((l) => l.viewing_status === 'requested')
    .sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0));
}

export async function getSettings() {
  return readJson('settings.json', {});
}

export async function saveSettings(next) {
  // Merge over existing so _note aur unset fields bache rahein
  const cur = await readJson('settings.json', {});
  const merged = { ...cur, ...next, viewing: { ...cur.viewing, ...next.viewing }, filters: { ...cur.filters, ...next.filters } };
  await writeFile(resolve(DATA, 'settings.json'), JSON.stringify(merged, null, 2));
  return merged;
}

// Ek listing + uska bheja gaya message (drafts/log se) — detail page ke liye
export async function getListing(id) {
  const map = await readJson('listings.json', {});
  const l = map[id];
  if (!l) return null;

  // Exact message jo bheja gaya (ya draft) — drafts file me poora message hota hai
  const drafts = await readJsonl('viewing-drafts.jsonl');
  const draft = drafts.reverse().find((d) => String(d.listing_id) === String(id));

  // Send log se status/time
  const log = await readJsonl('viewing-log.jsonl');
  const sends = log.filter((x) => String(x.listing_id) === String(id));
  const lastSend = sends[sends.length - 1] || null;

  // priority: store me sent_message (live send se) > draft message
  return { ...l, sentMessage: l.sent_message || draft?.message || null, lastSend };
}

export async function getDrafts() {
  return (await readJsonl('viewing-drafts.jsonl')).reverse();
}

export async function getSendLog() {
  return (await readJsonl('viewing-log.jsonl')).reverse();
}

// Dashboard health/summary
export async function getHealth() {
  const listings = await getListings();
  const settings = await getSettings();
  const log = await readJsonl('viewing-log.jsonl');
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalListings: listings.length,
    withScore: listings.filter((l) => l.score != null).length,
    aboveViewingBar: listings.filter((l) => (l.score ?? 0) >= (settings.viewing?.minScore ?? 65)).length,
    sentToday: log.filter((x) => x.day === today && x.mode === 'live').length,
    draftsToday: log.filter((x) => x.day === today && x.mode === 'shadow').length,
    mode: settings.viewing?.mode ?? 'shadow',
    autopilot: settings.viewing?.autopilot ?? 'on',
    dailyCap: settings.viewing?.dailyCap ?? 15,
    minScore: settings.viewing?.minScore ?? 65,
  };
}
