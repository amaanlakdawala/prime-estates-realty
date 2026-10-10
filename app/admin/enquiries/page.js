import Link from 'next/link';
import DeleteEnquiryButton from '@/components/admin/DeleteEnquiryButton';
import { createClient } from '@/lib/supabase/server';
import { site } from '@/lib/site';
import { whatsappLink } from '@/lib/format';

export const metadata = { title: 'Enquiries' };

const SOURCE_LABELS = { property: 'Property page', callback: 'Callback request', contact: 'Contact page', website: 'Website' };

export default async function EnquiriesPage() {
  const supabase = await createClient();
  const { data: enquiries, error } = await supabase
    .from('enquiries')
    .select('*, listings(id, title)')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <>
      <h1 className="text-3xl font-semibold">Enquiries</h1>
      <p className="mt-1 text-muted">Leads sent through forms on the website, newest first.</p>
      {error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">Enquiries could not be loaded: {error.message}</p>}
      {!error && !enquiries?.length && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-10 text-center text-muted">
          No enquiries yet. They will appear here when visitors send a form on the website.
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {enquiries?.map((q) => {
          const digits = q.phone.replace(/\D/g, '');
          const wa = digits.length === 10 ? `91${digits}` : digits;
          return (
            <li key={q.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{q.name}</p>
                  <p className="text-sm text-muted">
                    {new Date(q.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}, {SOURCE_LABELS[q.source] ?? q.source}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${q.phone}`} className="btn-outline py-2">Call {q.phone}</a>
                  <a href={whatsappLink(wa, `Hello ${q.name}, this is ${site.name} replying to your enquiry.`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp py-2">WhatsApp</a>
                  <DeleteEnquiryButton id={q.id} />
                </div>
              </div>
              {q.listings && (
                <p className="mt-3 text-sm">Property: <Link href={`/admin/${q.listings.id}/edit`} className="font-medium text-teal underline">{q.listings.title}</Link></p>
              )}
              {q.email && <p className="mt-1 text-sm">Email: <a href={`mailto:${q.email}`} className="text-teal underline">{q.email}</a></p>}
              {q.message && <p className="mt-3 whitespace-pre-line rounded-lg bg-stone p-3 text-[15px]">{q.message}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
