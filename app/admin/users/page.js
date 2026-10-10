import { redirect } from 'next/navigation';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { toEmployee } from '@/lib/team';
import UserForm from '@/components/admin/UserForm';
import UsersTable from '@/components/admin/UsersTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team', robots: { index: false, follow: false } };

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect('/admin');

  let employees = [];
  let loadError = '';
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    employees = (data?.users ?? [])
      .map(toEmployee)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (err) {
    loadError = err.message || 'Could not load the team list.';
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="mt-1 text-muted">Create logins for employees who need access to this admin panel.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="h-fit rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Add a team member</h2>
          <p className="mt-1 text-sm text-muted">They can sign in at <code className="rounded bg-stone px-1 py-0.5">/login</code> right away with the password you set here.</p>
          <UserForm />
        </section>

        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Everyone with access</h2>
          <p className="mt-1 text-sm text-muted">Select a person to see their details, the listings they added, and to set their password or role.</p>
          {loadError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{loadError}</p>
          ) : (
            <UsersTable employees={employees} currentUserId={user.id} />
          )}
        </section>
      </div>
    </div>
  );
}
