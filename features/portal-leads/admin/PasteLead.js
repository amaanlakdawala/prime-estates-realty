'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { pasteLead } from '../actions';

const RESULT = {
  lead: 'Saved as an enquiry. Riya calls them within a couple of minutes if automatic calling is on.',
  duplicate: 'Already an enquiry from the last 24 hours, so not added again.',
  not_a_lead: 'This doesn\'t look like a lead',
  failed: 'Could not be saved',
};

export default function PasteLead() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function submit(e) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await pasteLead(text);
      if (result.error) return setMessage({ error: true, text: result.error });
      const ok = ['lead', 'duplicate'].includes(result.status);
      setMessage({ error: !ok, text: ok ? RESULT[result.status] : `${RESULT[result.status]}: ${result.note}` });
      if (result.status === 'lead') setText('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="field"
        placeholder={'Paste a lead from 99acres, MagicBricks, Housing.com… e.g.\nName: Rahul Mehta\nMobile: 98200 12345\nInterested in: 2 BHK for rent in Powai, budget 55k'}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !text.trim()}>{pending ? 'Reading…' : 'Add lead'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
