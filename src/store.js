// Local JSON store — dedupe by listing_id. NocoDB-shaped, taake M2 me seedha NocoDB pe swap ho.
// Ek file: data/listings.json  = { [listing_id]: listingObject }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '../data/listings.json');

async function load() {
  if (!existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function save(map) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(map, null, 2));
}

// Naye listings merge karo. Purane ka viewing_status/enrichment preserve, sirf naye add.
// Returns: { added: [...], total, seenBefore }
export async function upsert(listings) {
  const map = await load();
  const added = [];
  for (const l of listings) {
    if (l._forceUpdate) {
      // Enrichment update — mojooda record ke upar merge, viewing_status preserve.
      const { _forceUpdate, ...clean } = l;
      map[l.listing_id] = { ...map[l.listing_id], ...clean };
      continue;
    }
    if (map[l.listing_id]) continue; // dedupe — pehle se hai to chhoro
    map[l.listing_id] = l;
    added.push(l);
  }
  await save(map);
  return { added, total: Object.keys(map).length, seenBefore: listings.length - added.length };
}

export async function count() {
  return Object.keys(await load()).length;
}

// Ek listing ka status/patch update karo (viewing_status waghera) — merge, save.
export async function updateStatus(listingId, patch) {
  const map = await load();
  if (!map[listingId]) return false;
  map[listingId] = { ...map[listingId], ...patch };
  await save(map);
  return true;
}

// Store se scored listings load karo (viewing processing ke liye)
export async function all() {
  return Object.values(await load());
}
