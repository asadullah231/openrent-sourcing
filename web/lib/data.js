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
