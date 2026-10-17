import Link from 'next/link';
import { notFound } from 'next/navigation';
import ListingForm from '@/components/admin/ListingForm';
import { requireFirm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Edit listing' };

export default async function EditListingPage({ params }) {
  const { id } = await params;
  const ctx = await requireFirm();
  if (!ctx) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: listing } = await supabase.from('listings').select('*').eq('id', id).eq('firm_id', ctx.firm.id).maybeSingle();
  if (!listing) notFound();

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Back to listings</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Edit listing</h1>
        {listing.photos?.length > 0 && <Link href={`/admin/${listing.id}/reel`} className="btn-outline">Make reel</Link>}
      </div>
      <ListingForm firm={ctx.firm} initial={listing} />
    </>
  );
}
