import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanName, statusLabel } from '@/lib/leads';
import { formatDateTime } from '@/lib/format';
import { MISSED, callOutcome, estimatedCost, minutes } from '../format';
import { RULES } from '../calls';
import { CALL_GROUPS, callGroup, getAutoSettings, nextUp } from '../auto';
import AutoCallSettings from './AutoCallSettings';

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const TONES = { good: 'bg-green-100 text-green-800', bad: 'bg-red-100 text-red-800', neutral: 'bg-mist text-muted' };
const TABLE_ROWS = 200;
const PAGE = 1000; // Supabase returns at most 1,000 rows per request
const indiaDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Every call of the last 30 days, for the totals: about 110 a day with automatic calling, so read in pages.
async function callsSince(db, since) {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await db.from('sales_calls').select('created_at, status, duration_secs, result, error')
      .gte('created_at', since).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

// Leads → AI sales calls: automatic calling, who is called next, and every call Riya made, with 30-day totals.
export default async function SalesCallsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  const db = createAdminClient();
  const settings = await getAutoSettings(db);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [all, { data: calls }, upcoming] = await Promise.all([
    callsSince(db, since),
    db.from('sales_calls')
      .select('id, created_at, status, duration_secs, result, error, lead:leads(id, name, status)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(TABLE_ROWS),
    nextUp(settings, 10, db),
  ]);
  const rows = calls ?? [];
  const answered = all.filter((c) => c.status === 'done');
  const totals = [
    ['Calls placed', all.length],
    ['Answered', answered.length],
    ['Interested', answered.filter((c) => c.result?.interested || c.result?.demo_time).length],
    ['Demos booked', answered.filter((c) => c.result?.demo_time).length],
    ['Minutes', Math.round(answered.reduce((s, c) => s + (c.duration_secs ?? 0), 0) / 60)],
    ['Sarvam cost (est.)', rupees(all.reduce((s, c) => s + estimatedCost(c), 0))],
  ];
  const missed = Object.values(MISSED)
    .map(([label, text]) => [label, all.filter((c) => c.status !== 'done' && c.error === text).length])
    .filter(([, n]) => n);
  // Calls per day for the last 7 days with calls, newest first: "Wed 11 Nov 108 (11 answered)".
  const days = new Map();
  for (const c of all) {
    const d = days.get(indiaDay(c.created_at)) ?? { placed: 0, answered: 0 };
    d.placed++;
    if (c.status === 'done') d.answered++;
    days.set(indiaDay(c.created_at), d);
  }
  const perDay = [...days].slice(0, 7).map(([day, d]) => [
    new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }), d,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm font-medium text-brand hover:underline">← All leads</Link>
        <h1 className="mt-2 text-2xl font-semibold">AI sales calls</h1>
        <p className="mt-1 text-sm text-muted">
          Riya calls your leads automatically (switch below) or when you press &quot;Call with AI&quot; on a lead. Monday to Saturday,
          {' '}{RULES.startHour} am to {RULES.endHour - 12} pm, at most {RULES.maxCallsPerLead} calls per lead, {RULES.daysBetweenCalls} days apart.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {totals.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>
      {missed.length > 0 && (
        <p className="-mt-3 text-sm text-muted">
          Not answered: {missed.map(([label, n]) => `${label} ${n}`).join(' · ')}. Each lead is called again later, up to {RULES.maxCallsPerLead} times.
        </p>
      )}
      {perDay.length > 0 && (
        <p className="-mt-3 text-sm text-muted">
          Per day: {perDay.map(([day, d]) => `${day} ${d.placed} (${d.answered} answered)`).join(' · ')}
        </p>
      )}
      <p className="-mt-3 text-xs text-muted">Last 30 days. Cost is estimated at ₹3.50 a minute plus ₹0.20 per 30 seconds of phone line, billed per started minute; the Indian number is ₹59 per 30 days on top.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Automatic calling</h2>
          <p className={`mt-1 text-sm font-semibold ${settings.enabled ? 'text-green-700' : 'text-muted'}`}>{settings.enabled ? 'On' : 'Off'}</p>
          <div className="mt-4"><AutoCallSettings settings={settings} /></div>
        </section>
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Next up</h2>
          <p className="mt-1 text-xs text-muted">Order: {CALL_GROUPS.map((g) => g.label).join(' → ')}; within each, leads not called yet first, then most Google reviews.</p>
          {upcoming.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {upcoming.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-5 text-muted">{i + 1}.</span>
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-brand hover:underline">{cleanName(l.name)}</Link>
                  <span className="text-muted">{[CALL_GROUPS[callGroup(l)].label, l.city || l.locality, statusLabel(l.status), l.review_count ? `${l.review_count} reviews` : null].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted">Nobody to call with these settings.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-lg font-semibold">
          {all.length > rows.length ? <>Latest {rows.length} calls <span className="text-sm font-normal text-muted">of {all.length} in the last 30 days (totals above count them all)</span></> : 'All calls'}
        </h2>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-line bg-mist text-muted">
                <tr>
                  {['Brokerage', 'Called', 'Result', 'Length', 'Demo', 'WhatsApp', 'Call back', 'Enquiries from', 'Website', 'Concern'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => {
                  const r = c.status === 'done' ? c.result ?? {} : {};
                  const outcome = callOutcome(c);
                  return (
                    <tr key={c.id} className="align-top hover:bg-mist/60">
                      <td className="px-4 py-3">
                        {c.lead ? <Link href={`/admin/leads/${c.lead.id}`} className="font-semibold text-brand hover:underline">{cleanName(c.lead.name)}</Link> : <span className="text-muted">Deleted lead</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[outcome.tone]}`}>{outcome.label}</span>
                        {c.status !== 'done' && c.error && <span className="mt-1 block max-w-[14rem] text-xs text-muted">{c.error}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{c.status === 'done' ? minutes(c.duration_secs ?? 0) : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{r.demo_time || '—'}</td>
                      <td className="px-4 py-3">{r.whatsapp_ok ? 'Yes, send' : '—'}</td>
                      <td className="px-4 py-3">{r.callback_time || '—'}</td>
                      <td className="px-4 py-3">{r.lead_sources || '—'}</td>
                      <td className="px-4 py-3">{r.website_status || '—'}</td>
                      <td className="max-w-[16rem] px-4 py-3 text-muted">{r.objection || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted">No AI sales calls yet.</p>
        )}
      </section>
    </div>
  );
}
