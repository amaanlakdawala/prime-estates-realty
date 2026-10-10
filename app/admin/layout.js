import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { PLATFORM_NAME, href } from '@/lib/site';
import AdminNav from '@/components/admin/AdminNav';
import SignOutButton from '@/components/admin/SignOutButton';
import { stopManagingFirm } from '@/app/admin/firms/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

function Notice({ title, children }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-8 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">{children}</p>
    </div>
  );
}

export default async function AdminLayout({ children }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect('/login');
  const { user, isPlatformAdmin, firm } = ctx;

  // A firm login can only work on its own, active firm.
  let blocked = null;
  if (!isPlatformAdmin && !firm) blocked = <Notice title="Account not set up">This login isn&apos;t linked to a firm yet. Please contact us.</Notice>;
  else if (!isPlatformAdmin && !firm.active) blocked = <Notice title="Account paused">Your website and admin access are paused. Please contact us to restart them.</Notice>;

  return (
    <div className="min-h-screen bg-stone">
      <header className="bg-basalt text-white">
        <div className="page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href={isPlatformAdmin && !firm ? '/admin/firms' : '/admin'} className="font-display text-lg font-semibold">
              {isPlatformAdmin ? PLATFORM_NAME : firm?.name ?? PLATFORM_NAME} <span className="font-sans text-sm font-normal text-white/60">Admin</span>
            </Link>
            {!blocked && <AdminNav isPlatformAdmin={isPlatformAdmin} hasFirm={!!firm} />}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:inline">{user.email}</span>
            {firm && !blocked && <Link href={href(firm)} target="_blank" className="hidden text-sm text-white/70 hover:text-white md:inline">View website</Link>}
            <SignOutButton />
          </div>
        </div>
        {!blocked && <div className="page pb-3 md:hidden"><AdminNav mobile isPlatformAdmin={isPlatformAdmin} hasFirm={!!firm} /></div>}
      </header>

      {isPlatformAdmin && firm && (
        <div className="border-b border-marigold/40 bg-marigold/15">
          <form action={stopManagingFirm} className="page flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <p>
              Managing <span className="font-semibold">{firm.name}</span>
              {!firm.active && <span className="ml-2 rounded bg-basalt px-1.5 py-0.5 text-xs font-semibold text-white">Paused</span>}
            </p>
            <button type="submit" className="font-medium text-teal-dark underline">Back to all firms</button>
          </form>
        </div>
      )}

      <main className="page py-8">{blocked ?? children}</main>
    </div>
  );
}
