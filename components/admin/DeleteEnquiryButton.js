'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';
import { createClient } from '@/lib/supabase/client';

export default function DeleteEnquiryButton({ id }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    const { error } = await createClient().from('enquiries').delete().eq('id', id);
    setBusy(false);
    if (error) return alert(`The enquiry could not be deleted: ${error.message}`);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-outline py-2 text-red-700" onClick={() => setOpen(true)}>Delete</button>
      <ConfirmDialog open={open} busy={busy} title="Delete this enquiry?" message="The lead's details will be removed permanently." confirmLabel="Delete enquiry" onConfirm={onConfirm} onCancel={() => setOpen(false)} />
    </>
  );
}
