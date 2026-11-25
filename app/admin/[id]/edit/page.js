import Link from 'next/link';
import { notFound } from 'next/navigation';
import ListingForm from '@/components/admin/ListingForm';
import { requireFirm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ListingClients from '@/features/clients/admin/ListingClients';
import { firmRow } from '@/features/clients/admin/data';
import { runMatching } from '@/features/clients/sync';

export const metadata = { title: 'Edit listing' };

export default async function EditListingPage({ params }) {
  const { id } = await params;
  const ctx = await requireFirm();
  if (!ctx) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: listing } = await supabase.from('listings').select('*').eq('id', id).eq('firm_id', ctx.firm.id).maybeSingle();
  if (!listing) notFound();
  // So "Clients who want this" includes a listing just added or re-priced (no-op until 15_clients.sql is run).
  await runMatching(await firmRow(ctx.firm.id)).catch(() => null);
  // Private owner details (supabase/14_services.sql); none yet, or the table not set up, is just empty.
  const { data: owner } = await supabase.from('listing_owners').select('owner_name, owner_phone').eq('listing_id', id).maybeSingle();

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Back to listings</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Edit listing</h1>
        {listing.photos?.length > 0 && <Link href={`/admin/${listing.id}/reel`} className="btn-outline">Make reel</Link>}
      </div>
      <ListingForm firm={ctx.firm} initial={listing} owner={owner} />
      <ListingClients firm={ctx.firm} listingId={listing.id} />
    </>
  );
}
