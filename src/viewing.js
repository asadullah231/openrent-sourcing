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

import { config } from './config.js';
import { authFetch } from './auth.js';
import { usedToday, reserveSlot, releaseSlot } from './cap.js';

// Drafts aur send-log dono NocoDB ki EK table me hain, `kind` se alag:
// kind='draft' (banaya gaya) · kind='sent' (bhejne ki koshish hui).
// Pehle ye do .jsonl files thin — dashboard Vercel pe hai jahan likha nahi ja sakta.
const NC = {
  base: () => process.env.NOCODB_BASE_URL,
  token: () => process.env.NOCODB_TOKEN,
  table: () => process.env.NOCODB_OR_LOG_TABLE_ID,
};
const H = () => ({ 'xc-token': NC.token(), 'Content-Type': 'application/json' });

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Shared room / HMO pehchano — poore flat se farq karne ke liye.
//
// Kyun: OpenRent shared flat ka `beds` POORE flat ka deta hai. "Room in a Shared
// Flat, Stewart Road, E15" ka beds=3 hai magar kiraye pe sirf EK kamra hai (£750).
// Beds filter (2-4) ise paas kar deta hai, aur sasta rent price-fit score bhi upar
// le jata hai. Mo poora flat dhoondh raha hai, is liye ye viewing gate pe rukta hai.
//
// Jaan boojh kar sirf saaf-saaf pattern: "room in a shared", "shared flat/house",
// "double/single room". "Studio" ya "1 bed" yahan NAHI — wo poori property hoti hai
// aur beds filter unhein waise bhi sambhal leta hai. Zyada aggressive filter theek
// listings maar deta.
const SHARED_RE = /\b(room in a shared|shared (flat|house|accommodation)|double room|single room|room to rent|houseshare|house share|hmo)\b/i;

export function isSharedRoom(l) {
  return SHARED_RE.test(`${l.title || ''} ${l.address || ''}`);
}

async function addRow(row) {
  await fetch(`${NC.base()}/api/v2/tables/${NC.table()}/records`, {
    method: 'POST', headers: H(), body: JSON.stringify([row]),
  }).catch(() => {});
}

// (sentToday cap.js me chala gaya — ab reserve-aware usedToday() istemal hota hai.)

async function logAttempt(entry) {
  await addRow({ ...entry, day: todayKey(), kind: 'sent' });
}

async function writeDraft(entry) {
  await addRow({ ...entry, kind: 'draft' });
}

// fillTemplate + shortPlace ab shared module me (message-template.js) — dashboard
// bhi wahi use karta hai, koi drift nahi. Re-export taake purane imports na tootein.
export { fillTemplate, shortPlace } from './message-template.js';
import { fillTemplate, shortPlace } from './message-template.js';

function buildRequest(listing, token) {
  const v = config.viewing;
  const place = shortPlace(listing);
  const message = fillTemplate(v.messageTemplate, listing, v);
  const body = new URLSearchParams();
  // ⚠️ RequestViewing=true hi rehta hai, chahe message ab viewing ka nahi balke
  //    guaranteed-rent offer ka hai (22 Jul, Mo ka naya template).
  //
  //    Kyun nahi badla: M0 recon me mila tha ke plain "Send Message" mode me OpenRent
  //    message se PHONE/EMAIL hata deta hai ("personal details remove"). Mo ke naye
  //    message ka poora maqsad hi number exchange karna hai (apna number neeche hai
  //    aur landlord ka number maang raha hai) — us mode me wo hissa kat sakta hai.
  //    RequestViewing wala raasta test-shuda hai (302 mila tha, 19 Jul).
  //
  //    ⚠️ PEHLI LIVE SEND PE KHUD CHECK KARO: landlord tak number pahuncha ya kat gaya?
  //    (Mo ke inbox me copy jati hai — SendCopyToTenant=true). Agar kat raha ho to
  //    RequestViewing=false try karo aur dono ka farq dekho.
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

  // QUEUED (Mo ne dashboard se select kiya "Send outreach") — ye priority pe jati
  // hain aur score-gate BYPASS karti hain (Mo ne khud chuni, bharosa uska). Sirf
  // 'requested' (ja chuki) skip. In ko normal se pehle bhejo.
  const isQueued = (l) => (l.viewing_status || 'new') === 'queued';

  // Gate: score + status + property ki qism.
  // queued ke liye score-gate nahi (Mo ka manual pick). Baqi ke liye minScore.
  const eligible = listings
    .filter((l) => isQueued(l) || l.score >= v.minScore)
    .filter((l) => (l.viewing_status || 'new') !== 'requested' && (l.viewing_status || 'new') !== 'hidden')
    .filter((l) => {
      // ⚠️ Shared room ≠ poora flat. OpenRent shared flat ka `beds` POORE flat ka
      // deta hai (3 bed), jabke kiraye pe sirf ek kamra hai — is liye beds filter
      // (2-4) inhe paas kar deta hai aur sasta rent score bhi upar le jata hai.
      // Mo ko poora flat chahiye, room nahi. (22 Jul: £750 "Room in a Shared Flat"
      // Stewart Rd E15 score 65 pe minScore paar kar gaya tha — asli request jane
      // wali thi.)
      if (!isSharedRoom(l)) return true;
      console.log(`    ⏭️  skip [${l.score}] ${l.listing_id} — shared room hai, poora flat nahi`);
      result.skipped++;
      return false;
    })
    // queued (Mo ke manual picks) pehle, phir score-desc. Taake "Send outreach"
    // wali listings us run me sab se pehle jayein, cap khatam hone se pehle.
    .sort((a, b) => (isQueued(b) - isQueued(a)) || (b.score - a.score));

  // Cap ab reserve-aware hai (cap.js) — live sends + abhi ke reserves dono ginta.
  // Isse do overlapping run / manual+cron ek doosre ke reserves dekh lete hain,
  // aur cap kabhi paar nahi hota (AUDIT #1).
  let budget = v.dailyCap - (await usedToday());
  if (budget <= 0) {
    console.log(`  ⏸️  daily cap (${v.dailyCap}) reached — aaj aur nahi.`);
    result.capped = eligible.length;
    return result;
  }

  // ── PER-RUN CAP — yehi cheez "robot jaisa na lage" ko mumkin banati hai ──
  //
  // Mo ka mutalba: sab ko bhejo, aur aage se jo naya scrape ho usi waqt message
  // chala jaye — magar robot na lage.
  //
  // Bina is ke daily cap akela kaafi nahi: bot subah 7 baje ki pehli run me poora
  // din ka cap (misal 12) ek saath phenk deta, phir 15 ghante khamosh. Wo insaani
  // nahi lagta — asli aadmi din bhar me thoda thoda karta hai.
  //
  // Per-run cap se har cron run (har 30 min) me sirf chand jate hain, to messages
  // poore din me qudrati tor pe phail jate hain. Yehi wo "drip" hai jo Mo chahta hai.
  //
  // Backlog isi tarah khud ba khud khatam hota hai: 30 runs/din × perRunCap, jab tak
  // daily cap na bhar jaye. Alag "backlog mode" ki zaroorat nahi.
  const perRun = v.perRunCap ?? 3;
  if (budget > perRun) budget = perRun;

  let sentInThisRun = 0;

  for (const l of eligible) {
    if (budget <= 0) {
      result.capped++;
      continue;
    }

    // ⏱️ Insaani wafqa do sends ke darmiyan (22 Jul, cap 1 -> 12 karte waqt add hua).
    //
    // Kyun zaroori hai: cap 1 pe loop me kabhi do send hote hi nahi thay, is liye ye
    // kabhi masla nahi bana. Cap 12 pe bina delay ke 12 messages taqreeban EK SECOND
    // me chale jate — ek hi account se, ek hi minute me. OpenRent ko ye saaf bot
    // dikhta hai, aur Mo ka account ban ho sakta hai (jo undo nahi hota).
    //
    // 45-90 second random. 12 requests ~ 10-18 minute me phailti hain.
    if (sentInThisRun > 0 && v.mode === 'live') {
      const waitMs = 45_000 + Math.floor(Math.random() * 45_000);
      console.log(`    ⏱️  ${Math.round(waitMs / 1000)}s ruk raha hoon (insaani cadence)...`);
      await new Promise((r) => setTimeout(r, waitMs));
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

    // 🔴 LIVE: pehle SLOT RESERVE karo (cap.js) — POST se theek pehle, taake
    // koi doosri run/manual send is slot ko na le. Reserve fail (cap full is
    // exact lamhe) → is listing ko skip, aur baaki bhi cap-full hain.
    const reserveId = await reserveSlot(v.dailyCap, {
      listing_id: l.listing_id, score: l.score, address: req.preview.address,
    });
    if (!reserveId) {
      console.log(`    ⏸️  ${l.listing_id}: cap full (reserve nahi mila) — ruk gaya.`);
      result.capped += eligible.length - result.built + 1; // baqi bhi cap-blocked
      break;
    }

    // Idempotent send. Status pehle 'requested' + exact message store, phir POST.
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
          // Asli error text bhi nikaalo — warna "validation error" se pata nahi chalta
          // ke KAUNSA field toota. (22 Jul: Chagford House pe ye aaya aur wajah
          // maloom karne ka koi zariya nahi tha.)
          const msgs = [
            ...body.matchAll(/(?:field-validation-error|validation-summary-errors)[^>]*>\s*([^<]{3,120})/gi),
          ]
            .map((m) => m[1].trim())
            .filter(Boolean)
            .slice(0, 3);
          reason = msgs.length
            ? `200 validation error: ${msgs.join(' | ')}`
            : '200 but validation error (text nahi mila)';
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
        // Reserve rehne do — cap ke against ye request ginni chahiye (asli send ho gaya).
      } else {
        console.log(`    ❌ ${l.listing_id}: NOT sent — ${reason}`);
        // Request gaya hi nahi → slot zaya na karo, reserve wapas.
        await releaseSlot(reserveId);
        // status wapas 'new' taake gate/verify hone pe dobara try ho (send_failed dead-end nahi)
        if (updateStatus) await updateStatus(l.listing_id, { viewing_status: 'new', last_fail: reason });
      }
    } catch (err) {
      console.log(`    ❌ ${l.listing_id}: send error ${err.message}`);
      // Send exception — request pahuncha ya nahi pata nahi. SAFE side: reserve
      // wapas MAT do (agar pahunch gaya to double-count se bachao). status
      // send_failed rehta; agli run isko dobara nahi bhejti (requested nahi hai
      // par send_failed bhi 'new'/'queued' nahi, eligible filter se bahar).
    }
    budget--;
    // Koshish ho gayi (kaamyab ho ya na ho) — agli se pehle wafqa lena hai.
    // Nakaam koshish bhi OpenRent ke liye ek request hai, is liye yahan gina jata hai.
    sentInThisRun++;
  }

  return result;
}
