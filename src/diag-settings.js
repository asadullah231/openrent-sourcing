// Diagnostic: kya VPS se NocoDB settings fetch hoti hai (proxy ke sath/bina).
import 'dotenv/config';
import { config, hydrateConfig } from './config.js';

const proxied = !!(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
console.log('HTTPS_PROXY set:', proxied);
try {
  await hydrateConfig();
  console.log('hydrate OK — areas:', (config.areas || []).map(a => a.name).join(', ') || 'NONE');
} catch (e) {
  console.log('hydrate threw:', e.message);
}
