import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReelMaker from '@/components/admin/reel/ReelMaker';
import { requireFirm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { href } from '@/lib/site';

export const metadata = { title: 'Make reel' };

export default async function ReelPage({ params }) {
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
      <h1 className="mt-2 text-3xl font-semibold">Make a reel</h1>
      <p className="mt-1 max-w-2xl text-muted">
        A ready-to-post Instagram reel for <span className="font-medium text-ink">{listing.title}</span>, made from its photos,
        with the price, details and your phone number on screen.
      </p>
      <ReelMaker listing={listing} site={ctx.firm} listingPath={href(ctx.firm, `/properties/${listing.id}`)} />
    </>
  );
}
