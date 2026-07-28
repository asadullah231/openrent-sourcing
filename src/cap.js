// Daily-cap single source of truth (bot side).
//
// MASLA (AUDIT #1 — sabse urgent, Mo ka account risk):
//   Cap do jagah count hota tha — bot (viewing.js sentToday) aur dashboard
//   (api/listings/action) — dono log table ke `kind='sent'` rows ginte thay.
//   Lekin do masle:
//     1. Bot ka run shuru me count padhta, budget local var me — ek doosri
//        overlapping run (n8n misfire ya manual+cron) wahi count padh kar
//        alag budget bana leti → dono milke cap paar kar dete.
//     2. Reserve nahi tha: count aur asli send ke beech waqt lagta (token fetch
//        + 45-90s human delay). Us window me doosra caller wahi purana count
//        dekh kar aur bhej deta.
//   OpenRent pe cap paar = Mo ke asli account pe zyada request = ban ka khatra
//   (undo nahi hota).
//
// HAL — reserve-before-send (optimistic slot):
//   • Send se PEHLE ek `kind='reserve'` row NocoDB me daalo (aaj ki date pe).
//   • Cap count = aaj ke `sent` (live) + `reserve` rows. Dono callers YEHI
//     helper use karte hain → ek hi source, koi drift nahi.
//   • Reserve ban jane ke baad hi asli POST hota. Kaamyab → reserve rehta
//     (ya sent me badal jata). Nakaam/skip → reserve rollback (hata do), taake
//     slot zaya na ho.
//   • Reserve daalne se PEHLE dobara count padhte hain (read-just-before-write):
//     window chhoti ho jati hai. NocoDB pe sacha lock nahi, par ye window ab
//     count→token→delay→send (seconds-to-minutes) se ghat kar count→insert
//     (ek round-trip) reh jati hai — practically race khatam.

const NC = {
  base: () => process.env.NOCODB_BASE_URL,
  token: () => process.env.NOCODB_TOKEN,
  table: () => process.env.NOCODB_OR_LOG_TABLE_ID,
};
const H = () => ({ 'xc-token': NC.token(), 'Content-Type': 'application/json' });

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Aaj ke saare log rows (sent + reserve), ek dafa fetch. */
async function todayRows() {
  const res = await fetch(`${NC.base()}/api/v2/tables/${NC.table()}/records?limit=1000&sort=-CreatedAt`, { headers: H() });
  if (!res.ok) return [];
  const rows = (await res.json()).list || [];
  const today = todayKey();
  return rows.filter((e) => e.day === today);
}

/**
 * Aaj kitne slot ISTEMAL ho chuke (cap ke against).
 * = live sends + abhi ke reserves. Shadow/draft NAHI ginte.
 */
export async function usedToday() {
  const rows = await todayRows();
  return rows.filter(
    (e) => (e.kind === 'sent' && e.mode === 'live') || e.kind === 'reserve'
  ).length;
}

/** Aaj kitne slot bache (cap - used), 0 se neeche nahi. */
export async function remainingToday(dailyCap) {
  return Math.max(0, dailyCap - (await usedToday()));
}

/**
 * Ek slot RESERVE karo (send se pehle). Cap bacha ho to reserve row daal kar
 * uska Id lauta do; warna null (cap full — bhejo mat).
 *
 * read-just-before-write: yahin dobara count padhte hain, phir insert — race window
 * sab se chhoti.
 */
export async function reserveSlot(dailyCap, meta = {}) {
  if ((await usedToday()) >= dailyCap) return null; // cap full
  const row = {
    kind: 'reserve',
    day: todayKey(),
    reserved_at: new Date().toISOString(),
    ...meta, // listing_id, score, address
  };
  try {
    const res = await fetch(`${NC.base()}/api/v2/tables/${NC.table()}/records`, {
      method: 'POST', headers: H(), body: JSON.stringify([row]),
    });
    if (!res.ok) return null;
    const created = await res.json();
    // NocoDB POST array → array; single → object. Id nikaalo.
    const rec = Array.isArray(created) ? created[0] : created;
    return rec?.Id ?? true; // Id mila to rollback ho sakega; warna bhi reserve hua
  } catch {
    return null;
  }
}

/** Reserve rollback — send skip/fail hua, slot wapas do. Id chahiye. */
export async function releaseSlot(reserveId) {
  if (!reserveId || reserveId === true) return; // Id hi nahi to kuch na karo
  try {
    await fetch(`${NC.base()}/api/v2/tables/${NC.table()}/records`, {
      method: 'DELETE', headers: H(), body: JSON.stringify([{ Id: reserveId }]),
    });
  } catch {}
}
