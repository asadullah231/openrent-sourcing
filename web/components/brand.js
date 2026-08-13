// Social Housing — official brand (13 Aug brand directive).
// Mark = navy house badge + white house + 4-pane window + do indigo stripes
// jo lower-left se andar aati hain. Ye approved artwork ka SVG recreation
// hai (reference image raster tha) — redesign NAHI, wahi identity.
//
// Rang FIXED hain (logo ke apne): navy #232A3D, indigo #4B4DED — theme accent
// se alag. Dark mode me navy hissa --brand-navy variable se ujla ho jata hai
// (globals.css) warna dark background pe ghayab ho jata.

export const BRAND_INDIGO = '#4B4DED';

export function BrandMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      {/* badge — house outline, bottom-right corner cut (hexagon feel) */}
      <path fill="var(--brand-navy, #232A3D)" d="M64 6 L114 42 V100 L100 112 H14 V42 Z" />
      {/* inner house — base khula (white surface tak) */}
      <path fill="var(--surface, #ffffff)" d="M64 26 L92 46 V112 H36 V46 Z" />
      {/* 4-pane window */}
      <g fill="var(--brand-navy, #232A3D)">
        <rect x="53" y="58" width="9" height="9" />
        <rect x="66" y="58" width="9" height="9" />
        <rect x="53" y="71" width="9" height="9" />
        <rect x="66" y="71" width="9" height="9" />
      </g>
      {/* indigo stripes — lower-left se upar-right, surface-rang ki gap ke sath */}
      <g fill={BRAND_INDIGO} stroke="var(--surface, #ffffff)" strokeWidth="5">
        <path d="M1.7 83 L63.7 54 L68.3 64 L6.3 93 Z" />
        <path d="M7.7 101 L55.7 79 L60.3 89 L12.3 111 Z" />
      </g>
    </svg>
  );
}

/**
 * Horizontal logo: [mark] SOCIAL HOUSING — "Social" navy/paper, "Housing"
 * brand indigo (approved horizontal variant). Sidebar + auth screens.
 */
export function BrandLogo({ markSize = 28 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <BrandMark size={markSize} />
      <span
        style={{
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        <span style={{ color: 'var(--paper)' }}>Social </span>
        <span style={{ color: BRAND_INDIGO }}>Housing</span>
      </span>
    </span>
  );
}
