import Link from 'next/link';
import PropertyCard from '@/components/PropertyCard';
import EnquiryForm from '@/components/EnquiryForm';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import { requireSite } from '@/lib/firm';
import { createPublicClient } from '@/lib/supabase/public';
import { href, localityList } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Shown beside the headline until the firm sets its own hero photo (or .mp4 video) in its profile.
const PLACEHOLDER_PHOTOS = {
  main: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
  small1: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
  small2: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
};

async function getHomeData(firmId) {
  const supabase = createPublicClient();
  const base = () => supabase.from('listings').select('*').eq('firm_id', firmId).eq('status', 'available').order('created_at', { ascending: false }).limit(6);
  const [featured, latest, { count }] = await Promise.all([
    base().eq('featured', true),
    base(),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).eq('status', 'available'),
  ]);
  return { listings: featured.data?.length ? featured.data : latest.data ?? [], available: count ?? 0 };
}

// Small line icons for the services cards.
const ICONS = {
  buy: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />,
  sell: <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />,
  rent: <path d="M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM12 11v10m0-4h3m-3 2.5h2" />,
  commercial: <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16m0-11h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3m-3 4h3m-3 4h3" />,
};

export default async function HomePage({ params }) {
  const site = await requireSite(params);
  const { listings, available } = await getHomeData(site.id);
  const inCity = site.city ? ` in ${site.city}` : '';
  const since = site.foundedYear ? ` since ${site.foundedYear}` : '';
  const heroIsVideo = /\.mp4($|\?)/i.test(site.heroUrl);
  const years = site.foundedYear ? new Date().getFullYear() - site.foundedYear : 0;

  // Only real figures: nothing is shown for a number the firm doesn't have.
  const stats = [
    available > 0 && { value: available, label: available === 1 ? 'Property available now' : 'Properties available now' },
    site.localities.length > 0 && { value: site.localities.length, label: site.localities.length === 1 ? 'Area covered' : 'Areas covered' },
    years > 0 && { value: years, suffix: '+', label: 'Years in the business' },
  ].filter(Boolean);

  const services = [
    { key: 'buy', title: 'Buy a home', text: 'Shortlists matched to your budget and commute, site visits arranged around your schedule.', path: '/services#buy' },
    { key: 'sell', title: 'Sell your property', text: 'A fair price based on recent deals nearby, and serious buyers only.', path: '/services#sell' },
    { key: 'rent', title: 'Rent or let out', text: 'Tenant checks, rent agreements and police verification handled for you.', path: '/services#rent' },
    { key: 'commercial', title: 'Commercial spaces', text: `Offices, shops and showrooms on lease or for sale${site.city ? ` across ${site.city}` : ''}.`, path: '/services#commercial' },
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
        <section className="relative isolate overflow-hidden bg-ink text-white">
          {/* Slowly glowing light and a faint grid behind the content. */}
          <div className="absolute -left-40 -top-40 -z-10 h-[34rem] w-[34rem] animate-glow rounded-full bg-brand/40 blur-[120px]" aria-hidden="true" />
          <div className="absolute -bottom-48 right-0 -z-10 h-[30rem] w-[30rem] animate-glow rounded-full bg-accent/20 blur-[120px] [animation-delay:3s]" aria-hidden="true" />
          <div className="absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" aria-hidden="true" />
          <div className="page grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
            <div className="stagger">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Trusted {site.city ? `${site.city} ` : ''}brokerage{since}
              </p>
              <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.04] sm:text-6xl">
                {headline}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{subline}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={href(site, '/properties')} className="btn-primary px-6 py-3.5 text-[15px]">
                  Browse properties <span aria-hidden="true">→</span>
                </Link>
                {site.phoneHref && (
                  <a href={`tel:${site.phoneHref}`} className="btn-ghost-light px-6 py-3.5 text-[15px]">Call {site.phoneDisplay}</a>
                )}
              </div>
              <ul className="mt-11 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-6 text-sm font-medium text-white/70">
                {site.mahareraAgentNo && <li className="flex items-center gap-2"><Check /> MahaRERA registered</li>}
                <li className="flex items-center gap-2"><Check /> Every listing visited by our team</li>
                <li className="flex items-center gap-2"><Check /> Brokerage agreed upfront</li>
              </ul>
            </div>
            <div className="relative animate-fade-in [animation-delay:0.25s]">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 aspect-[16/10] overflow-hidden rounded-3xl bg-white/5 shadow-2xl ring-1 ring-white/10">
                  <img src={PLACEHOLDER_PHOTOS.main} alt="A modern home exterior" className="h-full w-full animate-slow-zoom object-cover" />
                </div>
                <div className="aspect-square overflow-hidden rounded-3xl bg-white/5 shadow-xl ring-1 ring-white/10">
                  <img src={PLACEHOLDER_PHOTOS.small1} alt="A furnished living room" className="h-full w-full animate-slow-zoom object-cover [animation-delay:-6s]" />
                </div>
                <div className="aspect-square overflow-hidden rounded-3xl bg-white/5 shadow-xl ring-1 ring-white/10">
                  <img src={PLACEHOLDER_PHOTOS.small2} alt="A modern kitchen interior" className="h-full w-full animate-slow-zoom object-cover [animation-delay:-12s]" />
                </div>
              </div>
              {available > 0 && (
                <div className="absolute -bottom-5 -left-3 flex animate-float items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink shadow-lift sm:-left-8">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand"><Check size={18} className="text-brand" /></span>
                  <span className="text-sm leading-tight">
                    <span className="block font-display text-lg font-bold">{available} verified</span>
                    <span className="text-muted">{available === 1 ? 'listing' : 'listings'} available now</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="relative flex h-[70vh] min-h-[440px] items-end overflow-hidden bg-ink text-white sm:h-[86vh]">
          {heroIsVideo ? (
            <video className="absolute inset-0 h-full w-full object-cover" src={site.heroUrl} autoPlay muted loop playsInline />
          ) : (
            <div
              className="absolute inset-0 h-full w-full animate-slow-zoom"
              style={{ backgroundImage: `url('${site.heroUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
          <div className="page stagger relative pb-14 sm:pb-20">
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.04] sm:text-6xl">{headline}</h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">{subline}</p>
            <div className="mt-8"><Link href={href(site, '/properties')} className="btn-primary px-6 py-3.5 text-[15px]">Browse properties <span aria-hidden="true">→</span></Link></div>
          </div>
        </section>
      )}

      {/* Numbers */}
      {stats.length > 0 && (
        <section className="border-b border-line bg-white">
          <dl className={`page grid gap-6 py-10 sm:py-12 ${stats.length === 3 ? 'sm:grid-cols-3' : stats.length === 2 ? 'sm:grid-cols-2' : ''}`}>
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 120} className="flex flex-col items-center text-center sm:border-l sm:border-line sm:first:border-l-0">
                <dt className="order-2 mt-1 text-sm font-medium text-muted">{s.label}</dt>
                <dd className="order-1 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
                  <CountUp to={s.value} suffix={s.suffix} />
                </dd>
              </Reveal>
            ))}
          </dl>
        </section>
      )}

      {/* Featured properties */}
      <section className="page py-20 sm:py-24">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="section-title mt-2">Properties worth a visit</h2>
            <p className="mt-2 text-muted">Hand-picked by our team this month.</p>
          </div>
          <Link href={href(site, '/properties')} className="link-arrow">View all properties <span aria-hidden="true">→</span></Link>
        </Reveal>
        {listings.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <Reveal key={l.id} delay={(i % 3) * 110} className="h-full"><PropertyCard site={site} listing={l} /></Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="mt-10 rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="font-semibold">New listings are being added.</p>
            <p className="mt-1 text-muted">Tell us what you are looking for and we will call you with matching options.</p>
            <Link href={href(site, '/contact')} className="btn-primary mt-5">Tell us what you need</Link>
          </Reveal>
        )}
      </section>

      {/* Services */}
      <section className="bg-mist">
        <div className="page py-20 sm:py-24">
          <Reveal>
            <p className="eyebrow">Services</p>
            <h2 className="section-title mt-2">What we do</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 100} className="h-full">
                <Link href={href(site, s.path)} className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-card transition duration-500 hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-lift">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand transition-colors duration-500 group-hover:bg-brand group-hover:text-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[s.key]}</svg>
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/70">{s.text}</p>
                  <span className="link-arrow mt-5 text-sm">Learn more <span aria-hidden="true">→</span></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="page grid gap-12 py-20 sm:py-24 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <p className="eyebrow">Why us</p>
          <h2 className="section-title mt-2">Why families{inCity} choose us</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            We have been closing deals across {localityList(site, 3)}{since}. Most of our clients come through referrals.
          </p>
        </Reveal>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {reasons.map((r, i) => (
            <Reveal key={r.title} delay={i * 100} className="group rounded-2xl border border-line p-6 transition duration-500 hover:border-brand/30 hover:shadow-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand"><Check size={16} className="text-brand" /></span>
              <dt className="mt-4 font-display text-lg font-bold">{r.title}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-ink/70">{r.text}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* Testimonials (sample quotes: demo firms only) */}
      {site.demoContent && (
        <section className="relative isolate overflow-hidden bg-ink text-white">
          <div className="absolute -right-32 top-0 -z-10 h-96 w-96 animate-glow rounded-full bg-brand/40 blur-[110px]" aria-hidden="true" />
          <div className="page py-20 sm:py-24">
            <Reveal>
              <p className="eyebrow text-accent">Clients</p>
              <h2 className="section-title mt-2">What our clients say</h2>
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 120} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition duration-500 hover:-translate-y-1 hover:bg-white/[0.07]">
                  <span className="font-display text-5xl leading-none text-accent" aria-hidden="true">“</span>
                  <blockquote className="mt-2 flex-1 text-lg leading-relaxed text-white/90">{t.quote}</blockquote>
                  <figcaption className="mt-6 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    <span className="block text-white/60">{t.detail}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Callback */}
      <section className="page grid gap-12 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="eyebrow">Talk to us</p>
          <h2 className="section-title mt-2">Get a callback</h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
            Share your number and what you are looking for. A broker who covers your preferred area will call you within one working day.
          </p>
          {site.phoneHref && (
            <p className="mt-6 text-[15px]">
              Prefer to talk now? Call <a className="font-semibold text-brand underline-offset-4 hover:underline" href={`tel:${site.phoneHref}`}>{site.phoneDisplay}</a>
            </p>
          )}
        </Reveal>
        <Reveal delay={120} className="rounded-3xl border border-line bg-white p-6 shadow-lift sm:p-8">
          <EnquiryForm firmId={site.id} source="callback" submitLabel="Request a callback" />
        </Reveal>
      </section>
    </>
  );
}

// A tick; accent colour on the dark hero, brand colour inside the light-blue badges.
function Check({ size = 14, className = 'text-accent' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none ${className}`}>
      <path d="M5 10.5l3 3 7-7" />
    </svg>
  );
}
