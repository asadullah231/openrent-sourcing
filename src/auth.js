// Auth — Mo ke account me login, .ASPXAUTH cookie persist, expiry pe re-login.
// M0 recon: login = GET logon (anti-forgery token + cookies) → POST email+password+token.
// Koi 2FA/captcha nahi. Session cookie .ASPXAUTH.
//
// ⚠️ Ehtiyaat: login Mo ka asli account hai. Bar-bar login = anomaly. Isliye cookie jar
// disk pe persist hoti hai; sirf tab login jab jar khaali/expired ho.

import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JAR_FILE = resolve(__dirname, '../data/session.json');

// Minimal cookie jar (name→value). OpenRent ke liye kaafi.
async function loadJar() {
  if (!existsSync(JAR_FILE)) return {};
  try {
    return JSON.parse(await readFile(JAR_FILE, 'utf-8'));
  } catch {
    return {};
  }
}
async function saveJar(jar) {
  await mkdir(dirname(JAR_FILE), { recursive: true });
  await writeFile(JAR_FILE, JSON.stringify(jar, null, 2));
}

function jarToHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function mergeSetCookie(jar, res) {
  // Node fetch: getSetCookie() available on headers
  const raw = res.headers.getSetCookie?.() || [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return jar;
}

// Authenticated fetch — jar attach, set-cookie merge back.
export async function authFetch(url, jar, opts = {}) {
  const headers = {
    'User-Agent': config.userAgent,
    'Accept-Language': 'en-GB,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml',
    Cookie: jarToHeader(jar),
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers, redirect: opts.redirect || 'manual' });
  mergeSetCookie(jar, res);
  return res;
}

function isLoggedIn(jar) {
  return Boolean(jar['.ASPXAUTH']);
}

// Login flow. Returns jar with .ASPXAUTH set, ya throw.
export async function login() {
  let jar = await loadJar();
  if (isLoggedIn(jar)) {
    // Sanity: home hit karke dekho session zinda hai
    const res = await authFetch(config.base + '/', jar, { redirect: 'follow' });
    const html = await res.text();
    if (/Log ?out|Sign Out/i.test(html)) return jar;
    jar = {}; // expired — dobara login
  }

  const email = process.env.OPENRENT_EMAIL;
  const password = process.env.OPENRENT_PASSWORD;
  if (!email || !password) throw new Error('OPENRENT_EMAIL/PASSWORD .env me nahi');

  // 1) GET logon → token + cookies
  const logonUrl = config.base + '/account/logon';
  const g = await authFetch(logonUrl, jar);
  const gh = await g.text();
  const token = (gh.match(/name="__RequestVerificationToken"[^>]*value="([^"]*)"/) || [])[1];
  if (!token) throw new Error('anti-forgery token logon page pe nahi mila');

  // 2) POST credentials
  const body = new URLSearchParams();
  body.set('Email', email);
  body.set('Password', password);
  body.set('__RequestVerificationToken', token);
  body.set('returnUrl', '/');
  const p = await authFetch(logonUrl, jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: logonUrl },
    body: body.toString(),
  });
  // 302 expected
  await saveJar(jar);
  if (!isLoggedIn(jar)) {
    throw new Error(`login fail — .ASPXAUTH nahi mili (status ${p.status})`);
  }
  return jar;
}

export { loadJar, saveJar, jarToHeader, isLoggedIn };
