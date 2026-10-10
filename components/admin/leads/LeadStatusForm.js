'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateLead } from '@/app/admin/leads/actions';
import { LEAD_STATUSES } from '@/lib/leads';

export default function LeadStatusForm({ lead, demoFirm }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [followUp, setFollowUp] = useState(lead.next_follow_up ?? '');
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();
  const changed = status !== lead.status || followUp !== (lead.next_follow_up ?? '');

  // Quick picks for the follow-up date.
  const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  };

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLead(lead.id, { status, nextFollowUp: followUp });
      setMessage(result?.error ? { error: true, text: result.error } : { text: 'Saved.' });
      if (!result?.error) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="field-label">Status</span>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <div>
        <label className="block">
          <span className="field-label">Next follow-up</span>
          <input type="date" className="field" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {[['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]].map(([label, n]) => (
            <button key={label} type="button" onClick={() => setFollowUp(inDays(n))} className="rounded-md border border-line px-2.5 py-1 hover:border-basalt">{label}</button>
          ))}
          {followUp && <button type="button" onClick={() => setFollowUp('')} className="px-1 text-muted underline">Clear</button>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending || !changed}>{pending ? 'Saving…' : 'Save'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-teal-dark'}`} role="status">{message.text}</p>}
      </div>
      {lead.status === 'won' && demoFirm && (
        <p className="rounded-lg border border-teal/30 bg-teal-light p-3 text-sm text-teal-dark">
          Won. To make their site real: open <Link href={`/admin/firms/${demoFirm.id}`} className="font-semibold underline">their firm</Link>,
          {demoFirm.demo_content ? ' untick “Demo firm”, ' : ' '}check their details, and create their login.
        </p>
      )}
      {status === 'do_not_contact' && status !== lead.status && (
        <p className="text-sm text-muted">Saving turns off calls and WhatsApp for this lead.</p>
      )}
    </div>
  );
}
