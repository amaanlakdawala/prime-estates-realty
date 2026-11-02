import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cleanName, statusLabel } from '@/lib/leads';
import { formatDateTime } from '@/lib/format';
import { describeCall, estimatedCost } from '../format';
import { RULES } from '../calls';
import { getAutoSettings, nextUp } from '../auto';
import AutoCallSettings from './AutoCallSettings';

const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Leads → AI sales calls: automatic calling, who is called next, and every call Riya made, with 30-day totals.
export default async function SalesCallsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  const db = createAdminClient();
  const settings = await getAutoSettings(db);
  const [{ data: calls }, upcoming] = await Promise.all([
    db.from('sales_calls')
      .select('id, created_at, status, duration_secs, result, error, lead:leads(id, name, status)')
      .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString())
      .order('created_at', { ascending: false })
      .limit(300),
    nextUp(settings, 10, db),
  ]);
  const rows = calls ?? [];
  const answered = rows.filter((c) => c.status === 'done');
  const totals = [
    ['Calls placed', rows.length],
    ['Answered', answered.length],
    ['Interested', answered.filter((c) => c.result?.interested || c.result?.demo_time).length],
    ['Demos booked', answered.filter((c) => c.result?.demo_time).length],
    ['Minutes', Math.round(answered.reduce((s, c) => s + (c.duration_secs ?? 0), 0) / 60)],
    ['Sarvam cost (est.)', rupees(rows.reduce((s, c) => s + estimatedCost(c), 0))],
  ];

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
      <p className="-mt-3 text-xs text-muted">Last 30 days. Cost is estimated at ₹3.50 a minute plus ₹0.20 per 30 seconds of phone line, billed per started minute; the Indian number is ₹59 per 30 days on top.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Automatic calling</h2>
          <p className={`mt-1 text-sm font-semibold ${settings.enabled ? 'text-green-700' : 'text-muted'}`}>{settings.enabled ? 'On' : 'Off'}</p>
          <div className="mt-4"><AutoCallSettings settings={settings} /></div>
        </section>
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Next up</h2>
          {upcoming.length ? (
            <ol className="mt-3 space-y-2 text-sm">
              {upcoming.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-5 text-muted">{i + 1}.</span>
                  <Link href={`/admin/leads/${l.id}`} className="font-medium text-brand hover:underline">{cleanName(l.name)}</Link>
                  <span className="text-muted">{[l.locality, statusLabel(l.status), `score ${l.score}`, l.website ? 'has website' : 'no website'].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted">Nobody to call with these settings.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-lg font-semibold">All calls</h2>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id} className="p-4 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  {c.lead ? <Link href={`/admin/leads/${c.lead.id}`} className="font-semibold text-brand hover:underline">{cleanName(c.lead.name)}</Link> : <span>Deleted lead</span>}
                  <span className="text-muted">{formatDateTime(c.created_at)}</span>
                </p>
                <p className="mt-1">{c.status === 'placing' ? 'Calling…' : describeCall(c)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted">No AI sales calls yet.</p>
        )}
      </section>
    </div>
  );
}
