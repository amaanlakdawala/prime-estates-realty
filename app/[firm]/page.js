import Link from 'next/link';
import PropertyCard from '@/components/PropertyCard';
import EnquiryForm from '@/components/EnquiryForm';
import { requireSite } from '@/lib/firm';
import { createPublicClient } from '@/lib/supabase/public';
import { href, localityList } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Shown behind the headline until the firm sets its own hero photo (or .mp4 video) in its profile.
const PLACEHOLDER_PHOTOS = {
  main: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  small1: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
  small2: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
};

async function getFeaturedListings(firmId) {
  const supabase = createPublicClient();
  const base = () => supabase.from('listings').select('*').eq('firm_id', firmId).eq('status', 'available').order('created_at', { ascending: false }).limit(6);
  const [featured, latest] = await Promise.all([base().eq('featured', true), base()]);
  return featured.data?.length ? featured.data : latest.data ?? [];
}

export default async function HomePage({ params }) {
  const site = await requireSite(params);
  const listings = await getFeaturedListings(site.id);
  const inCity = site.city ? ` in ${site.city}` : '';
  const since = site.foundedYear ? ` since ${site.foundedYear}` : '';
  const heroIsVideo = /\.mp4($|\?)/i.test(site.heroUrl);

  const services = [
    { title: 'Buy a home', text: 'Shortlists matched to your budget and commute, site visits arranged around your schedule.', path: '/services#buy' },
    { title: 'Sell your property', text: 'A fair price based on recent deals nearby, and serious buyers only.', path: '/services#sell' },
    { title: 'Rent or let out', text: 'Tenant checks, rent agreements and police verification handled for you.', path: '/services#rent' },
    { title: 'Commercial spaces', text: `Offices, shops and showrooms on lease or for sale${site.city ? ` across ${site.city}` : ''}.`, path: '/services#commercial' },
  ];

  const reasons = [
    site.mahareraAgentNo && { title: 'MahaRERA registered', text: `Registered agent no. ${site.mahareraAgentNo}. Every project we show carries its RERA number.` },
    { title: 'Listings we have visited', text: 'Our team visits every property before it goes on this site, so the photos match what you will see.' },
    { title: 'Brokerage agreed upfront', text: 'You know our fee before your first site visit. There are no charges added later.' },
    { title: 'Paperwork to possession', text: 'We coordinate home loans, agreement registration and society transfer until you get the keys.' },
  ].filter(Boolean);

  // SAMPLE quotes, shown only for demo firms (demo_content). A real firm's site never shows them.
  const area = (i) => site.localities[i] ?? site.city;
  const testimonials = [
    { quote: 'They showed us only homes that fit our budget and our commute. We booked our flat in two weekends.', name: 'Rohit and Sneha K.', detail: `Bought a 2 BHK in ${area(0)}` },
    { quote: 'Sold my parents’ flat while I was working in another city. Every step was explained on WhatsApp.', name: 'Anjali M.', detail: `Sold a 3 BHK in ${area(1)}` },
    { quote: 'Found an office for our team of twelve within a week, and the lease terms were clearly negotiated.', name: 'Karan S.', detail: `Leased an office in ${area(2)}` },
  ];

  const headline = `Find a home${inCity} with a broker who knows the neighbourhood.`;
  const subline = 'Flats, villas, plots and commercial spaces for sale and rent, visited and verified by our team.';

  return (
    <>
      {/* Hero */}
      {!site.heroUrl ? (
        <section className="overflow-hidden bg-basalt text-white">
          <div className="page grid gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-marigold">
                Trusted {site.city ? `${site.city} ` : ''}brokerage{since}
              </p>
              <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.05] sm:text-6xl">{headline}</h1>
              <p className="mt-5 max-w-xl text-lg text-white/75">{subline}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={href(site, '/properties')} className="btn-primary">Browse properties</Link>
                {site.phoneHref && (
                  <a href={`tel:${site.phoneHref}`} className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-white/10">
                    Call {site.phoneDisplay}
                  </a>
                )}
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 text-sm font-semibold text-white/80">
                {site.mahareraAgentNo && <li>MahaRERA registered</li>}
                <li>Every listing visited by our team</li>
                <li>Brokerage agreed upfront</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 aspect-[16/10] overflow-hidden rounded-2xl bg-white/5 shadow-2xl">
                <img src={PLACEHOLDER_PHOTOS.main} alt="A modern home exterior" className="h-full w-full object-cover" />
              </div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-white/5 shadow-xl">
                <img src={PLACEHOLDER_PHOTOS.small1} alt="A furnished living room" className="h-full w-full object-cover" />
              </div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-white/5 shadow-xl">
                <img src={PLACEHOLDER_PHOTOS.small2} alt="A modern kitchen interior" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative flex h-[70vh] min-h-[420px] items-end overflow-hidden bg-basalt text-white sm:h-[85vh]">
          {heroIsVideo ? (
            <video className="absolute inset-0 h-full w-full object-cover" src={site.heroUrl} autoPlay muted loop playsInline />
          ) : (
            <div
              className="absolute inset-0 h-full w-full"
              style={{ backgroundImage: `url('${site.heroUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-basalt/90 via-basalt/20 to-transparent" />
          <div className="page relative pb-12 sm:pb-16">
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">{headline}</h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">{subline}</p>
            <Link href={href(site, '/properties')} className="btn-primary mt-8 inline-block">Browse properties</Link>
          </div>
        </section>
      )}

      {/* Featured properties */}
      <section className="page py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Featured properties</h2>
            <p className="mt-2 text-muted">Hand-picked by our team this month.</p>
          </div>
          <Link href={href(site, '/properties')} className="btn-outline">View all properties</Link>
        </div>
        {listings.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => <PropertyCard key={l.id} site={site} listing={l} />)}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center">
            <p className="font-semibold">New listings are being added.</p>
            <p className="mt-1 text-muted">Tell us what you are looking for and we will call you with matching options.</p>
            <Link href={href(site, '/contact')} className="btn-primary mt-5">Tell us what you need</Link>
          </div>
        )}
      </section>

      {/* Services */}
      <section className="bg-stone">
        <div className="page py-16 sm:py-20">
          <h2 className="section-title">What we do</h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <Link key={s.title} href={href(site, s.path)} className="bg-white p-6 hover:bg-teal-light">
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-basalt/75">{s.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="page grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="section-title">Why families{inCity} choose us</h2>
          <p className="mt-4 text-lg text-muted">
            We have been closing deals across {localityList(site, 3)}{since}. Most of our clients come through referrals.
          </p>
        </div>
        <dl className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {reasons.map((r) => (
            <div key={r.title} className="border-t-2 border-teal pt-4">
              <dt className="font-display text-lg font-semibold">{r.title}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-basalt/75">{r.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Testimonials (sample quotes: demo firms only) */}
      {site.demoContent && (
        <section className="bg-teal text-white">
          <div className="page py-16 sm:py-20">
            <h2 className="section-title">What our clients say</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {testimonials.map((t) => (
                <figure key={t.name} className="flex flex-col">
                  <blockquote className="flex-1 font-display text-xl leading-snug">“{t.quote}”</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    <span className="block text-white/70">{t.detail}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Callback */}
      <section className="page grid gap-10 py-16 sm:py-20 lg:grid-cols-2">
        <div>
          <h2 className="section-title">Get a callback</h2>
          <p className="mt-4 max-w-md text-lg text-muted">
            Share your number and what you are looking for. A broker who covers your preferred area will call you within one working day.
          </p>
          {site.phoneHref && (
            <p className="mt-6 text-[15px]">
              Prefer to talk now? Call <a className="font-semibold text-teal underline" href={`tel:${site.phoneHref}`}>{site.phoneDisplay}</a>
            </p>
          )}
        </div>
        <div className="rounded-xl border border-line p-6">
          <EnquiryForm firmId={site.id} source="callback" submitLabel="Request a callback" />
        </div>
      </section>
    </>
  );
}
