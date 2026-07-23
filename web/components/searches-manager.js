'use client';

import { useEffect, useState } from 'react';
import { SearchList } from './search-list';

// `/searches` page ka dimaag (Asad ka qadam #2 + #3, 23 Jul).
//
// Ye SearchList ko settings ke data se joddta hai:
//   - load: /api/settings se saved searches
//   - edit: add / toggle / delete (SearchList onChange se)
//   - save: /api/settings pe wapas (wahi route jo link parse kar ke params bharta hai)
//
// SearchList khud koi save nahi karta — sirf list dikhata hai aur badalta hai.
// Save yahan hai, taake "Save changes" ek jagah rahe.
export function SearchesManager() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setMsg('Settings load nahi huin — refresh karo.'));
  }, []);

  if (!settings) {
    return <div className="text-muted">Loading…</div>;
  }

  const searches = settings.areas || [];
  // Jo abhi save nahi hui (params server bharega) unka pata: pastedUrl hai magar params nahi
  const unsaved = searches.some((s) => s.pastedUrl && !s.params);

  const setSearches = (areas) => {
    setSettings({ ...settings, areas });
    setMsg('');
  };

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        // Server naam/params bhar kar wapas deta hai — wahi dikhao
        try {
          setSettings(await res.json());
        } catch {}
        setMsg('Saved. Bot agli run pe inhe use karega.');
      } else {
        let why = 'Save nahi hui.';
        try {
          const j = await res.json();
          if (j?.error) why = j.error;
        } catch {}
        setMsg(why);
      }
    } catch {
      setMsg('Save nahi hui — dobara koshish karo.');
    }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <SearchList searches={searches} onChange={setSearches} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
        <button onClick={save} disabled={saving} className="btn-brass">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {unsaved && !saving && (
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            Nayi search add ki hai — Save karo taake bot use kare.
          </span>
        )}
        {msg && (
          <span
            style={{
              fontSize: 13,
              color: /nahi|error|load/i.test(msg) ? 'var(--rust)' : 'var(--mist)',
            }}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
