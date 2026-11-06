'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { findLeadOwner } from '@/app/admin/leads/actions';

// On a lead's page: search the web for the person who runs the firm (again).
export default function FindOwnerButton({ leadId, searched }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);

  function find() {
    setMessage(null);
    startTransition(async () => {
      const result = await findLeadOwner(leadId);
      if (result.error) setMessage({ error: true, text: result.error });
      else if (result.skipped) setMessage({ text: 'No firm name to search for yet.' });
      else if (!result.owner) setMessage({ text: 'Not found: no source clearly names who runs this firm.' });
      router.refresh();
    });
  }

  return (
    <span className="block">
      <button type="button" onClick={find} disabled={pending} className="text-sm font-medium text-brand underline disabled:opacity-50">
        {pending ? 'Searching the web…' : searched ? 'Search again' : 'Find owner'}
      </button>
      {message && <span className={`mt-1 block text-sm ${message.error ? 'text-red-700' : 'text-muted'}`} role="status">{message.text}</span>}
    </span>
  );
}
