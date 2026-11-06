'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAutoSettings } from '../actions';

const STATUSES = [
  { value: 'contacted', label: 'Contacted: WhatsApp sent, no reply yet' },
  { value: 'new', label: 'New: never contacted' },
  { value: 'interested', label: 'Interested: follow-up call' },
  { value: 'demo_sent', label: 'Demo sent: follow-up call' },
];

// The automatic calling switch on Leads → AI sales calls.
export default function AutoCallSettings({ settings }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [statuses, setStatuses] = useState(settings.statuses);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  const toggle = (value) => setStatuses((s) => (s.includes(value) ? s.filter((x) => x !== value) : [...s, value]));

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveAutoSettings({ enabled, statuses });
      setMessage(result.error ? { error: true, text: result.error } : { text: enabled ? 'Saved. Riya calls the next lead within 10 minutes (in calling hours).' : 'Saved. Automatic calling is off.' });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
        <span>
          <span className="block font-medium">Call leads automatically</span>
          <span className="text-sm text-muted">Every 10 minutes in calling hours, Riya calls the next lead from the list below, one call at a time.</span>
        </span>
      </label>
      <fieldset>
        <legend className="field-label">Which leads</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUSES.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={statuses.includes(s.value)} onChange={() => toggle(s.value)} className="h-4 w-4 accent-brand" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? 'Saving…' : 'Save'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</p>}
      </div>
    </div>
  );
}
