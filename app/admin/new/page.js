import Link from 'next/link';
import ListingForm from '@/components/admin/ListingForm';
import { requireFirm } from '@/lib/auth';

export const metadata = { title: 'Add listing' };

export default async function NewListingPage() {
  const ctx = await requireFirm();
  if (!ctx) return null;

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-basalt">← Back to listings</Link>
      <h1 className="mt-2 text-3xl font-semibold">Add listing</h1>
      <ListingForm firm={ctx.firm} />
    </>
  );
}
