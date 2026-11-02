'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { callLeadWithAI } from '../actions';
import { describeCall } from '../format';
import { formatDateTime } from '@/lib/format';

const STATUS = {
  placing: ['Calling…', 'bg-brand-light text-brand-dark'],
  done: ['Answered', 'bg-green-100 text-green-800'],
  no_answer: ['No answer', 'bg-mist text-muted'],
  failed: ['Failed', 'bg-red-100 text-red-800'],
};

// On a lead's page: "Call with AI" and every AI sales call to this lead, with what Riya learned and the transcript.
// blocker: why the lead can't be called now (from callBlocker on the server), or null.
export default function SalesCallPanel({ leadId, blocker, calls }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);

  function call() {
    setMessage(null);
    startTransition(async () => {
      const result = await callLeadWithAI(leadId);
      setMessage(result.error ? { error: true, text: result.error } : { text: 'Calling now. The result appears here when the call ends (refresh the page).' });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={call} disabled={pending || Boolean(blocker)} className="btn-primary disabled:opacity-50">
          {pending ? 'Placing call…' : 'Call with AI'}
        </button>
        {calls.some((c) => c.status === 'placing') && (
          <button type="button" onClick={() => router.refresh()} className="btn-outline">Refresh</button>
        )}
      </div>
      {blocker && <p className="text-sm text-muted">{blocker}</p>}
      {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</p>}
      <p className="text-xs text-muted">Riya says she is your AI assistant, pitches the website, reels and AI calling, and tries to book a demo with you. If they ask not to be called, the lead is marked Do not contact automatically.</p>

      {calls.length > 0 && (
        <ol className="space-y-3 border-t border-line pt-4">
          {calls.map((c) => {
            const [label, tone] = STATUS[c.status] ?? STATUS.failed;
            return (
              <li key={c.id} className="text-sm">
                <p className="flex flex-wrap items-center gap-2 text-muted">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                  {formatDateTime(c.created_at)}
                </p>
                {c.status !== 'placing' && <p className="mt-1">{describeCall(c)}</p>}
                {c.transcript?.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-brand">Transcript</summary>
                    <div className="mt-2 max-h-80 space-y-1 overflow-y-auto rounded-lg bg-mist p-3">
                      {c.transcript.map((t, i) => (
                        <p key={i}><span className="font-semibold">{t.role === 'agent' ? 'Riya' : 'Them'}:</span> {t.text}</p>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
