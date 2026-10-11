import Link from 'next/link';
import { requireFirm } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncFirmCalls, CALLING_HOURS } from '@/lib/voice';
import { formatDateTime } from '@/lib/format';
import AddContactForm from '@/components/admin/calls/AddContactForm';
import ContactImport from '@/components/admin/calls/ContactImport';
import ContactsTable from '@/components/admin/calls/ContactsTable';
import CallResult from '@/components/admin/calls/CallResult';
import AutoCallToggle from '@/components/admin/calls/AutoCallToggle';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI calls' };

export default async function CallsPage() {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const db = createAdminClient();
  const firmId = ctx.firm.id;

  await syncFirmCalls(firmId); // bring any running calls up to date before showing them

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ data: firm }, { data: contacts }, { data: calls }, { count: usedThisMonth }, { data: queue }] = await Promise.all([
    db.from('firms').select('ai_calls_enabled, ai_calls_monthly_limit, voice_agent, ai_auto_call_enquiries').eq('id', firmId).single(),
    db.from('call_contacts').select('*').eq('firm_id', firmId).order('created_at', { ascending: false }).limit(2000),
    db.from('calls').select('*, call_contacts(name, phone)').eq('firm_id', firmId).order('created_at', { ascending: false }).limit(50),
    db.from('calls').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).gte('created_at', monthStart.toISOString()),
    // Automatic calls still waiting, and ones from the last week that didn't go out (placed ones are under Recent calls).
    db.from('call_queue').select('id, created_at, run_after, status, note, call_contacts(name, phone)').eq('firm_id', firmId)
      .neq('status', 'placed').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">AI calls</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Riya, your AI assistant, calls your clients in Hindi, English or Hinglish, understands what they need, offers a site visit,
            and writes up each call here. Add clients one by one or upload a list.
          </p>
        </div>
        <div className="text-sm">
          <p className="text-muted">Calls this month</p>
          <p className="font-display text-2xl font-semibold">{usedThisMonth ?? 0}<span className="text-base text-muted"> / {firm.ai_calls_monthly_limit}</span></p>
        </div>
      </div>

      {!firm.ai_calls_enabled && (
        <p className="rounded-xl border border-marigold bg-marigold/15 p-4 text-sm" role="status">
          AI calling isn&apos;t switched on for this firm yet, so calls can&apos;t be placed. You can still add and upload contacts.{' '}
          {ctx.isPlatformAdmin
            ? <>Switch it on under <Link href={`/admin/firms/${firmId}`} className="font-semibold underline">Firms → this firm</Link>.</>
            : 'Contact us to switch it on.'}
        </p>
      )}
      <p className="text-sm text-muted">
        Calls go out only between {CALLING_HOURS.start} am and {CALLING_HOURS.end - 12} pm. Only call people who asked to be contacted or are your clients.
        Anyone who says they don&apos;t want calls is marked “Do not call” and never called again.
      </p>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <AutoCallToggle enabled={firm.ai_auto_call_enquiries} canCall={firm.ai_calls_enabled} />
        {queue?.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">Automatic calls</h3>
            <ul className="mt-2 divide-y divide-line text-sm">
              {queue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{q.call_contacts?.name || q.call_contacts?.phone || 'Removed contact'}</span>
                    {q.call_contacts?.name && <span className="text-muted"> · {q.call_contacts.phone}</span>}
                  </span>
                  <span className="text-muted">
                    {q.status === 'pending' || q.status === 'processing'
                      ? `Scheduled for ${formatDateTime(q.run_after)}`
                      : `${q.status === 'failed' ? 'Failed' : 'Not called'}: ${q.note || 'no reason recorded'}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Add a client</h2>
          <div className="mt-4"><AddContactForm /></div>
        </section>
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Upload a list</h2>
          <div className="mt-4"><ContactImport /></div>
        </section>
      </div>

      <ContactsTable contacts={contacts ?? []} canCall={firm.ai_calls_enabled} />

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Recent calls</h2>
        {!calls?.length ? (
          <p className="mt-3 text-sm text-muted">No calls yet. Results appear here a minute or two after each call ends.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {calls.map((c) => (
              <li key={c.id} className="py-4">
                <CallResult call={c} when={formatDateTime(c.created_at)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
