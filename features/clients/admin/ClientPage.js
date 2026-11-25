import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireFirm, isUuid } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime, whatsappLink } from '@/lib/format';
import { describeRequirement } from '../requirement';
import { sourceLabel, stageOf, waNumber } from '../format';
import { runMatching } from '../sync';
import { firmRow, loadMatches } from './data';
import { NoteForm, RequirementForm, StageControl } from './ClientForms';
import MatchCard from './MatchCard';

const KIND = { enquiry: 'Enquiry', call: 'AI call', stage: 'Stage', note: 'Note', share: 'Shared', follow_up: 'Follow-up' };

// One client: contact, stage and follow-up, requirement, matching listings, history.
export default async function ClientPage({ params }) {
  const { id } = await params;
  const ctx = await requireFirm();
  if (!ctx) return null;
  if (!isUuid(id)) notFound();
  const firm = await firmRow(ctx.firm.id);
  const db = createAdminClient();
  const { data: client } = await db.from('clients').select('*').eq('id', id).eq('firm_id', firm.id).maybeSingle();
  if (!client) notFound();
  await runMatching(firm, { clientId: client.id }).catch(() => null);

  const [{ matches }, { data: history }] = await Promise.all([
    loadMatches(firm.id, (q) => q.eq('client_id', client.id).neq('status', 'dismissed'), 30),
    db.from('client_activities').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(100),
  ]);
  const stage = stageOf(client.stage);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm font-medium text-brand hover:underline">← All clients</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{client.name || client.phone}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stage.tone}`}>{stage.label}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{client.phone} · came from {sourceLabel(client.source)} · since {formatDateTime(client.created_at)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${client.phone}`} className="btn-outline py-2">Call</a>
          <a href={whatsappLink(waNumber(client.phone), `Namaste${client.name ? ` ${client.name.split(' ')[0]} ji` : ''}, ${firm.name} se.`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp py-2">WhatsApp</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Matching listings <span className="text-base font-normal text-muted">({matches.length})</span></h2>
            <p className="mt-1 text-sm text-muted">Wants: {describeRequirement(client)}</p>
            {!matches.length ? <p className="mt-4 text-sm text-muted">No listing fits yet. New listings are checked against this requirement automatically.</p>
              : <div className="mt-4 space-y-3">{matches.map((m) => <MatchCard key={m.id} m={m} show="listing" canCall={firm.ai_calls_enabled} />)}</div>}
          </section>
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Requirement</h2>
            <div className="mt-4"><RequirementForm client={client} /></div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Stage and follow-up</h2>
            <div className="mt-4"><StageControl clientId={client.id} stage={client.stage} followUp={client.next_follow_up} /></div>
          </section>
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Notes and history</h2>
            <div className="mt-4"><NoteForm clientId={client.id} /></div>
            <ol className="mt-5 space-y-3 border-t border-line pt-5">
              {(history ?? []).map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-muted"><span className="font-semibold text-ink">{KIND[a.kind] ?? a.kind}</span> · {formatDateTime(a.created_at)}</p>
                  {a.body && <p className="mt-0.5 whitespace-pre-line">{a.body}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
