import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';
import SignOutButton from '@/components/admin/SignOutButton';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const admin = isAdmin(user);

  return (
    <div className="min-h-screen bg-stone">
      <header className="bg-basalt text-white">
        <div className="page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-display text-lg font-semibold">{site.name} <span className="font-sans text-sm font-normal text-white/60">Admin</span></Link>
            <AdminNav isAdmin={admin} />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:inline">{user.email}</span>
            <Link href="/" target="_blank" className="hidden text-sm text-white/70 hover:text-white md:inline">View site</Link>
            <SignOutButton />
          </div>
        </div>
        <div className="page pb-3 md:hidden"><AdminNav mobile isAdmin={admin} /></div>
      </header>
      <main className="page py-8">{children}</main>
    </div>
  );
}
