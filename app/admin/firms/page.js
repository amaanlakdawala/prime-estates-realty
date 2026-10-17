import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/format';
import NewFirmForm from '@/components/admin/NewFirmForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Firms' };


export default async function FirmsPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  const db = createAdminClient();
  // Counted in the database (supabase/scale.sql): reading every listing to count them breaks past 1,000 rows.
  const [{ data: firms, error }, { data: counts }] = await Promise.all([
    db.from('firms').select('*').order('created_at', { ascending: false }),
    db.rpc('firm_counts'),
  ]);
  const byFirm = Object.fromEntries((counts ?? []).map((c) => [c.firm_id, c]));
  const listingCount = Object.fromEntries(Object.entries(byFirm).map(([id, c]) => [id, Number(c.listings)]));
  const loginCount = Object.fromEntries(Object.entries(byFirm).map(([id, c]) => [id, Number(c.logins)]));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Firms</h1>
      <p className="mt-1 text-muted">Each client firm gets its own website and a login that sees only its own listings and enquiries.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <section className="h-fit rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Add a firm</h2>
          <NewFirmForm />
        </section>

        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">All firms {firms && <span className="font-normal text-muted">({firms.length})</span>}</h2>
          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">Firms could not be loaded: {error.message}</p>
          ) : !firms?.length ? (
            <p className="mt-4 text-muted">No firms yet. Add your first client on the left.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line bg-mist text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Firm</th>
                    <th scope="col" className="px-4 py-3 font-medium">Website</th>
                    <th scope="col" className="px-4 py-3 font-medium">Listings</th>
                    <th scope="col" className="px-4 py-3 font-medium">Logins</th>
                    <th scope="col" className="px-4 py-3 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {firms.map((f) => (
                    <tr key={f.id} className="relative hover:bg-mist/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/firms/${f.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">{f.name}</Link>
                        {!f.active && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-xs font-semibold text-white">Paused</span>}
                        {f.demo_content && <span className="ml-2 rounded bg-accent/30 px-1.5 py-0.5 text-xs font-semibold">Demo</span>}
                        <span className="block text-muted">/{f.slug}{f.city ? ` · ${f.city}` : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        {/* z-10 lifts the link above the row-wide link to the firm's page. */}
                        {f.active && f.website_enabled !== false
                          ? <Link href={`/${f.slug}`} target="_blank" className="relative z-10 font-medium text-brand underline">Visit ↗</Link>
                          : <span className="text-muted">{f.active ? 'Switched off' : 'Offline'}</span>}
                      </td>
                      <td className="px-4 py-3">{listingCount[f.id] ?? 0}</td>
                      <td className="px-4 py-3">{loginCount[f.id] ?? 0}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
