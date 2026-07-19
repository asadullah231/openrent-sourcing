import { getSent } from '@/lib/data';
import { ListingGallery } from '@/components/listing-gallery';

export const dynamic = 'force-dynamic';

export default async function SentPage() {
  const sent = await getSent();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>Requested</h1>
        <span className="text-muted font-mono" style={{ fontSize: 12 }}>{sent.length} viewing request{sent.length !== 1 ? 's' : ''} sent</span>
      </div>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 26, fontSize: 13 }}>
        Viewing requests already sent from your account. The landlord has these.
      </p>

      {sent.length > 0 ? (
        <ListingGallery listings={sent} sent />
      ) : (
        <div className="text-muted" style={{ padding: 48, textAlign: 'center', fontSize: 13, border: '1px solid var(--mist-line)', borderRadius: 12 }}>
          No requests sent yet. When the bot sends one (live mode), it shows here.
        </div>
      )}
    </div>
  );
}
