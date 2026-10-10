import Link from 'next/link';
import { notFound } from 'next/navigation';
import ListingForm from '@/components/admin/ListingForm';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Edit listing' };

export default async function EditListingPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: listing } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (!listing) notFound();

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-basalt">← Back to listings</Link>
      <h1 className="mt-2 text-3xl font-semibold">Edit listing</h1>
      <ListingForm initial={listing} />
    </>
  );
}
