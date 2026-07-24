// Message template fill — ek hi jagah (single source of truth).
//
// KYUN alag file (23 Jul): pehle bot (viewing.js) aur dashboard (listing detail
// page) ka apna-apna fill-logic tha. Dashboard sirf {place}/{availability} bharta
// tha, is liye Mo ka asli template ({greeting}/{beds}/{area}) preview me RAW
// dikhta tha — "{greeting} I saw your {beds} listed in {area}". Ab dono yahi
// function use karte hain, koi drift nahi.
//
// Koi Node dep nahi — is liye Next (dashboard) me safely import ho jata hai.

export function shortPlace(listing) {
  const a = listing.address || listing.title || '';
  const parts = a.split(',').map((s) => s.trim()).filter(Boolean);
  // Pehla part aksar "X Bed <type>" hota hai — usko chhoro agar 'bed'/'room' ho
  if (parts.length > 1 && /bed|room|studio|flat|house|maisonette/i.test(parts[0])) {
    return parts.slice(1).join(', ');
  }
  return a || `listing ${listing.listing_id}`;
}

// Template ke placeholders bharo.
//
// ⚠️ Maqsad: message me KABHI khali `{beds}` ya `[Name]` na jaye, aur kabhi jhoota
// data na jaye. Har cheez ka safe fallback:
//   - naam na mile  -> "Hi," (koi farzi naam nahi)
//   - beds na milen -> "property" ("undefined-bed" nahi)
//   - area na mile  -> street ya khali
// Global regex (string .replace sirf pehla badalta — dobara aane wala placeholder
// bina bhare reh jata).
export function fillTemplate(tpl, listing, v = {}) {
  const name = listing.landlord_name || null;
  const beds = listing.beds != null ? `${listing.beds}-bed` : 'property';
  const area = listing.area || null;
  const place = shortPlace(listing);

  const vals = {
    greeting: name ? `Hi ${name},` : 'Hi,',
    name: name || 'there',
    beds,
    area: area || place,
    place,
    price: listing.price != null ? `£${Number(listing.price).toLocaleString('en-GB')}` : '',
    availability: v.availabilityText || '',
  };

  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}
