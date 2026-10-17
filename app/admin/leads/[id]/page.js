import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanName, scoreReasons } from '@/lib/leads';
import { formatDateTime } from '@/lib/format';
import { StatusBadge } from '@/components/admin/leads/LeadsTable';
import LeadOutreach from '@/components/admin/leads/LeadOutreach';
import LeadStatusForm from '@/components/admin/leads/LeadStatusForm';
import LeadNotes from '@/components/admin/leads/LeadNotes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lead' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVITY_LABELS = { note: 'Note', call: 'Call', whatsapp: 'WhatsApp', status: 'Status', demo: 'Demo site' };

export default async function LeadPage({ params }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');
  if (!UUID.test(id)) notFound();

  const db = createAdminClient();
  const [{ data: lead }, { data: activities }, { data: template }] = await Promise.all([
    db.from('leads').select('*').eq('id', id).maybeSingle(),
    db.from('lead_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(100),
    db.from('outreach_template').select('body').eq('id', 1).maybeSingle(),
  ]);
  if (!lead) notFound();
  const { data: demoFirm } = lead.demo_firm_id
    ? await db.from('firms').select('id, slug, demo_content').eq('id', lead.demo_firm_id).maybeSingle()
    : { data: null };

  const reasons = scoreReasons(lead);
  const details = [
    ['Phone', lead.phone || 'Not listed on Google'],
    ['Website', lead.website ? <a key="w" href={lead.website} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">{lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : <span key="w" className="font-semibold text-red-700">None</span>],
    ['Address', lead.address || '—'],
    ['Google rating', lead.rating ? `${lead.rating}★ from ${lead.review_count} reviews` : 'No rating'],
    ['Found in', [lead.locality, lead.city].filter(Boolean).join(', ') || '—'],
    ['Google listing', lead.maps_url ? <a key="m" href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="text-brand underline">Open in Google Maps</a> : '—'],
    ['Google name', <span key="n" className="text-muted">{lead.name}</span>],
    ['Last contacted', lead.last_contacted_at ? formatDateTime(lead.last_contacted_at) : 'Not yet'],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm font-medium text-brand hover:underline">← All leads</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{cleanName(lead.name)}</h1>
          <StatusBadge status={lead.status} />
          <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-semibold">Score {lead.score}/7</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Reach out</h2>
            <div className="mt-4">
              <LeadOutreach lead={lead} template={template?.body ?? ''} demoFirm={demoFirm} />
            </div>
          </section>

          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Notes and history</h2>
            <div className="mt-4"><LeadNotes leadId={lead.id} /></div>
            {activities?.length ? (
              <ol className="mt-5 space-y-3 border-t border-line pt-5">
                {activities.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="text-muted">
                      <span className="font-semibold text-ink">{ACTIVITY_LABELS[a.kind] ?? a.kind}</span> · {formatDateTime(a.created_at)}
                    </p>
                    {a.body && <p className="mt-0.5 whitespace-pre-line">{a.body}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted">Nothing yet. Calls and WhatsApps you start from this page are recorded here.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Status and follow-up</h2>
            <div className="mt-4"><LeadStatusForm lead={lead} demoFirm={demoFirm} /></div>
          </section>

          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Details from Google</h2>
            <dl className="mt-4 divide-y divide-line text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-5 font-display text-base font-semibold">Why this score</h3>
            {reasons.length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {reasons.map(([why, points]) => <li key={why}>+{points} {why}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No signals: has a website, no mobile number, few reviews.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
