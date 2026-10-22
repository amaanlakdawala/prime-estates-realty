import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminContext, isUuid } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { href, toSite } from '@/lib/site';
import { toEmployee } from '@/lib/team';
import { formatDateTime } from '@/lib/format';
import FirmForm from '@/components/admin/FirmForm';
import FirmLoginForm from '@/components/admin/FirmLoginForm';
import FirmStatusButton from '@/components/admin/FirmStatusButton';
import { manageFirm } from '@/app/admin/firms/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Firm' };


export default async function FirmPage({ params }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');
  if (!isUuid(id)) notFound();

  const db = createAdminClient();
  const { data: row } = await db.from('firms').select('*').eq('id', id).maybeSingle();
  if (!row) notFound();
  const firm = toSite(row);
  const siteLive = firm.active && firm.websiteEnabled;

  const [{ data: links }, { count: listingCount }, { count: enquiryCount }] = await Promise.all([
    db.from('firm_users').select('user_id').eq('firm_id', id),
    db.from('listings').select('id', { count: 'exact', head: true }).eq('firm_id', id),
    db.from('enquiries').select('id', { count: 'exact', head: true }).eq('firm_id', id),
  ]);
  const logins = (await Promise.all((links ?? []).map((l) => db.auth.admin.getUserById(l.user_id))))
    .map((r) => r.data?.user)
    .filter(Boolean)
    .map(toEmployee);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/firms" className="text-sm font-medium text-brand hover:underline">← All firms</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {firm.name}
              {!firm.active && <span className="ml-2 rounded bg-ink px-2 py-0.5 align-middle text-xs font-semibold text-white">Paused</span>}
            </h1>
            <p className="mt-1 text-muted">
              {listingCount ?? 0} listings · {enquiryCount ?? 0} enquiries ·{' '}
              {siteLive ? <Link href={href(firm)} target="_blank" className="text-brand underline">/{firm.slug}</Link>
                : `/${firm.slug} (${firm.active ? 'website switched off' : 'offline'})`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {siteLive && <Link href={href(firm)} target="_blank" className="btn-outline">Visit website ↗</Link>}
            <form action={manageFirm.bind(null, firm.id)}>
              <button type="submit" className="btn-primary">Manage listings &amp; enquiries</button>
            </form>
            <FirmStatusButton firm={firm} />
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Login {logins.length > 1 && <span className="font-normal text-muted">({logins.length})</span>}</h2>
        <p className="mt-1 text-sm text-muted">This login sees and manages only {firm.name}&apos;s listings, enquiries and profile.</p>
        {logins.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {logins.map((u) => (
              <li key={u.id} className="relative flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-mist/60">
                <div>
                  <Link href={`/admin/users/${u.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">{u.name || u.email}</Link>
                  {u.name && <span className="ml-2 text-muted">{u.email}</span>}
                </div>
                <span className="text-muted">Last sign-in: {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'never'}</span>
              </li>
            ))}
          </ul>
        )}
        {logins.length > 0 && <p className="mt-2 text-sm text-muted">Open a login to set a new password or remove it.</p>}
        <div className={logins.length ? 'mt-6 border-t border-line pt-6' : 'mt-4'}>
          {logins.length > 0 && <h3 className="mb-4 font-display text-base font-semibold">Add another login</h3>}
          <FirmLoginForm firmId={firm.id} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Website details</h2>
        <p className="mt-1 text-sm text-muted">Everything shown on their website. Their login can also edit these (except the web address and demo setting) under Firm profile.</p>
        <div className="mt-5"><FirmForm firm={firm} adminFields /></div>
      </section>
    </div>
  );
}
