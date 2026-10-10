import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { href } from '@/lib/site';
import FirmForm from '@/components/admin/FirmForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Firm profile' };

export default async function ProfilePage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect('/login');
  if (!ctx.firm) redirect(ctx.isPlatformAdmin ? '/admin/firms' : '/admin');
  if (!ctx.isPlatformAdmin && !ctx.firm.active) return null; // the layout explains the pause
  const { firm } = ctx;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Firm profile</h1>
      <p className="mt-1 text-muted">
        Your firm&apos;s details as shown on <Link href={href(firm)} target="_blank" className="text-teal underline">your website</Link>.
      </p>
      <section className="mt-6 rounded-xl border border-line bg-white p-5 sm:p-6">
        <FirmForm firm={firm} adminFields={ctx.isPlatformAdmin} />
      </section>
    </div>
  );
}
