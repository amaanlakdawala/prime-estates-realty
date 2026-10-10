'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveTemplate } from '@/app/admin/leads/actions';

export default function TemplateEditor({ initial }) {
  const router = useRouter();
  const [body, setBody] = useState(initial);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveTemplate(body);
      setMessage(result?.error ? { error: true, text: result.error } : { text: 'Saved.' });
      if (!result?.error) router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">WhatsApp message</h2>
      <p className="mt-1 text-sm text-muted">
        Used on every lead&apos;s page. These are filled in for each lead: <code className="rounded bg-stone px-1">{'{name}'}</code> (short business name),{' '}
        <code className="rounded bg-stone px-1">{'{firm}'}</code> (same), <code className="rounded bg-stone px-1">{'{city}'}</code> and{' '}
        <code className="rounded bg-stone px-1">{'{demo_link}'}</code> (their demo website, once created).
      </p>
      <textarea className="field mt-4 min-h-[150px]" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending || body === initial}>{pending ? 'Saving…' : 'Save message'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-teal-dark'}`} role="status">{message.text}</p>}
      </div>
    </section>
  );
}
