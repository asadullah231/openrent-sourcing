'use client';

import { useEffect, useRef, useState } from 'react';

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

  // Tiles aur pin ke rang sirf ek baar bante hain, is liye theme badalne pe
  // map ko poora dobara banana parta hai. MutationObserver <html data-theme>
  // ko dekhta hai — toggle dabate hi ye state badalti hai aur neeche wala
  // effect (jis ke deps me theme hai) map ko naye rangon ke saath re-build
  // kar deta hai. Iske baghair toggle ke baad map purane rangon pe atka rehta.
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.getAttribute('data-theme') || 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

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

      // Theme yahan parhna parta hai, CSS se nahi ho sakta — tile ka URL aur
      // cluster ka HTML dono JS me bante hain. Light mode me dark tiles laga
      // dena sab se bhaddi galti hoti (safed page pe kaala chauras dhabba).
      const isLight = theme === 'light';
      const tileUrl = isLight
        ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      const clusterBg = isLight ? '#ffffff' : '#1c1e22';
      const clusterFg = isLight ? '#a8720f' : '#e0a94e';

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

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Rang = halat, na ke score. Requested wali green, baqi brass.
      // Light mode me dono gehre — halke rang safed naqshe pe doob jate hain.
      const GREEN = isLight ? '#1a7f56' : '#3fb27f';
      const BRASS = isLight ? '#a8720f' : '#e0a94e';
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
                background:${clusterBg};color:${clusterFg};
                width:${size}px;height:${size}px;border-radius:50%;
                display:grid;place-items:center;
                font:600 ${n < 10 ? 13 : 14}px/1 Inter,system-ui,sans-serif;
                border:2px solid ${clusterFg};
                box-shadow:0 3px 10px rgba(0,0,0,${isLight ? '.22' : '.6'});
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
          // Light mode me pin ke rang gehre hain → text safed. Dark mode me
          // rang chamakdar hain → text kaala. Ulta karo to pin parhi hi na jaye.
          html: `<div style="
              background:${color};color:${isLight ? '#fff' : '#0f1012'};
              padding:3px 9px;border-radius:999px;
              font:600 11.5px/1.4 Inter,system-ui,sans-serif;
              white-space:nowrap;
              box-shadow:0 2px 8px rgba(0,0,0,${isLight ? '.3' : '.55'});
              border:1.5px solid rgba(0,0,0,${isLight ? '.15' : '.35'});
            ">${text}</div>`,
          iconSize: null,
          iconAnchor: [22, 12],
        });
        const m = L.marker([l.lat, l.lng], { icon, riseOnHover: true });
        cluster.addLayer(m);
        // Rang CSS variables se — Leaflet ka popup ab dono themes me theek hai
        // (neeche globals.css me .leaflet-popup-content-wrapper theme-aware hai).
        m.bindPopup(
          `<div style="font:13px Inter,system-ui,sans-serif;min-width:170px">
             <b style="font-size:14px">£${(l.price ?? 0).toLocaleString('en-GB')}/mo</b>
             ${l.beds != null ? ` · ${l.beds} bed` : ''}
             ${sent ? '<span style="color:var(--green)"> · requested</span>' : ''}
             <br><span style="color:var(--mist)">${l.address || `#${l.listing_id}`}</span><br>
             <a href="/listing/${l.listing_id}" style="color:var(--accent)">View details →</a>
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
  }, [listings, interactive, onPick, theme]);

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
