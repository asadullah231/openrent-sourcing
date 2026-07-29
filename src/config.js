// OpenRent Sourcing Bot — config (Mo)
// M0 recon: read side pe koi bot-protection nahi, isliye plain HTTP + human jitter kaafi hai.
//
// ⚠️ Mo sab kuch DASHBOARD (P3) se control karega — areas, filters, template, availability,
// kill switch, mode. Wo values `data/settings.json` me likhi jati hain (dashboard write karega).
// Ye file un par DEFAULTS hai + wo cheezein jo Mo nahi chhuega (cadence, UA, distance origin).

// Settings ab NocoDB me hain (dashboard Vercel pe hai — wahan local file likhi
// nahi ja sakti, aur dono ko EK source chahiye).
//
// `config` sync export hi raha hai (7 files ise sync import karti hain). Isliye
// main.js har run ke SHURU me `await hydrateConfig()` chalata hai — wo NocoDB se
// values laa kar isi object me bhar deta hai. Bina hydrate ke defaults chalte hain.

async function fetchSettings() {
  const BASE = process.env.NOCODB_BASE_URL;
  const TOKEN = process.env.NOCODB_TOKEN;
  const TABLE = process.env.NOCODB_OR_SETTINGS_TABLE_ID;
  if (!BASE || !TOKEN || !TABLE) return {};
  try {
    const res = await fetch(`${BASE}/api/v2/tables/${TABLE}/records?limit=100`, {
      headers: { 'xc-token': TOKEN },
    });
    if (!res.ok) return {};
    const row = ((await res.json()).list || []).find((r) => r.key === 'main');
    return row?.value ? JSON.parse(row.value) : {};
  } catch {
    return {};
  }
}

let s = {};

export const config = {
  // Mo ke monitored areas — 100% dashboard se aati hain (dynamic). Koi hardcoded
  // location default NAHI (Mo, 29 Jul): pehle yahan "Tower Hamlets" tha, jo settings
  // fetch fail hone pe galti se scrape ho jata. Ab default KHAALI — settings na
  // milein to bot kuch scrape na kare (galat location scrape se behtar). Jo bhi
  // location Mo daale (Bexley, Bromley, kuch bhi), wahi chalti hai.
  areas: s.areas ?? [],

  // Buy-box filters (dashboard se editable). priceMin/priceMax = rent range
  // (social-housing: LHA+incentive se max, kabhi min bhi). bedsMin/Max = 2-4 default.
  filters: s.filters ?? { bedsMin: 2, bedsMax: 4, priceMin: null, priceMax: null },

  // "Naya listing" = itne ghante se kam purana (dashboard editable)
  freshWithinHours: s.freshWithinHours ?? 24,

  // Alert tabhi jab score is se upar ho (dashboard editable)
  alertThreshold: s.alertThreshold ?? 55,

  // Alerts email pe (Mo ne 19 Jul confirm kiya). Resend se.
  //
  // ⚠️ Resend abhi TEST MODE me hai (koi verified domain nahi). Us ka matlab:
  //    email SIRF account owner ke pate pe ja sakti hai, aur kahin nahi (403).
  //
  // 🐛 22 Jul: yahan `automatesystem3@gmail.com` likha tha — magar Resend account
  //    ab `asadbahi5033@gmail.com` ka hai. Yani har alert 403 kha kar chup ho jati,
  //    na Asad ko milti na Mo ko. Live test se pakda (dono pate pe 403 aaya).
  //
  //    Mo ko seedha alert bhejne ke liye domain verify karna PARE GA
  //    (resend.com/domains → SPF/DKIM) — phir alertEmail Mo ki email pe
  //    aur alertFrom us domain pe. Car Arbitrage/Omar pe bhi yehi fix lagega.
  alertEmail: 'asadbahi5033@gmail.com', // Resend owner — test mode me sirf yahi chalta hai
  alertFrom: 'OpenRent Bot <onboarding@resend.dev>', // TODO: verified domain pe switch
  errorEmail: 'asadbahi5033@gmail.com', // pipeline toot jaye to

  // Human cadence — M0 me protection zero mila, lekin volume pe reputation na gire.
  cadence: {
    baseIntervalMin: 30, // cron gap; hafta clean chala to 15
    jitterMin: 5, // ±5 min random, robotic-exact timing se bachne ko
    perRequestDelayMs: [2500, 6000], // har HTTP call ke beech random pause
    workingHours: [7, 22], // sirf 7am–10pm scrape (insaani pattern)
  },

  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',

  base: 'https://www.openrent.co.uk',

  // ── M3: Auto viewing request (SAB dashboard se editable) ─────────────
  // Mo dashboard se: mode toggle (shadow/live), kill switch, template edit, availability,
  // cap, minScore — sab settings.json me likhega, bot yahan se parhta hai.
  viewing: {
    mode: s.viewing?.mode ?? 'shadow', // 🔴 'shadow'=bhejo mat · 'live'=asli POST
    autopilot: s.viewing?.autopilot ?? 'on', // kill switch: 'off'=kuch nahi
    minScore: s.viewing?.minScore ?? 65,
    dailyCap: s.viewing?.dailyCap ?? 15,
    // Ek cron run me zyada se zyada itni. Daily cap ke SATH chalta hai:
    // asli hadd dono me se jo pehle lag jaye. Isi se messages din bhar me
    // phailte hain (30 runs/din) bajaye subah ek saath jane ke.
    perRunCap: s.viewing?.perRunCap ?? 3,
    subject: s.viewing?.subject ?? 'Viewing request',
    availabilityText: s.viewing?.availabilityText ?? 'this Saturday afternoon',
    messageTemplate:
      s.viewing?.messageTemplate ??
      "Hi, I'm interested in the property on {place} and would like to arrange a viewing. " +
        "I'm free {availability} and happy to work around what suits you. Thanks.",
  },
};

// Proximity/commute scoring ka reference point (afiodorov ka core idea: kaam/base se nazdeeki).
// Mo apni base/work location dashboard se set karega (NocoDB settings → origin).
// Default: Tower Hamlets centre.
export const originLatLng = { lat: 51.5203, lng: -0.0293 };

/**
 * NocoDB se dashboard-editable values laa kar `config` me bhar do.
 * main.js me har run ke SHURU me ek dafa chalao — warna Mo ki dashboard settings
 * ignore ho jayengi aur bot defaults pe chalta rahega.
 */
export async function hydrateConfig() {
  s = await fetchSettings();
  if (s.areas) config.areas = s.areas;
  if (s.filters) config.filters = s.filters;
  if (s.freshWithinHours != null) config.freshWithinHours = s.freshWithinHours;
  if (s.alertThreshold != null) config.alertThreshold = s.alertThreshold;
  if (s.viewing) config.viewing = { ...config.viewing, ...s.viewing };
  if (s.origin) { originLatLng.lat = s.origin.lat; originLatLng.lng = s.origin.lng; }
  return config;
}
