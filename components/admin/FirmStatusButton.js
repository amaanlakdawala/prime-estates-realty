'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';
import { setFirmActive } from '@/app/admin/firms/actions';

// Pause (hide website, block their login) or resume a firm. Nothing is deleted either way.
export default function FirmStatusButton({ firm }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function change(active) {
    setError('');
    startTransition(async () => {
      const result = await setFirmActive(firm.id, active);
      setConfirming(false);
      if (result?.error) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <>
      {firm.active ? (
        <button type="button" className="btn-outline border-red-200 text-red-700 hover:border-red-700" disabled={pending} onClick={() => setConfirming(true)}>Pause firm</button>
      ) : (
        <button type="button" className="btn-primary" disabled={pending} onClick={() => change(true)}>{pending ? 'Resuming…' : 'Resume firm'}</button>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <ConfirmDialog
        open={confirming}
        busy={pending}
        busyLabel="Pausing…"
        title={`Pause ${firm.name}?`}
        message="Their website goes offline and their login stops working. Listings, enquiries and photos are kept, and you can resume any time."
        confirmLabel="Pause firm"
        onConfirm={() => change(false)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
