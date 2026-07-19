// OpenRent Sourcing Bot — config (Mo)
// M0 recon: read side pe koi bot-protection nahi, isliye plain HTTP + human jitter kaafi hai.
//
// ⚠️ Mo sab kuch DASHBOARD (P3) se control karega — areas, filters, template, availability,
// kill switch, mode. Wo values `data/settings.json` me likhi jati hain (dashboard write karega).
// Ye file un par DEFAULTS hai + wo cheezein jo Mo nahi chhuega (cadence, UA, distance origin).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = resolve(__dirname, '../data/settings.json');

// Dashboard-editable values settings.json se (agar maujood), warna defaults.
function loadSettings() {
  if (!existsSync(SETTINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}
const s = loadSettings();

export const config = {
  // Mo ke monitored areas (dashboard se editable).
  areas: s.areas ?? [{ name: 'Tower Hamlets', slug: 'tower-hamlets', term: 'Tower Hamlets', radiusKm: 3 }],

  // Buy-box filters (dashboard se editable)
  filters: s.filters ?? { bedsMin: 2, bedsMax: 4, priceMax: null },

  // "Naya listing" = itne ghante se kam purana (dashboard editable)
  freshWithinHours: s.freshWithinHours ?? 24,

  // Alert tabhi jab score is se upar ho (dashboard editable)
  alertThreshold: s.alertThreshold ?? 55,

  // Alerts email pe (Mo ne 19 Jul confirm kiya). Resend se.
  // ⚠️ ABHI: Resend test-mode — sirf owner email pe ja sakta hai. Isliye alerts owner pe.
  //    BAAD ME: domain verify karke alertEmail = 'meldeeb0993@gmail.com' + alertFrom Mo ke domain pe.
  alertEmail: 'automatesystem3@gmail.com', // TODO: domain verify ke baad → Mo ki email
  alertFrom: 'OpenRent Bot <onboarding@resend.dev>', // TODO: verified domain pe switch
  errorEmail: 'automatesystem3@gmail.com', // pipeline toot jaye to (same, test-mode ki wajah se)

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
    subject: s.viewing?.subject ?? 'Viewing request',
    availabilityText: s.viewing?.availabilityText ?? 'this Saturday afternoon',
    messageTemplate:
      s.viewing?.messageTemplate ??
      "Hi, I'm interested in the property on {place} and would like to arrange a viewing. " +
        "I'm free {availability} and happy to work around what suits you. Thanks.",
  },
};

// Proximity/commute scoring ka reference point (afiodorov ka core idea: kaam/base se nazdeeki).
// Mo apni base/work location dashboard se set karega (settings.json → origin).
// Default: Tower Hamlets centre.
export const originLatLng = s.origin ?? { lat: 51.5203, lng: -0.0293 };
