import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { firmsByUser, toEmployee } from '@/lib/team';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { RoleBadge } from '@/components/admin/UsersTable';
import UserActions from '@/components/admin/UserActions';
import UserProfileForm from '@/components/admin/UserProfileForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Login', robots: { index: false, follow: false } };

const STATUS_LABELS = { available: 'Available', sold: 'Sold', rented: 'Rented' };

export default async function LoginDetailPage({ params }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');
  const me = ctx.user;

  // Supabase throws (rather than returning "not found") on ids that aren't UUIDs.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const admin = createAdminClient();
  const [{ data, error }, firms] = await Promise.all([admin.auth.admin.getUserById(id), firmsByUser(admin)]);
  if (error || !data?.user) notFound();
  const employee = toEmployee(data.user, firms);

  // Listings this person added (created_by).
  const { data: listings, error: listingsError } = await admin
    .from('listings')
    .select('id, title, locality, price, deal_type, status, created_at')
    .eq('created_by', employee.id)
    .order('created_at', { ascending: false });
  const ownerColumnMissing = listingsError && /created_by/.test(listingsError.message);

  const details = [
    ['Email', employee.email],
    ['Access', employee.firm
      ? <Link key="firm" href={`/admin/firms/${employee.firm.id}`} className="font-medium text-brand underline">{employee.firm.name}</Link>
      : <RoleBadge key="role" employee={employee} />],
    ['Added', formatDateTime(employee.created_at)],
    ['Last sign-in', employee.last_sign_in_at ? formatDateTime(employee.last_sign_in_at) : 'Never signed in'],
    ['User ID', <code key="id" className="break-all text-xs">{employee.id}</code>],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href={employee.firm ? `/admin/firms/${employee.firm.id}` : '/admin/users'} className="text-sm font-medium text-brand hover:underline">
          ← {employee.firm ? employee.firm.name : 'Logins'}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {employee.name || employee.email}
          {employee.id === me.id && <span className="ml-2 text-base font-normal text-muted">(you)</span>}
        </h1>
        {employee.name && <p className="mt-1 text-muted">{employee.email}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Account</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8rem_1fr] gap-3 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Contact details</h2>
          <div className="mt-4"><UserProfileForm employee={employee} /></div>
          <h2 className="mt-8 border-t border-line pt-6 text-lg font-semibold">Access</h2>
          <div className="mt-4"><UserActions employee={employee} isSelf={employee.id === me.id} /></div>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">
          Listings added {listings && <span className="font-normal text-muted">({listings.length})</span>}
        </h2>
        {ownerColumnMissing ? (
          <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
            Listings aren&apos;t linked to who added them yet. Run <code>supabase/add_listing_owner.sql</code> once in the Supabase SQL Editor; listings added after that will show here.
          </p>
        ) : listingsError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">Listings could not be loaded: {listingsError.message}</p>
        ) : !listings.length ? (
          <p className="mt-3 text-sm text-muted">No listings added by this person yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-mist text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Property</th>
                  <th scope="col" className="px-4 py-3 font-medium">Price</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/${l.id}/edit`} className="font-semibold hover:underline">{l.title}</Link>
                      <span className="block text-muted">{l.locality}</span>
                    </td>
                    <td className="px-4 py-3">{formatPrice(l.price, l.deal_type)}</td>
                    <td className="px-4 py-3">{STATUS_LABELS[l.status] ?? l.status}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
