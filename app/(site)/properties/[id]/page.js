import Link from 'next/link';
import { notFound } from 'next/navigation';
import Gallery from '@/components/Gallery';
import EmiCalculator from '@/components/EmiCalculator';
import EnquiryForm from '@/components/EnquiryForm';
import { WhatsAppIcon } from '@/components/WhatsAppButton';
import { createClient } from '@/lib/supabase/server';
import { site } from '@/lib/site';
import { formatPrice, typeLabel, whatsappLink } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function getListing(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createClient();
  const { data } = await supabase.from('listings').select('*').eq('id', id).eq('status', 'available').maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const listing = await getListing(params.id);
  if (!listing) return { title: 'Property not found' };
  return { title: `${listing.title}, ${listing.locality}`, description: listing.description?.slice(0, 160) };
}

export default async function PropertyPage({ params }) {
  const listing = await getListing(params.id);
  if (!listing) notFound();

  const specs = [
    ['Price', formatPrice(listing.price, listing.deal_type)],
    ['Property type', typeLabel(listing.property_type)],
    listing.bhk ? ['Configuration', `${listing.bhk} BHK`] : null,
    listing.area_sqft ? ['Area', `${Number(listing.area_sqft).toLocaleString('en-IN')} sq ft`] : null,
    listing.floor ? ['Floor', listing.floor] : null,
    ['Locality', listing.locality],
    listing.rera_number ? ['RERA project no.', listing.rera_number] : null,
  ].filter(Boolean);

  const mapSrc =
    listing.latitude && listing.longitude
      ? `https://maps.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(`${listing.address || listing.locality}, Pune`)}&z=14&output=embed`;

  const waText = `Hello ${site.name}, I'm interested in "${listing.title}" in ${listing.locality} (${formatPrice(listing.price, listing.deal_type)}). Is it still available?`;

  return (
    <div className="page py-8 sm:py-12">
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/properties" className="hover:text-basalt">Properties</Link>
        <span className="mx-2">/</span>
        <Link href={`/properties?locality=${encodeURIComponent(listing.locality)}`} className="hover:text-basalt">{listing.locality}</Link>
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{listing.title}</h1>
          <p className="mt-2 text-muted">{listing.address || `${listing.locality}, Pune`}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold text-teal sm:text-4xl">{formatPrice(listing.price, listing.deal_type)}</p>
          <p className="text-sm text-muted">{listing.deal_type === 'rent' ? 'For rent' : 'For sale'}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-10">
          <Gallery photos={listing.photos ?? []} title={listing.title} />

          <section>
            <h2 className="text-2xl font-semibold">Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
              {specs.map(([k, v]) => (
                <div key={k} className="bg-white p-4">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {listing.description && (
            <section>
              <h2 className="text-2xl font-semibold">About this property</h2>
              <div className="prose-body mt-3 whitespace-pre-line">{listing.description}</div>
            </section>
          )}

          {listing.amenities?.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold">Amenities</h2>
              <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {listing.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2.5 text-[15px]">
                    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" stroke="#0F5C5A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {listing.floor_plan && (
            <section>
              <h2 className="text-2xl font-semibold">Floor plan</h2>
              <a href={listing.floor_plan} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-line bg-white p-3">
                <img src={listing.floor_plan} alt={`Floor plan of ${listing.title}`} className="mx-auto max-h-[520px] w-auto" />
              </a>
              <p className="mt-2 text-sm text-muted">Select the plan to open it full size.</p>
            </section>
          )}

          <section>
            <h2 className="text-2xl font-semibold">Location</h2>
            <div className="mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-line">
              <iframe title={`Map showing ${listing.title}`} src={mapSrc} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          </section>

          {listing.deal_type === 'buy' && <EmiCalculator price={Number(listing.price)} />}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-line p-5">
            <h2 className="font-display text-xl font-semibold">Interested in this property?</h2>
            <p className="mt-1 text-sm text-muted">Ask a question or book a site visit.</p>
            <div className="mt-4 grid gap-2">
              <a href={whatsappLink(site.whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <WhatsAppIcon size={18} /> Ask on WhatsApp
              </a>
              <a href={`tel:${site.phoneHref}`} className="btn-outline">Call {site.phoneDisplay}</a>
            </div>
            <div className="my-5 border-t border-line" />
            <EnquiryForm listingId={listing.id} source="property" compact defaultMessage={`I'd like to know more about ${listing.title}.`} submitLabel="Book a site visit" />
          </div>
        </aside>
      </div>
    </div>
  );
}
