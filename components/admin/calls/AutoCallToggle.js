'use client';

import { useState, useTransition } from 'react';
import { setAutoCallEnquiries } from '@/app/admin/calls/actions';

// The firm's switch for Riya calling every new website enquiry automatically.
export default function AutoCallToggle({ enabled, canCall }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setError('');
    startTransition(async () => {
      const result = await setAutoCallEnquiries(next);
      if (result?.error) setError(result.error);
      else setOn(next);
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold">Call new website enquiries automatically</h2>
        <p className="mt-1 text-sm text-muted">
          When someone sends an enquiry from your website, Riya calls them back within a couple of minutes.
          Enquiries that arrive at night are called after 9 am. Each number is called automatically at most once a day,
          and calls that couldn&apos;t go out within a day are dropped.
        </p>
        {!canCall && on && <p className="mt-2 text-sm text-red-700">AI calling is switched off for this firm, so no automatic calls will go out.</p>}
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${on ? 'bg-teal' : 'bg-line'} disabled:opacity-60`}
      >
        <span className="sr-only">Call new website enquiries automatically</span>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
