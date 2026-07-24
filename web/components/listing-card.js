// Gallery card — Airbnb wale patterrn pe (Asad ne 22 Jul ko wrujel/airbnb-clone
// bhej kar kaha "is terhan ka design").
//
// Purane card se kya badla aur kyun:
//   • Border + background hataya. Airbnb me photo HI card hai; text neeche
//     khula baithta hai. Dabbe hatate hi grid bohot saaf ho jata hai.
//   • Hover pe card upar uthta tha → ab photo andar zoom hoti hai. Wahi un ki
//     signature harkat hai (group-hover:scale-110).
//   • Text ki tarteeb ulti kar di. Airbnb pehle JAGAH batata hai, phir tafseel,
//     phir daam sab se neeche mota. Pehle hamara daam sab se upar tha — wo
//     spreadsheet ki tarteeb hai, listing ki nahi.
//   • Score seal 44px ka gola tha photo pe. Ab chhota text-pill hai neeche.
//     Wajah: minScore 0 ke baad score kisi ko rokta nahi (har landlord ek lead
//     hai), to use photo ki sab se qeemti jagah dena ghalat tha.
// Click → normally apna detail page (/listing/{id}). LEKIN search-preview cards
// (live scrape, abhi store me nahi) ke liye detail page 404 deta hai — un ke liye
// `preview` prop true ho to seedha portal (OpenRent/Rightmove) khulta hai.
// (Asad, 23 Jul: /listing/2978397 pe 404 aaya — wo live result tha, store me nahi.)
import Link from 'next/link';

function timeAgo(hours) {
  if (hours == null) return '';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const d = Math.round(hours / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

export function ListingCard({ l, rank = 1, sent = false, preview = false }) {
  // preview (live search result, store me nahi) → portal URL, warna detail page.
  // url na ho to ek defensive fallback (detail page).
  const isExternal = preview && !!l.url;
  const href = isExternal ? l.url : `/listing/${l.listing_id}`;
  // Airbnb ki pehli line = jagah. Hamare paas address enrich hone ke baad hi
  // aata hai, is liye jo mil jaye: address → area → title → id.
  //
  // Title ka shuru wala hissa ("2 Bed Flat, " / "Room in a Shared Flat, ")
  // har card pe wahi hota hai, aur beds/type to neeche wali line me pehle se
  // likha hai. Wo prefix rakhne se asli pata (Stewart Road) kat jata tha —
  // "Room in a Shared Flat, Stewart Roa…" (screenshot pe pakra, 22 Jul).
  // Prefix hata do, jagah asli naam ko mil jati hai.
  const raw = l.address || l.area || l.title || `#${l.listing_id}`;
  const place = raw.replace(/^(?:\d+\s+)?(?:bed\s+)?(?:room in a |studio |flat |house |maisonette )?[^,]*?(?:flat|house|maisonette|studio|room|apartment)\s*,\s*/i, '');

  const meta = [l.beds != null && `${l.beds} bed`, l.baths != null && `${l.baths} bath`, l.furnishing]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="gcard"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        textDecoration: 'none',
        color: 'var(--paper)',
      }}
    >
      <div className="gcard-photo">
        {l.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" loading="lazy" />
        ) : (
          <div
            className="text-muted"
            style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 12 }}
          >
            no photo
          </div>
        )}

        {/* Parda sirf tab jab uske upar kuch likha ho, warna photo bewajah gehri lagti hai */}
        {sent && <div style={{ position: 'absolute', inset: 0, background: 'var(--photo-veil)' }} />}

        {/* Airbnb me yahan heart hota hai. Hamare kaam me "pasand" ka koi matlab
            nahi — asli sawal hai REQUEST GAYI YA NAHI. Wahi jagah, wahi wazan. */}
        {sent ? (
          <span
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 999,
              background: 'var(--green)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,.3)',
            }}
          >
            Requested
          </span>
        ) : null}
        {/* Yahan pehle ek khali "○" tha jo kuch nahi kehta tha (screenshot pe
            pakra, 22 Jul). "Requested nahi hai" ki khabar khamoshi se milti
            hai — jis pe green pill nahi, wo pending hai. Ek aur badge sirf
            shor tha. */}
      </div>

      {/* info — Airbnb tarteeb: jagah → tafseel → daam */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {place}
          </span>
          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 11.5, flexShrink: 0 }}>
            {sent && l.requested_at ? new Date(l.requested_at).toLocaleDateString('en-GB') : timeAgo(l.hours_live)}
          </span>
        </div>

        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
          {meta || '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
          <span className="font-mono" style={{ fontSize: 15, fontWeight: 600 }}>
            £{Number(l.price ?? 0).toLocaleString('en-GB')}
          </span>
          <span className="text-muted" style={{ fontSize: 13 }}>month</span>

          {/* score ab yahan — mojood hai to dikhta hai, warna jagah nahi ghairta */}
          {l.score != null && (
            <span
              className="font-mono text-muted"
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--surface-2)',
                border: '1px solid var(--mist-line)',
              }}
              title={`Score ${l.score}`}
            >
              {l.score}
            </span>
          )}
        </div>

        {/* Contact — jo bot ne grab kiya (Mo, 23 Jul: "phone ho to number bhi").
            Sirf tab dikhta hai jab agent/phone mila ho. Phone tap-to-call. */}
        {(l.agent_name || l.agent_phone) && (
          <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
            {l.agent_name && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.agent_name}
              </span>
            )}
            {l.agent_phone && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${l.agent_phone.replace(/\s+/g, '')}`; }}
                className="font-mono"
                style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--brass)', cursor: 'pointer' }}
                title="Call"
              >
                {l.agent_phone}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
