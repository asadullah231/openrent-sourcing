import { SearchesManager } from '@/components/searches-manager';
import { SendBatchButton } from '@/components/send-batch-button';

export const dynamic = 'force-dynamic';

// Asad ka qadam #2 (23 Jul): Mo ki saari saved searches ek page pe — add,
// on/off, delete. Home ke search bar se "Save" yahan aa kar jamta hai.
export default function SearchesPage() {
  return (
    <div>
      <h1 style={{ fontSize: 30, margin: '0 0 6px', fontWeight: 600 }}>Searches</h1>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: 24, fontSize: 13, maxWidth: 620, lineHeight: 1.6 }}>
        The bot runs these searches on every batch. Build a search on OpenRent,
        paste its full link here. Add as many as you like. Toggle one off to pause
        it, or ✕ to remove it.
      </p>
      <SearchesManager />

      {/* Asad ka qadam #3: save ke neeche "Send a batch now" — Mo saved
          searches pe foran outreach chala sakta hai, cron ka intezaar kiye
          baghair. */}
      <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid var(--mist-line)', maxWidth: 720 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 4px', fontWeight: 600 }}>Start outreach</h2>
        <p className="text-muted" style={{ marginTop: 0, marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 }}>
          The bot scrapes these searches and sends one batch of requests. The cron
          still runs on its own schedule — this is for running it right now.
        </p>
        <SendBatchButton />
      </div>
    </div>
  );
}
