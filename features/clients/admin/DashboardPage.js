import Link from 'next/link';
import { requireFirm } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/format';
import { refreshClients } from '../sync';
import { describeRequirement } from '../requirement';
import { STAGES, sourceLabel, stageOf, todayIST } from '../format';
import { firmRow, loadMatches, notSetUp } from './data';
import MatchCard from './MatchCard';

const ACTIVE = ['new', 'contacted', 'site_visit', 'negotiation'];

// The firm's first page: today's numbers, new matches to share, follow-ups due, and the pipeline.
export default async function DashboardPage() {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const firm = await firmRow(ctx.firm.id);
  await refreshClients(firm);
  const db = createAdminClient();
  const today = todayIST();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: clients, error }, { count: enquiries7 }, { count: aiCalls }, { matches, error: mErr }, { count: newMatches }] = await Promise.all([
    db.from('clients').select('id, name, phone, stage, next_follow_up, source, created_at, req_deal, req_type, req_bhk_min, req_bhk_max, req_budget_min, req_budget_max, req_areas')
      .eq('firm_id', firm.id).order('created_at', { ascending: false }).limit(5000),
    db.from('enquiries').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    db.from('calls').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).gte('created_at', monthStart.toISOString()),
    loadMatches(firm.id, (q) => q.eq('status', 'new'), 8),
    db.from('client_matches').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).eq('status', 'new'),
  ]);

  if (notSetUp(error) || notSetUp(mErr)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-3 text-muted">The clients system is being set up. {ctx.isPlatformAdmin ? 'Run supabase/15_clients.sql in Supabase, then reload.' : 'Please check back shortly.'}</p>
      </div>
    );
  }

  const all = clients ?? [];
  const active = all.filter((c) => ACTIVE.includes(c.stage));
  const due = active.filter((c) => c.next_follow_up && c.next_follow_up <= today).sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up));
  const counts = Object.fromEntries(STAGES.map((s) => [s.value, all.filter((c) => c.stage === s.value).length]));
  const tiles = [
    ['New enquiries', enquiries7 ?? 0, 'last 7 days', '/admin/enquiries'],
    ['New matches', newMatches ?? 0, 'to share with clients', '#matches'],
    ['Follow-ups due', due.length, 'today or overdue', '/admin/clients?view=followups'],
    ['Site visits', counts.site_visit, 'clients at this stage', '/admin/clients?stage=site_visit'],
    ['AI calls', aiCalls ?? 0, 'this month', '/admin/calls'],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted">What needs you today. Clients come in from your website, chatbot, WhatsApp, portals and AI calls, and are matched to your listings automatically.</p>
        </div>
        <Link href="/admin/clients" className="btn-outline">All clients</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value, sub, href]) => (
          <Link key={label} href={href} className="rounded-xl border border-line bg-white p-4 hover:border-brand">
            <p className="font-display text-3xl font-semibold">{value}</p>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted">{sub}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STAGES.map((s) => (
            <Link key={s.value} href={`/admin/clients?stage=${s.value}`} className="rounded-lg border border-line bg-white p-3 text-center hover:border-brand">
              <p className="font-display text-2xl font-semibold">{counts[s.value]}</p>
              <p className="text-xs font-semibold text-muted">{s.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section id="matches">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">New matches</h2>
            {(newMatches ?? 0) > matches.length && <Link href="/admin/clients?view=matches" className="text-sm font-medium text-brand underline">See all {newMatches}</Link>}
          </div>
          {!matches.length ? (
            <p className="mt-3 rounded-xl border border-dashed border-line bg-white p-6 text-sm text-muted">
              No new matches. When a listing fits what a client asked for (buy or rent, BHK, budget, area or one nearby), it shows here to share in one tap.
            </p>
          ) : (
            <div className="mt-3 space-y-3">{matches.map((m) => <MatchCard key={m.id} m={m} canCall={firm.ai_calls_enabled} />)}</div>
          )}
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold">Follow-ups due</h2>
            {!due.length ? <p className="mt-3 text-sm text-muted">Nothing due. Set a follow-up date on any client.</p> : (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
                {due.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/clients/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-mist">
                      <span className="min-w-0"><span className="block truncate font-semibold">{c.name || c.phone}</span><span className="block truncate text-muted">{describeRequirement(c)}</span></span>
                      <span className={`shrink-0 text-xs font-semibold ${c.next_follow_up < today ? 'text-red-700' : 'text-brand-dark'}`}>{c.next_follow_up < today ? 'Overdue' : 'Today'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-lg font-semibold">Newest clients</h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
              {all.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/clients/${c.id}`} className="block px-4 py-3 text-sm hover:bg-mist">
                    <span className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{c.name || c.phone}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stageOf(c.stage).tone}`}>{stageOf(c.stage).label}</span></span>
                    <span className="block truncate text-muted">{sourceLabel(c.source)} · {formatDateTime(c.created_at)}</span>
                  </Link>
                </li>
              ))}
              {!all.length && <li className="px-4 py-3 text-sm text-muted">No clients yet. They appear here from your first enquiry or AI call, or add one on the Clients page.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
