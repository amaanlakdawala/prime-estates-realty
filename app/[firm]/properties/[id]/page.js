import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { notFound } from 'next/navigation';
import Gallery from '@/components/Gallery';
import EmiCalculator from '@/components/EmiCalculator';
import EnquiryForm from '@/components/EnquiryForm';
import { WhatsAppIcon } from '@/components/WhatsAppButton';
import { getSiteBySlug } from '@/lib/firm';
import { createPublicClient } from '@/lib/supabase/public';
import { href } from '@/lib/site';
import { formatPrice, typeLabel, whatsappLink } from '@/lib/format';

// Cached and rebuilt at most every 5 minutes, or straight after the firm changes a listing or its profile
// (app/actions/site.js): visitors get a ready page instead of a database round trip per visit.
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return []; // pages are built on their first visit, then cached
}

// Only an available listing that belongs to this firm: another firm's listing id gives "not found".
async function getListing(site, id) {
  if (!site || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createPublicClient().from('listings').select('*').eq('id', id).eq('firm_id', site.id).eq('status', 'available').maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const { firm, id } = await params;
  const listing = await getListing(await getSiteBySlug(firm), id);
  if (!listing) return { title: 'Property not found' };
  return { title: `${listing.title}, ${listing.locality}`, description: listing.description?.slice(0, 160) };
}

export default async function PropertyPage({ params }) {
  const { firm, id } = await params;
  const site = await getSiteBySlug(firm);
  const listing = await getListing(site, id);
  if (!listing) notFound();
  const where = [listing.address || listing.locality, site.city].filter(Boolean).join(', ');

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
      : `https://maps.google.com/maps?q=${encodeURIComponent(where)}&z=14&output=embed`;

  const waText = `Hello ${site.name}, I'm interested in "${listing.title}" in ${listing.locality} (${formatPrice(listing.price, listing.deal_type)}). Is it still available?`;

  return (
    <div className="page py-8 sm:py-12">
      <nav className="text-sm text-muted" aria-label="Breadcrumb">
        <Link href={href(site, '/properties')} className="hover:text-ink">Properties</Link>
        <span className="mx-2">/</span>
        <Link href={href(site, `/properties?locality=${encodeURIComponent(listing.locality)}`)} className="hover:text-ink">{listing.locality}</Link>
      </nav>

      <div className="mt-4 flex animate-fade-up flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{listing.title}</h1>
          <p className="mt-2 text-muted">{where}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold tracking-tight text-brand sm:text-4xl">{formatPrice(listing.price, listing.deal_type)}</p>
          <p className="text-sm text-muted">{listing.deal_type === 'rent' ? 'For rent' : 'For sale'}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-10">
          <Gallery photos={listing.photos ?? []} title={listing.title} />

          <Reveal as="section">
            <h2 className="text-2xl font-semibold">Details</h2>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card sm:grid-cols-3">
              {specs.map(([k, v]) => (
                <div key={k} className="bg-white p-4">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {listing.description && (
            <Reveal as="section">
              <h2 className="text-2xl font-semibold">About this property</h2>
              <div className="prose-body mt-3 whitespace-pre-line">{listing.description}</div>
            </Reveal>
          )}

          {listing.amenities?.length > 0 && (
            <Reveal as="section">
              <h2 className="text-2xl font-semibold">Amenities</h2>
              <ul className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {listing.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2.5 text-[15px]">
                    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" stroke="#2B59E8" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {a}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {listing.floor_plan && (
            <Reveal as="section">
              <h2 className="text-2xl font-semibold">Floor plan</h2>
              <a href={listing.floor_plan} target="_blank" rel="noopener noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-line bg-white p-3">
                <img src={listing.floor_plan} alt={`Floor plan of ${listing.title}`} className="mx-auto max-h-[520px] w-auto" />
              </a>
              <p className="mt-2 text-sm text-muted">Select the plan to open it full size.</p>
            </Reveal>
          )}

          <Reveal as="section">
            <h2 className="text-2xl font-semibold">Location</h2>
            <div className="mt-4 aspect-[16/9] overflow-hidden rounded-2xl border border-line">
              <iframe title={`Map showing ${listing.title}`} src={mapSrc} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
          </Reveal>

          {listing.deal_type === 'buy' && <EmiCalculator price={Number(listing.price)} />}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="animate-fade-up rounded-3xl border border-line bg-white p-6 shadow-lift [animation-delay:0.15s]">
            <h2 className="font-display text-xl font-semibold">Interested in this property?</h2>
            <p className="mt-1 text-sm text-muted">Ask a question or book a site visit.</p>
            <div className="mt-4 grid gap-2">
              {site.whatsapp && (
                <a href={whatsappLink(site.whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                  <WhatsAppIcon size={18} /> Ask on WhatsApp
                </a>
              )}
              {site.phoneHref && <a href={`tel:${site.phoneHref}`} className="btn-outline">Call {site.phoneDisplay}</a>}
            </div>
            <div className="my-5 border-t border-line" />
            <EnquiryForm firmId={site.id} listingId={listing.id} source="property" compact defaultMessage={`I'd like to know more about ${listing.title}.`} submitLabel="Book a site visit" />
          </div>
        </aside>
      </div>
    </div>
  );
}
