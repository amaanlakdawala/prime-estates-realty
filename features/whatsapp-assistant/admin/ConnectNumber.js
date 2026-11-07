'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { connectNumber, disconnectNumber } from '../actions';

// Platform admin: link (or unlink) the firm's WhatsApp Business number.
export default function ConnectNumber({ connected }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const act = (fn) => {
    setError('');
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  };

  if (connected) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="btn-outline py-1.5 text-sm" disabled={pending} onClick={() => act(disconnectNumber)}>Disconnect number</button>
        {error && <p className="text-red-700" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); act(() => connectNumber(data)); }} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="field-label">Phone number ID</span>
        <input name="phone_number_id" className="field" inputMode="numeric" required placeholder="1234567890123456" />
        <span className="mt-1 block text-sm text-muted">Meta → WhatsApp Manager → the number → API setup.</span>
      </label>
      <label className="block">
        <span className="field-label">Number as shown to clients</span>
        <input name="display_number" className="field" placeholder="+91 98200 12345" />
      </label>
      <label className="block sm:col-span-2">
        <span className="field-label">Access token <span className="font-normal text-muted">(optional)</span></span>
        <input name="access_token" type="password" className="field" autoComplete="off" />
        <span className="mt-1 block text-sm text-muted">Only if this number is in the firm&apos;s own Meta business. Empty = your platform token (WHATSAPP_ACCESS_TOKEN). Stored on the server only.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Connecting…' : 'Connect number'}</button>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </form>
  );
}
