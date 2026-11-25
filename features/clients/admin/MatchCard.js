'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { callAboutMatch, setMatchStatus, shareMatch } from '../actions';

const STATUS = { new: ['New match', 'bg-accent/20'], shared: ['Shared', 'bg-brand-light text-brand-dark'], interested: ['Interested', 'bg-green-100 text-green-800'], not_interested: ['Not interested', 'bg-mist text-muted'] };

// One client ↔ listing match with its actions. show: 'both' (dashboard), 'listing' (client page), 'client' (listing page).
// m: { id, score, reasons, status, client: { id, name, phone, req }, listing: { id, title, locality, price, photo } }
export default function MatchCard({ m, show = 'both', canCall = false }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  const act = (fn, done) => {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setMessage({ error: true, text: result.error });
      else { done?.(result); router.refresh(); }
    });
  };
  // Open WhatsApp straight from the click (a window opened after an await is often blocked), then fill in the link.
  const share = () => {
    const win = window.open('about:blank', '_blank');
    act(() => shareMatch(m.id), (r) => { if (win) win.location.href = r.url; else window.location.href = r.url; });
  };
  const [label, tone] = STATUS[m.status] ?? STATUS.new;

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        {show !== 'client' && (
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-mist">
            {m.listing.photo && <img src={m.listing.photo} alt="" className="h-full w-full object-cover" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
            <span className="text-xs font-semibold text-muted">{m.score}% fit</span>
          </div>
          {show !== 'listing' && (
            <p className="mt-1 font-semibold">
              <Link href={`/admin/clients/${m.client.id}`} className="hover:underline">{m.client.name || m.client.phone}</Link>
              <span className="font-normal text-muted"> wants {m.client.req}</span>
            </p>
          )}
          {show !== 'client' && (
            <p className={show === 'both' ? 'text-sm' : 'mt-1 font-semibold'}>
              {show === 'both' && <span className="text-muted">→ </span>}
              <Link href={`/admin/${m.listing.id}/edit`} className="hover:underline">{m.listing.title}</Link>
              <span className="text-muted"> · {m.listing.locality} · {m.listing.price}</span>
            </p>
          )}
          {m.reasons?.length > 0 && <p className="mt-1 text-sm text-muted">{m.reasons.join(' · ')}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={share} disabled={pending} className="btn-whatsapp py-1.5 text-sm">WhatsApp</button>
        {canCall && <button type="button" onClick={() => act(() => callAboutMatch(m.id), () => setMessage({ text: 'Riya is calling them now.' }))} disabled={pending} className="btn-outline py-1.5 text-sm">Riya calls</button>}
        {m.status !== 'interested' && <button type="button" onClick={() => act(() => setMatchStatus(m.id, 'interested'))} disabled={pending} className="btn-outline py-1.5 text-sm">Interested</button>}
        <button type="button" onClick={() => act(() => setMatchStatus(m.id, m.status === 'shared' ? 'not_interested' : 'dismissed'))} disabled={pending} className="text-sm font-medium text-muted underline disabled:opacity-50">
          {m.status === 'shared' ? 'Not interested' : 'Dismiss'}
        </button>
        {message && <span className={`text-sm ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</span>}
      </div>
    </div>
  );
}
