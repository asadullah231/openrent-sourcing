import { getPending, getSent } from '@/lib/data';
import { MapExplorer } from '@/components/map-explorer';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const [pending, sent] = await Promise.all([getPending(), getSent()]);
  // Dono ek saath — map ka faida hi ye hai ke saath dikhe kahan bhej chuke hain
  // aur kahan baqi hai. Cards wale pages me ye alag alag hain.
  const all = [...pending, ...sent];

  return <MapExplorer listings={all} />;
}
