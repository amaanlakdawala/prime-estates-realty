'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { callEnquiry } from '@/app/admin/calls/actions';

// "AI call" on an enquiry: Riya calls the person who sent it. The result appears on the AI calls page.
export default function CallEnquiryButton({ enquiryId }) {
  const [state, setState] = useState(null);
  const [pending, startTransition] = useTransition();

  function call() {
    setState(null);
    startTransition(async () => {
      const result = await callEnquiry(enquiryId);
      setState(result?.error ? { error: result.error } : { ok: true });
    });
  }

  if (state?.ok) return <Link href="/admin/calls" className="btn-outline py-2">Calling… see AI calls</Link>;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className="btn-outline py-2" onClick={call} disabled={pending}>{pending ? 'Starting…' : 'AI call'}</button>
      {state?.error && <span className="max-w-xs text-xs text-red-700">{state.error}</span>}
    </span>
  );
}
