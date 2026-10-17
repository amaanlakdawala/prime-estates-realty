import { formatPrice } from '@/lib/format';

const STATUS = {
  queued: ['Starting', 'bg-mist'],
  in_progress: ['In progress', 'bg-accent/40'],
  done: ['Completed', 'bg-brand-light text-brand-dark'],
  no_answer: ['No answer', 'bg-ink/10 text-muted'],
  failed: ['Failed', 'bg-red-100 text-red-800'],
};

// What the agent learned on the call, as short labelled facts.
function facts(r) {
  if (!r) return [];
  return [
    r.do_not_call && ['Asked not to be called', true],
    r.interested === true && ['Interested', true],
    r.interested === false && ['Not interested', true],
    r.deal && ['Looking to', r.deal],
    r.area && ['Area', r.area],
    r.project && ['Project', r.project],
    r.bhk && ['Size', `${r.bhk} BHK`],
    r.budget_rupees && ['Budget', formatPrice(r.budget_rupees, r.deal === 'rent' ? 'rent' : 'buy')],
    r.timeline && ['Timeline', r.timeline],
    r.site_visit && ['Site visit', r.site_visit],
    r.callback_time && ['Call back', r.callback_time],
  ].filter(Boolean);
}

export default function CallResult({ call, when }) {
  const [label, style] = STATUS[call.status] ?? [call.status, 'bg-mist'];
  const who = call.call_contacts?.name || call.call_contacts?.phone || 'Deleted contact';
  const list = facts(call.result);
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-semibold">{who}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{label}</span>
        <p className="text-muted">{when}{call.duration_secs ? ` · ${Math.floor(call.duration_secs / 60)}m ${call.duration_secs % 60}s` : ''}</p>
      </div>
      {list.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {list.map(([k, v]) => (
            <li key={k} className={`rounded-md px-2 py-1 ${k === 'Asked not to be called' ? 'bg-red-50 text-red-800' : 'bg-mist'}`}>
              {v === true ? k : <><span className="text-muted">{k}:</span> {v}</>}
            </li>
          ))}
        </ul>
      )}
      {call.summary && <p className="mt-2 text-ink/80">{call.summary}</p>}
      {call.error && <p className="mt-2 text-red-700">{call.error}</p>}
      {call.transcript?.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-medium text-brand">Read the conversation</summary>
          <ol className="mt-2 space-y-1.5 rounded-lg bg-mist p-3">
            {call.transcript.map((t, i) => (
              <li key={i}><span className="font-semibold">{t.role === 'agent' ? 'Riya' : 'Client'}:</span> {t.text}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
