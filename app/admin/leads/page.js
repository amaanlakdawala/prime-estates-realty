import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { LEAD_STATUSES } from '@/lib/leads';
import LeadFinder from '@/components/admin/leads/LeadFinder';
import LeadsTable from '@/components/admin/leads/LeadsTable';
import TemplateEditor from '@/components/admin/leads/TemplateEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

const MONTHLY_LIMIT = Number(process.env.LEADS_MONTHLY_REQUEST_LIMIT) || 900;

export default async function LeadsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  const db = createAdminClient();
  const month = new Date().toISOString().slice(0, 7);
  const [{ data: leads, error }, { data: template }, { data: usage }] = await Promise.all([
    db.from('leads')
      .select('id, name, phone, phone_intl, website, city, locality, rating, review_count, score, status, next_follow_up, last_contacted_at, created_at')
      .order('score', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(3000),
    db.from('outreach_template').select('body').eq('id', 1).maybeSingle(),
    db.from('places_usage').select('requests').eq('month', month).maybeSingle(),
  ]);

  const all = leads ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, all.filter((l) => l.status === s.value).length]));
  const dueToday = all.filter((l) => l.next_follow_up && l.next_follow_up <= today && !['won', 'lost', 'do_not_contact'].includes(l.status)).length;
  const used = usage?.requests ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-muted">Brokerages found on Google, to pitch your website service to.</p>
        </div>
        <div className="min-w-[220px] text-sm">
          <p className="text-muted">Google searches this month</p>
          <p className="font-semibold">{used} of {MONTHLY_LIMIT}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div className={`h-full ${used / MONTHLY_LIMIT > 0.8 ? 'bg-red-600' : 'bg-teal'}`} style={{ width: `${Math.min(100, (used / MONTHLY_LIMIT) * 100)}%` }} />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <div className="rounded-xl border border-line bg-white p-3">
          <dt className="text-xs text-muted">All leads</dt>
          <dd className="font-display text-2xl font-semibold">{all.length}</dd>
        </div>
        <div className={`rounded-xl border p-3 ${dueToday ? 'border-marigold bg-marigold/15' : 'border-line bg-white'}`}>
          <dt className="text-xs text-muted">Follow-ups due</dt>
          <dd className="font-display text-2xl font-semibold">{dueToday}</dd>
        </div>
        {LEAD_STATUSES.filter((s) => s.value !== 'do_not_contact').map((s) => (
          <div key={s.value} className="rounded-xl border border-line bg-white p-3">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="font-display text-2xl font-semibold">{counts[s.value]}</dd>
          </div>
        ))}
      </dl>

      <LeadFinder used={used} limit={MONTHLY_LIMIT} keyConfigured={Boolean(process.env.GOOGLE_PLACES_API_KEY)} />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">Leads could not be loaded: {error.message}</p>
      ) : (
        <LeadsTable leads={all} today={today} />
      )}

      <TemplateEditor initial={template?.body ?? ''} />
    </div>
  );
}
