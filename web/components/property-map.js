'use client';

import { useEffect, useRef } from 'react';

// Leaflet client pe hi load hota hai (SSR pe window nahi hota).
//
// Pin pe SCORE nahi, RENT likha hai (22 Jul).
// Kyun badla: score ab kisi ko rokta nahi (minScore 0 — har landlord ek lead hai),
// aur jo listings enrich nahi huin un ka score hai hi nahi — pehle wo saare pins
// "?" dikhate thay, jo map ko bekaar kar deta tha. Rent har listing pe hota hai
// aur wahi asal faisla ki cheez hai.
export function PropertyMap({ listings, height = 340, interactive = false, onPick }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      // Clustering — bina iske paas paas ke pins ek dher me chipak jate hain.
      // (Listings ~10km me phaili hain, magar zoom door ho to 200m ke faasle
      // wale pins bhi ek dusre pe chadh jate hain.)
      await import('leaflet.markercluster');
      await import('leaflet.markercluster/dist/MarkerCluster.css');
      if (cancelled || !ref.current) return;

      const pts = listings.filter((l) => l.lat != null && l.lng != null);
      const center = pts.length
        ? [pts.reduce((s, l) => s + l.lat, 0) / pts.length, pts.reduce((s, l) => s + l.lng, 0) / pts.length]
        : [51.5203, -0.0293];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(ref.current, {
        scrollWheelZoom: interactive,
        attributionControl: false,
        zoomControl: interactive,
      }).setView(center, 13);
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Rang = halat, na ke score. Requested wali green, baqi brass.
      const GREEN = '#3fb27f', BRASS = '#e0a94e';
      const money = (p) => (p >= 1000 ? `£${(p / 1000).toFixed(p % 1000 === 0 ? 0 : 1)}k` : `£${p}`);

      // Cluster group — paas paas ke pins ek gol dabbe me mil jate hain,
      // us pe ginti likhi hoti hai. Zoom karo to khul jate hain.
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 46,
        showCoverageOnHover: false,
        spiderfyDistanceMultiplier: 1.6,
        iconCreateFunction: (c) => {
          const n = c.getChildCount();
          const size = n < 10 ? 34 : n < 30 ? 40 : 46;
          return L.divIcon({
            className: '',
            html: `<div style="
                background:#1c1e22;color:#e0a94e;
                width:${size}px;height:${size}px;border-radius:50%;
                display:grid;place-items:center;
                font:600 ${n < 10 ? 13 : 14}px/1 Inter,system-ui,sans-serif;
                border:2px solid #e0a94e;
                box-shadow:0 3px 10px rgba(0,0,0,.6);
              ">${n}</div>`,
            iconSize: [size, size],
          });
        },
      });

      const bounds = [];
      for (const l of pts) {
        const sent = l.viewing_status === 'requested';
        const color = sent ? GREEN : BRASS;
        const text = l.price != null ? money(l.price) : '—';

        // Rent ki chaudai mukhtalif hoti hai, is liye pill (gol dabba) — pehle
        // fixed 30px ka teardrop tha jis me "£2.7k" fit hi nahi hota tha.
        const icon = L.divIcon({
          className: '',
          html: `<div style="
              background:${color};color:#0f1012;
              padding:3px 9px;border-radius:999px;
              font:600 11.5px/1.4 Inter,system-ui,sans-serif;
              white-space:nowrap;
              box-shadow:0 2px 8px rgba(0,0,0,.55);
              border:1.5px solid rgba(0,0,0,.35);
            ">${text}</div>`,
          iconSize: null,
          iconAnchor: [22, 12],
        });
        const m = L.marker([l.lat, l.lng], { icon, riseOnHover: true });
        cluster.addLayer(m);
        m.bindPopup(
          `<div style="font:13px Inter,system-ui,sans-serif;min-width:170px">
             <b style="font-size:14px">£${(l.price ?? 0).toLocaleString('en-GB')}/mo</b>
             ${l.beds != null ? ` · ${l.beds} bed` : ''}
             ${sent ? '<span style="color:#1a7f56"> · requested</span>' : ''}
             <br><span style="color:#555">${l.address || `#${l.listing_id}`}</span><br>
             <a href="/listing/${l.listing_id}" style="color:#0a58ca">View details →</a>
           </div>`
        );
        if (onPick) m.on('click', () => onPick(l));
        bounds.push([l.lat, l.lng]);
      }
      map.addLayer(cluster);
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [listings, interactive, onPick]);

  return (
    <div
      ref={ref}
      style={{
        height,
        width: '100%',
        borderRadius: 'var(--r-tile)',
        overflow: 'hidden',
        border: '1px solid var(--mist-line)',
      }}
    />
  );
}
