// Diag: kaunsa OpenRent URL format ids deta (proxy ke sath VPS pe).
import 'dotenv/config';
import { fetchWithRetry } from './scraper.js';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120';
const tests = [
  ['slug=bexley-greater-london term="Bexley, Greater London"', 'https://www.openrent.co.uk/properties-to-rent/bexley-greater-london?term=Bexley%2C%20Greater%20London&isLive=true'],
  ['slug=bexley term=Bexley', 'https://www.openrent.co.uk/properties-to-rent/bexley?term=Bexley&isLive=true'],
  ['slug=properties-to-rent term="Bexley, Greater London"', 'https://www.openrent.co.uk/properties-to-rent/london?term=Bexley%2C%20Greater%20London&isLive=true'],
];
for (const [label, url] of tests) {
  try {
    const r = await fetchWithRetry(url, { headers: { 'User-Agent': UA, 'Accept-Language':'en-GB', Accept:'text/html' } });
    const html = await r.text();
    const m = html.match(/PROPERTYIDS\s*=\s*\[([\s\S]*?)\]/);
    const n = m ? m[1].split(',').filter(x=>x.trim()).length : 0;
    console.log(`HTTP ${r.status} | ids=${n} | ${label}`);
  } catch (e) { console.log(`FAIL ${e.message} | ${label}`); }
}
