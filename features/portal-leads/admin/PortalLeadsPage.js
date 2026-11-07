import Link from 'next/link';
import { requireFirm } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/format';
import { forwardingAddress } from '../inbound';
import PasteLead from './PasteLead';

const STATUS = {
  received: ['Reading…', 'bg-mist text-muted'],
  lead: ['New enquiry', 'bg-brand-light text-brand-dark'],
  duplicate: ['Repeat', 'bg-mist text-muted'],
  not_a_lead: ['Not a lead', 'bg-mist text-muted'],
  failed: ['Failed', 'bg-red-50 text-red-800'],
};

// Firm page: where to forward portal lead emails, and what arrived.
export default async function PortalLeadsPage() {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const db = createAdminClient();
  const [{ data: firm }, { data: emails }] = await Promise.all([
    db.from('firms').select('portal_leads_enabled, portal_inbox_key, ai_calls_enabled, ai_auto_call_enquiries').eq('id', ctx.firm.id).single(),
    db.from('portal_emails').select('*').eq('firm_id', ctx.firm.id).order('created_at', { ascending: false }).limit(100),
  ]);

  if (!firm?.portal_leads_enabled) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold">Portal leads</h1>
        <p className="mt-3 text-muted">
          Leads from 99acres, MagicBricks, Housing.com and other portals, called back by Riya within a minute. This service isn&apos;t switched on for your firm.{' '}
          {ctx.isPlatformAdmin ? <Link href={`/admin/firms/${ctx.firm.id}`} className="font-semibold text-brand underline">Switch it on under Firms → this firm.</Link> : 'Contact us to switch it on.'}
        </p>
      </div>
    );
  }

  const address = forwardingAddress(firm.portal_inbox_key);
  const autoCalls = firm.ai_calls_enabled && firm.ai_auto_call_enquiries;
  const gmailConfirm = emails?.find((e) => e.status === 'not_a_lead' && e.note.includes('https://mail'));
  const leads = (emails ?? []).filter((e) => e.status === 'lead').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Portal leads</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Forward the lead emails you get from 99acres, MagicBricks, Housing.com, NoBroker and other portals to your address below.
          Each lead becomes an enquiry and Riya calls them back within a minute, while they are still on the portal comparing brokers.
        </p>
      </div>

      {!autoCalls && (
        <p className="rounded-xl border border-accent bg-accent/15 p-4 text-sm" role="status">
          Leads are saved as enquiries, but Riya won&apos;t call them until automatic calling is on.{' '}
          <Link href="/admin/calls" className="font-semibold underline">Switch it on under AI calls.</Link>
        </p>
      )}
      {gmailConfirm && (
        <p className="rounded-xl border border-accent bg-accent/15 p-4 text-sm" role="status">
          Gmail is waiting for you to confirm forwarding to this address.{' '}
          <a href={gmailConfirm.note.match(/https:\/\/\S+/)[0]} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Open Gmail&apos;s confirmation link</a>
          , then go back to step 2 below.
        </p>
      )}

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Your forwarding address</h2>
        {address ? (
          <>
            <p className="mt-3 break-all rounded-lg bg-mist p-3 font-mono text-sm">{address}</p>
            <p className="mt-2 text-sm text-muted">Keep it private: anything sent to it becomes an enquiry.</p>
            <h3 className="mt-5 font-semibold">Set it up in Gmail (5 minutes, once)</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
              <li>Gmail on a computer → <span className="font-medium">Settings (gear) → See all settings → Forwarding and POP/IMAP → Add a forwarding address</span>, paste the address above. Gmail sends a confirmation email: its link appears at the top of this page within a minute. Open it.</li>
              <li>Search Gmail for <span className="font-mono">from:(99acres.com OR magicbricks.com OR housing.com OR nobroker.in OR squareyards.com)</span>, then click <span className="font-medium">Show search options → Create filter → Forward it to</span> your address.</li>
              <li>Done. Your lead emails still arrive in your inbox as before; a copy comes here.</li>
            </ol>
            <p className="mt-3 text-sm text-muted">Using Outlook or another email? Add a rule that forwards emails from these portals to the same address.</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Your forwarding address is being set up. Meanwhile, paste leads below.</p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Paste a lead</h2>
        <p className="mt-1 text-sm text-muted">For a lead that came by SMS or WhatsApp, or one you want called right now.</p>
        <div className="mt-4"><PasteLead /></div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Received</h2>
          <p className="text-sm text-muted">{leads} new enquir{leads === 1 ? 'y' : 'ies'} in the last {emails?.length ?? 0} emails</p>
        </div>
        {!emails?.length ? (
          <p className="mt-3 text-sm text-muted">Nothing yet. Forwarded lead emails appear here within a minute.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {emails.map((e) => {
              const [label, tone] = STATUS[e.status] ?? STATUS.received;
              return (
                <li key={e.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                    {e.portal && <span className="font-medium">{e.portal}</span>}
                    <span className="text-muted">{formatDateTime(e.created_at)}</span>
                  </div>
                  <p className="mt-1">{e.status === 'not_a_lead' && e.note.includes('https://mail') ? 'Gmail forwarding confirmation' : e.note || e.subject || '—'}</p>
                  {e.subject && e.status !== 'lead' && <p className="text-muted">{e.subject}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
