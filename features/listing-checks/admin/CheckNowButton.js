'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { checkNow } from '../actions';

export default function CheckNowButton({ listingId }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function check() {
    setMessage(null);
    startTransition(async () => {
      const result = await checkNow(listingId);
      setMessage(result.error ? { error: true, text: result.error } : { text: 'Riya calls the owner within a few minutes.' });
      if (!result.error) router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={check} disabled={pending} className="btn-outline py-1.5 text-sm">{pending ? 'Placing…' : 'Check now'}</button>
      {message && <span className={`max-w-xs text-right text-xs ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</span>}
    </span>
  );
}
