import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { whatsappNumber } from '@/lib/leads';
import SendQueue from '@/components/admin/leads/SendQueue';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send queue' };

// Midnight today in Indian time, as an ISO timestamp (the server itself may run in UTC).
function startOfTodayIST() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return new Date(`${today}T00:00:00+05:30`).toISOString();
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
      .limit(1000),
    db.from('outreach_template').select('body').eq('id', 1).maybeSingle(),
    db.from('lead_activities').select('id', { count: 'exact', head: true }).eq('kind', 'whatsapp').gte('created_at', startOfTodayIST()),
  ]);

  // Only leads you can actually WhatsApp (an Indian mobile number).
  const queue = (leads ?? [])
    .filter((l) => whatsappNumber(l.phone_intl))
    .map(({ firms, ...l }) => ({ ...l, demoSlug: firms?.slug ?? null }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm font-medium text-teal hover:underline">← All leads</Link>
        <h1 className="mt-2 text-3xl font-semibold">Send queue</h1>
        <p className="mt-1 max-w-2xl text-muted">
          New leads with a WhatsApp number, best prospects first. You press Send in WhatsApp yourself. Sending one at a time,
          with a daily limit, keeps your number safe from WhatsApp&apos;s spam filters.
        </p>
      </div>
      <SendQueue leads={queue} template={template?.body ?? ''} sentToday={sentToday ?? 0} />
    </div>
  );
}
