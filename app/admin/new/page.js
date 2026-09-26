import Link from 'next/link';
import ListingForm from '@/components/admin/ListingForm';

export const metadata = { title: 'Add listing' };

export default function NewListingPage() {
  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-basalt">← Back to listings</Link>
      <h1 className="mt-2 text-3xl font-semibold">Add listing</h1>
      <ListingForm />
    </>
  );
}
