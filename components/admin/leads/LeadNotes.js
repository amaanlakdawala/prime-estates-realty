'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addLeadNote } from '@/app/admin/leads/actions';

export default function LeadNotes({ leadId }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function add(e) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      const result = await addLeadNote(leadId, note);
      if (result?.error) return setError(result.error);
      setNote('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={add} className="space-y-2">
      <textarea className="field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Spoke to Deepak, asked to send the demo on Monday" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-outline" disabled={pending || !note.trim()}>{pending ? 'Adding…' : 'Add note'}</button>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </form>
  );
}
