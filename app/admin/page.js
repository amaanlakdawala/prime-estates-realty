import Link from 'next/link';
import ListingsTable from '@/components/admin/ListingsTable';
import { createClient } from '@/lib/supabase/server';

export default async function AdminListingsPage() {
  const supabase = createClient();
  const { data: listings, error } = await supabase.from('listings').select('*').order('created_at', { ascending: false });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Listings</h1>
          <p className="mt-1 text-muted">Add, edit, hide or delete the properties shown on the website.</p>
        </div>
        <Link href="/admin/new" className="btn-primary">Add listing</Link>
      </div>
      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">Listings could not be loaded: {error.message}</p>
      ) : (
        <ListingsTable listings={listings ?? []} />
      )}
    </>
  );
}
