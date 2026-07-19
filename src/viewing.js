// M3 — Auto viewing request. SAFETY-FIRST.
//
// Rails (non-negotiable):
//  1. mode='shadow' → request tayyar hota hai lekin POST NAHI hota (draft file me).
//  2. Idempotent: listing ka viewing_status 'requested' hone ke baad dobara kabhi nahi.
//  3. Daily cap: config.viewing.dailyCap se zyada nahi.
//  4. Score gate: sirf config.viewing.minScore se upar.
//  5. Kill switch: autopilot='off' → kuch nahi.
//  6. Har attempt log hota hai (draft ya live dono).
//
// One-shot form: OpenRent har property pe SIRF EK BAAR submit hone deta hai, undo nahi.
// Isliye status pehle 'requested' likhte hain (idempotency), phir hi bhejte hain — kabhi double nahi.

import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authFetch } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRAFTS_FILE = resolve(__dirname, '../data/viewing-drafts.jsonl');
const LOG_FILE = resolve(__dirname, '../data/viewing-log.jsonl');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Aaj asli (LIVE) bheji gayi requests count — daily cap sirf live sends pe lagta hai.
// Shadow drafts cap me nahi ginte (warna shadow week cap kha jata hai).
async function sentToday() {
  if (!existsSync(LOG_FILE)) return 0;
  const lines = (await readFile(LOG_FILE, 'utf-8')).trim().split('\n').filter(Boolean);
  const today = todayKey();
  return lines.filter((l) => {
    try {
      const e = JSON.parse(l);
      return e.day === today && e.mode === 'live'; // sirf live count
    } catch {
      return false;
    }
  }).length;
}

async function logAttempt(entry) {
  await mkdir(dirname(LOG_FILE), { recursive: true });
  await appendFile(LOG_FILE, JSON.stringify({ ...entry, day: todayKey() }) + '\n');
}

async function writeDraft(entry) {
  await mkdir(dirname(DRAFTS_FILE), { recursive: true });
  await appendFile(DRAFTS_FILE, JSON.stringify(entry) + '\n');
}

// "3 Bed Maisonette, Swaton Road, E3" → "Swaton Road, E3" (bed-type prefix hata do)
function shortPlace(listing) {
  const a = listing.address || listing.title || '';
  const parts = a.split(',').map((s) => s.trim()).filter(Boolean);
  // Pehla part aksar "X Bed <type>" hota hai — usko chhoro agar 'bed'/'room' ho
  if (parts.length > 1 && /bed|room|studio|flat|house|maisonette/i.test(parts[0])) {
    return parts.slice(1).join(', ');
  }
  return a || `listing ${listing.listing_id}`;
}

// Ek listing ka viewing-request payload banao (POST se pehle wala sab).
function buildRequest(listing, token) {
  const v = config.viewing;
  const place = shortPlace(listing);
  const message = v.messageTemplate
    .replace('{place}', place)
    .replace('{availability}', v.availabilityText);
  const body = new URLSearchParams();
  body.set('RequestViewing', 'true');
  body.set('Subject', v.subject);
  body.set('Message', message);
  // ⚠️ Availability REQUIRED field — bina iske OpenRent "Availability is required" deta hai.
  // (Ye woh availability text hai jo landlord ko batata hai kab free ho.)
  body.set('Availability', v.availabilityText);
  body.set('SendCopyToTenant', 'true');
  body.set('RedirectFromHousingAssociationRentNow', 'false');
  body.set('__RequestVerificationToken', token);
  return {
    url: `${config.base}/messagelandlord/${listing.listing_id}`,
    body: body.toString(),
    preview: { listing_id: listing.listing_id, address: place, score: listing.score, message },
  };
}

// Form GET karke fresh anti-forgery token nikalo (stale token = reject).
async function fetchToken(listing, jar) {
  const res = await authFetch(`${config.base}/messagelandlord/${listing.listing_id}`, jar, {
    redirect: 'follow',
  });
  const html = await res.text();
  if (/account\/logon/i.test(res.url || '')) throw new Error('session expired — logon pe redirect');
  const token = (html.match(/name="__RequestVerificationToken"[^>]*value="([^"]*)"/) || [])[1];
  return { token, html };
}

// MAIN: qualifying listings pe viewing request (shadow ya live).
// listings = scored, store se. store.update = callback(listing_id, patch) status likhne ko.
export async function processViewings(listings, jar, updateStatus) {
  const v = config.viewing;
  const result = { built: 0, sent: 0, drafted: 0, skipped: 0, capped: 0, mode: v.mode };

  if (v.autopilot !== 'on') {
    console.log('  🛑 autopilot OFF — koi viewing request nahi.');
    return result;
  }

  // Gate: score + status
  const eligible = listings
    .filter((l) => l.score >= v.minScore)
    .filter((l) => (l.viewing_status || 'new') !== 'requested')
    .sort((a, b) => b.score - a.score);

  let budget = v.dailyCap - (await sentToday());
  if (budget <= 0) {
    console.log(`  ⏸️  daily cap (${v.dailyCap}) reached — aaj aur nahi.`);
    result.capped = eligible.length;
    return result;
  }

  for (const l of eligible) {
    if (budget <= 0) {
      result.capped++;
      continue;
    }

    // Idempotency: pehle status 'requested' likho (crash pe bhi double na jaye)
    // — sirf LIVE mode me. Shadow me status 'draft' rahega taake baad me asli bhej sakein.
    let token;
    try {
      const r = await fetchToken(l, jar);
      token = r.token;
    } catch (err) {
      console.log(`    ⚠️  ${l.listing_id}: token/session fail — ${err.message}`);
      result.skipped++;
      continue;
    }
    if (!token) {
      console.log(`    ⚠️  ${l.listing_id}: token nahi mila, skip`);
      result.skipped++;
      continue;
    }

    const req = buildRequest(l, token);
    result.built++;

    if (v.mode === 'shadow') {
      // 🟡 SHADOW: bhejo MAT. Draft likho + log + status 'draft'.
      await writeDraft({ ...req.preview, url: req.url, built_at: new Date().toISOString() });
      await logAttempt({ mode: 'shadow', listing_id: l.listing_id, score: l.score, address: req.preview.address });
      if (updateStatus) await updateStatus(l.listing_id, { viewing_status: 'draft' });
      console.log(`    📝 DRAFT [${l.score}] ${req.preview.address} — "${req.preview.message.slice(0, 60)}..."`);
      result.drafted++;
      budget--;
      continue;
    }

    // 🔴 LIVE: idempotent send. Status pehle 'requested' + exact message store, phir POST.
    if (updateStatus)
      await updateStatus(l.listing_id, {
        viewing_status: 'requested',
        requested_at: new Date().toISOString(),
        sent_message: req.preview.message, // exact message jo landlord ko gaya
      });
    try {
      const res = await authFetch(req.url, jar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: req.url },
        body: req.body,
        redirect: 'manual',
      });

      // ⚠️ ASLI SUCCESS DETECTION (200 pe andha bharosa nahi):
      // OpenRent success pe 302 redirect deta hai (POST-redirect-GET).
      // 200 = wahi form page wapas = request accept NAHI hui (validation/gate).
      let ok = res.status === 302 || res.status === 303;
      let reason = `status ${res.status}`;
      if (res.status === 200) {
        // 200 aaya — body dekho: gate ya validation error to fail
        const body = await res.text();
        if (/Verify Number/i.test(body)) {
          ok = false;
          reason = '200 but Verify-Number gate — request NOT sent';
        } else if (/field-validation-error|is required/i.test(body)) {
          ok = false;
          reason = '200 but validation error';
        } else if (/request has been sent|viewing request sent|message sent|thank/i.test(body)) {
          ok = true;
          reason = '200 with success marker';
        } else {
          ok = false; // ambiguous 200 = treat as NOT sent (safe)
          reason = '200 ambiguous — treating as NOT sent';
        }
      }

      await logAttempt({ mode: 'live', listing_id: l.listing_id, score: l.score, status: res.status, ok, reason, address: req.preview.address });
      if (ok) {
        console.log(`    ✅ SENT [${l.score}] ${req.preview.address} (${reason})`);
        result.sent++;
      } else {
        console.log(`    ❌ ${l.listing_id}: NOT sent — ${reason}`);
        // status wapas 'new' taake gate/verify hone pe dobara try ho (send_failed dead-end nahi)
        if (updateStatus) await updateStatus(l.listing_id, { viewing_status: 'new', last_fail: reason });
      }
    } catch (err) {
      console.log(`    ❌ ${l.listing_id}: send error ${err.message}`);
      if (updateStatus) await updateStatus(l.listing_id, { viewing_status: 'send_failed' });
    }
    budget--;
  }

  return result;
}
