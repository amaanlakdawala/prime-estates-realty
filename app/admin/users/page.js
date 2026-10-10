import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { firmsByUser, toEmployee } from '@/lib/team';
import UsersTable from '@/components/admin/UsersTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logins', robots: { index: false, follow: false } };

export default async function UsersPage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  let employees = [];
  let loadError = '';
  try {
    const db = createAdminClient();
    const [{ data, error }, firms] = await Promise.all([db.auth.admin.listUsers({ perPage: 200 }), firmsByUser(db)]);
    if (error) throw error;
    employees = (data?.users ?? [])
      .map((u) => toEmployee(u, firms))
      .sort((a, b) => (a.role === b.role ? new Date(b.created_at) - new Date(a.created_at) : a.role === 'admin' ? -1 : 1));
  } catch (err) {
    loadError = err.message || 'Could not load the logins.';
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Logins</h1>
      <p className="mt-1 text-muted">Everyone who can sign in. Create a client&apos;s login from their firm&apos;s page under Firms.</p>
      <section className="mt-6 rounded-xl border border-line bg-white p-5 sm:p-6">
        {loadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{loadError}</p>
        ) : (
          <UsersTable employees={employees} currentUserId={ctx.user.id} />
        )}
      </section>
    </div>
  );
}
