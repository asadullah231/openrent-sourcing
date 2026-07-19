'use client';

import { useEffect, useRef } from 'react';

// Leaflet ko client pe dynamically load (SSR pe window nahi hota).
// Har property ek pin — score ke hisaab se color. Click → detail page.
export function PropertyMap({ listings, height = 340 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !ref.current) return;

      const pts = listings.filter((l) => l.lat != null && l.lng != null);
      const center = pts.length
        ? [pts.reduce((s, l) => s + l.lat, 0) / pts.length, pts.reduce((s, l) => s + l.lng, 0) / pts.length]
        : [51.5203, -0.0293];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: false }).setView(center, 13);
      mapRef.current = map;

      // dark tiles (CartoDB dark) — dashboard theme ke sath
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      const brass = '#c89b4a', dim = '#9c7936', mist = '#5a6473';
      const bounds = [];
      for (const l of pts) {
        const hot = (l.score ?? 0) >= 70;
        const warm = (l.score ?? 0) >= 55;
        const color = hot ? brass : warm ? dim : mist;
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#141b29;width:30px;height:30px;border-radius:50% 50% 50% 2px;transform:rotate(45deg);display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.5);border:1.5px solid rgba(0,0,0,.2)">
                   <span style="transform:rotate(-45deg);font:600 11px Inter,sans-serif">${l.score ?? '?'}</span>
                 </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        const m = L.marker([l.lat, l.lng], { icon }).addTo(map);
        m.bindPopup(
          `<div style="font:13px Inter,sans-serif;min-width:150px">
             <b>£${l.price}/mo</b> · ${l.beds} bed<br>
             <span style="color:#555">${l.address || ''}</span><br>
             <a href="/listing/${l.listing_id}" style="color:#0a58ca">View details →</a>
           </div>`
        );
        bounds.push([l.lat, l.lng]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [listings]);

  return <div ref={ref} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--mist-line)' }} />;
}
