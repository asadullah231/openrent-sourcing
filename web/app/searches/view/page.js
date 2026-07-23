'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SearchResults } from '@/components/search-results';

// Ek saved search ka result page (Asad, 23 Jul): Outreach ki "Active searches"
// list se kisi search pe click karo → yahan uske saare result gallery me.
//
// URL: /searches/view?u=<encoded pastedUrl>. Search ka link query me aata hai,
// koi DB lookup nahi — sab kuch client pe /api/search se aata hai.
//
// useSearchParams ko Suspense me lapetna zaroori hai (Next 15), warna build
// warning deta hai.
function ViewInner() {
  const params = useSearchParams();
  const url = params.get('u');
  const name = params.get('n');

  return (
    <div>
      <Link
        href="/outreach"
        className="text-muted"
        style={{ fontSize: 12.5, textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}
      >
        ← Back to Outreach
      </Link>

      <h1 style={{ fontSize: 28, margin: '0 0 4px', fontWeight: 600 }}>{name || 'Search results'}</h1>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 22, fontSize: 12.5 }}>
        The bot is running outreach on this search. These are its current listings.
      </p>

      {url ? (
        <SearchResults url={url} />
      ) : (
        <div className="text-muted" style={{ fontSize: 13 }}>
          No search link. Go back and open a search from the list.
        </div>
      )}
    </div>
  );
}

export default function SearchViewPage() {
  return (
    <Suspense fallback={<div className="text-muted">Loading…</div>}>
      <ViewInner />
    </Suspense>
  );
}
