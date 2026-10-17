'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDemoSite, logContact } from '@/app/admin/leads/actions';
import { buildMessage, whatsappNumber } from '@/lib/leads';

// The outreach message with this lead's details filled in, plus WhatsApp, Call and demo-site buttons.
// Each WhatsApp/Call tap is recorded on the lead (and a New lead becomes Contacted).
export default function LeadOutreach({ lead, template, demoFirm }) {
  const router = useRouter();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const blocked = lead.status === 'do_not_contact';
  const wa = whatsappNumber(lead.phone_intl);
  const demoLink = demoFirm && origin ? `${origin}/${demoFirm.slug}` : '';
  const message = buildMessage(template, lead, demoLink);

  function contact(kind) {
    setError('');
    // Open WhatsApp/the dialler straight away (browsers block pop-ups opened after a delay), then record it.
    if (kind === 'whatsapp') window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    else window.location.href = `tel:${lead.phone_intl.replace(/\s/g, '') || lead.phone}`;
    startTransition(async () => {
      const result = await logContact(lead.id, kind);
      if (result?.error) setError(result.error);
      router.refresh();
    });
  }

  function makeDemo() {
    setError('');
    startTransition(async () => {
      const result = await createDemoSite(lead.id);
      if (result?.error) return setError(result.error);
      router.refresh();
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (blocked) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">This lead asked not to be contacted. Calls and WhatsApp are switched off.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-mist/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Demo website</p>
          {demoFirm ? (
            <span className="flex gap-3 text-sm">
              <a href={demoLink || `/${demoFirm.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">Open</a>
              <Link href={`/admin/firms/${demoFirm.id}`} className="font-medium text-brand underline">Edit</Link>
            </span>
          ) : null}
        </div>
        {demoFirm ? (
          <p className="break-all text-sm">{demoLink || `/${demoFirm.slug}`}</p>
        ) : (
          <>
            <p className="text-sm text-muted">Create a sample website with their name, phone and area, and send them the link.</p>
            <button type="button" className="btn-outline mt-3" onClick={makeDemo} disabled={pending}>{pending ? 'Creating…' : 'Create demo website'}</button>
          </>
        )}
      </div>

      <div>
        <p className="field-label">Message</p>
        <p className="whitespace-pre-line rounded-lg border border-line p-3 text-[15px]">{message}</p>
        <p className="mt-1.5 text-sm text-muted">Edit the wording under “WhatsApp message” on the Leads page.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa ? (
          <button type="button" className="btn-whatsapp" onClick={() => contact('whatsapp')}>Send on WhatsApp</button>
        ) : (
          <span className="self-center text-sm text-muted">No mobile number, so no WhatsApp.</span>
        )}
        {(lead.phone_intl || lead.phone) && <button type="button" className="btn-outline" onClick={() => contact('call')}>Call {lead.phone}</button>}
        <button type="button" className="btn-outline" onClick={copy}>{copied ? 'Copied' : 'Copy message'}</button>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
