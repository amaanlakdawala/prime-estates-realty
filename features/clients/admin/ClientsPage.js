import Link from 'next/link';
import { requireFirm } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/format';
import { refreshClients } from '../sync';
import { describeRequirement } from '../requirement';
import { STAGES, sourceLabel, stageOf, todayIST } from '../format';
import { firmRow, loadMatches, notSetUp } from './data';
import { AddClientForm } from './ClientForms';
import MatchCard from './MatchCard';

const ACTIVE = ['new', 'contacted', 'site_visit', 'negotiation'];

// Clients: the pipeline as tabs (all, each stage, follow-ups due, matches), search by name, number or area.
export default async function ClientsPage({ searchParams }) {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const { stage = '', view = '', q = '' } = (await searchParams) ?? {};
  const firm = await firmRow(ctx.firm.id);
  await refreshClients(firm);
  const db = createAdminClient();

  const [{ data: clients, error }, { data: matchRows }] = await Promise.all([
    db.from('clients').select('*').eq('firm_id', firm.id).order('last_activity_at', { ascending: false }).limit(5000),
    db.from('client_matches').select('client_id, status').eq('firm_id', firm.id).in('status', ['new', 'shared', 'interested']).limit(20000),
  ]);
  if (notSetUp(error)) {
    return <p className="text-muted">The clients system is being set up. {ctx.isPlatformAdmin ? 'Run supabase/15_clients.sql in Supabase, then reload.' : 'Please check back shortly.'}</p>;
  }

  const all = clients ?? [];
  const today = todayIST();
  const matchCount = new Map();
  for (const m of matchRows ?? []) matchCount.set(m.client_id, (matchCount.get(m.client_id) ?? 0) + 1);
  const due = all.filter((c) => ACTIVE.includes(c.stage) && c.next_follow_up && c.next_follow_up <= today);
  const needle = q.trim().toLowerCase();
  let shown = view === 'followups' ? due : stage ? all.filter((c) => c.stage === stage) : all;
  if (needle) shown = shown.filter((c) => `${c.name} ${c.phone} ${(c.req_areas ?? []).join(' ')} ${c.req_notes}`.toLowerCase().includes(needle));
  const { matches } = view === 'matches' ? await loadMatches(firm.id, (mq) => mq.in('status', ['new', 'shared', 'interested']), 100) : { matches: [] };

  const tab = (href, label, count, on) => (
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-mist'} border border-line`}>
      {label} <span className={on ? 'text-white/70' : 'text-muted'}>{count}</span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Clients</h1>
          <p className="mt-1 max-w-2xl text-muted">Everyone who enquired or spoke to Riya, with what they want and where they are in the deal. Matching listings are found automatically.</p>
        </div>
        <AddClientForm />
      </div>

      <div className="flex flex-wrap gap-2">
        {tab('/admin/clients', 'All', all.length, !stage && !view)}
        {STAGES.map((s) => tab(`/admin/clients?stage=${s.value}`, s.label, all.filter((c) => c.stage === s.value).length, stage === s.value))}
        {tab('/admin/clients?view=followups', 'Follow-ups due', due.length, view === 'followups')}
        {tab('/admin/clients?view=matches', 'Matches', matchRows?.length ?? 0, view === 'matches')}
      </div>

      {view === 'matches' ? (
        matches.length ? <div className="grid gap-3 lg:grid-cols-2">{matches.map((m) => <MatchCard key={m.id} m={m} canCall={firm.ai_calls_enabled} />)}</div>
          : <p className="text-sm text-muted">No open matches.</p>
      ) : (
        <>
          <form className="max-w-md"><input type="search" name="q" defaultValue={q} placeholder="Search name, number or area" className="field" />
            {stage && <input type="hidden" name="stage" value={stage} />}{view && <input type="hidden" name="view" value={view} />}</form>
          {!shown.length ? (
            <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center text-muted">No clients here yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-line bg-mist text-muted">
                  <tr>{['Client', 'Wants', 'Stage', 'Follow-up', 'Matches', 'Last activity'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.slice(0, 500).map((c) => (
                    <tr key={c.id} className="align-top hover:bg-mist/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/clients/${c.id}`} className="font-semibold text-brand hover:underline">{c.name || c.phone}</Link>
                        <span className="block text-xs text-muted">{c.phone} · {sourceLabel(c.source)}</span>
                      </td>
                      <td className="max-w-[18rem] px-4 py-3">{describeRequirement(c)}</td>
                      <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${stageOf(c.stage).tone}`}>{stageOf(c.stage).label}</span></td>
                      <td className={`whitespace-nowrap px-4 py-3 ${c.next_follow_up && c.next_follow_up <= today && ACTIVE.includes(c.stage) ? 'font-semibold text-red-700' : ''}`}>{c.next_follow_up ?? '—'}</td>
                      <td className="px-4 py-3">{matchCount.get(c.id) ? <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold">{matchCount.get(c.id)}</span> : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(c.last_activity_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
