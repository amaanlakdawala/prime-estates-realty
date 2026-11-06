import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AFTER_CALL_TEMPLATE, GROUP_TEMPLATE, isUnknownName, whatsappNumber } from '@/lib/leads';
import SendQueue from '@/components/admin/leads/SendQueue';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send queue' };

// Midnight today in Indian time, as an ISO timestamp (the server itself may run in UTC).
function startOfTodayIST() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new Date(`${today}T00:00:00+05:30`).toISOString();
}

// Leads who told Riya on a call in the last two weeks that WhatsApp is fine, or booked a demo, and have had
// no WhatsApp since: they come first, with the follow-up she promised.
async function afterCallLeads(db) {
  const { data: calls } = await db.from('sales_calls')
    .select('created_at, result, lead:leads(id, name, phone, phone_intl, website, city, locality, rating, review_count, score, address, status, firms(slug))')
    .eq('status', 'done')
    .or('result->>whatsapp_ok.eq.true,result->>demo_time.not.is.null')
    .gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString())
    .order('created_at', { ascending: false });
  const latest = new Map();
  for (const c of calls ?? []) {
    if (c.lead && !latest.has(c.lead.id) && c.lead.status !== 'do_not_contact' && whatsappNumber(c.lead.phone_intl)) latest.set(c.lead.id, c);
  }
  if (!latest.size) return [];
  const { data: sent } = await db.from('lead_activities').select('lead_id, created_at').eq('kind', 'whatsapp').in('lead_id', [...latest.keys()]);
  return [...latest.values()]
    .filter((c) => !(sent ?? []).some((s) => s.lead_id === c.lead.id && s.created_at > c.created_at))
    .map(({ result, lead: { firms, status, ...l } }) => ({
      ...l, demoSlug: firms?.slug ?? null, template: AFTER_CALL_TEMPLATE, afterCall: true, demoTime: result.demo_time ?? null,
    }));
}

export default async function SendQueuePage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  const db = createAdminClient();
  const [{ data: leads }, { data: template }, { count: sentToday }] = await Promise.all([
    db.from('leads')
      .select('id, name, phone, phone_intl, website, city, locality, rating, review_count, score, address, firms(slug)')
      .eq('status', 'new')
      .order('score', { ascending: false })
      .order('review_count', { ascending: false })
      // Ties need a fixed order: saving a lead (its demo site) moves its row in the database, and the
      // queue then jumped to a different lead after the page refreshed.
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1000),
    db.from('outreach_template').select('body').eq('id', 1).maybeSingle(),
    db.from('lead_activities').select('id', { count: 'exact', head: true }).eq('kind', 'whatsapp').gte('created_at', startOfTodayIST()),
  ]);

  // Only leads you can actually WhatsApp (an Indian mobile number). Brokers from the group, known only by
  // their number, get a message of their own.
  const fresh = (leads ?? [])
    .filter((l) => whatsappNumber(l.phone_intl))
    .map(({ firms, ...l }) => ({ ...l, demoSlug: firms?.slug ?? null, template: isUnknownName(l.name) ? GROUP_TEMPLATE : null }));
  const afterCall = await afterCallLeads(db);
  const queue = [...afterCall, ...fresh.filter((l) => !afterCall.some((a) => a.id === l.id))];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm font-medium text-brand hover:underline">← All leads</Link>
        <h1 className="mt-2 text-3xl font-semibold">Send queue</h1>
        <p className="mt-1 max-w-2xl text-muted">
          New leads with a WhatsApp number, best prospects first, after anyone who told Riya on a call that WhatsApp is fine.
          You press Send in WhatsApp yourself. Sending one at a time, with a daily limit, keeps your number safe from WhatsApp&apos;s spam filters.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Send from <span className="font-semibold text-ink">80975 46742</span>: Riya tells people the WhatsApp comes from that number.
          On a computer, link it once in WhatsApp Web (WhatsApp on your phone → Linked devices).
        </p>
      </div>
      <SendQueue leads={queue} template={template?.body ?? ''} sentToday={sentToday ?? 0} />
    </div>
  );
}
