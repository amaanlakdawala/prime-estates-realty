import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { requireSite } from '@/lib/firm';
import { href, localityList } from '@/lib/site';

export const metadata = { title: 'About us' };
// Cached like the home page (rebuilt every 5 minutes or after the firm's profile changes).
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

// SAMPLE team, shown only for demo firms (demo_content). A real firm's site never shows it.
const TEAM = [
  { name: 'Rohan Mehta', role: 'Founder and managing director', initials: 'RM' },
  { name: 'Priya Deshmukh', role: 'Head of residential sales', initials: 'PD' },
  { name: 'Amit Kulkarni', role: 'Commercial leasing', initials: 'AK' },
  { name: 'Neha Joshi', role: 'Rentals and client support', initials: 'NJ' },
];

export default async function AboutPage({ params }) {
  const site = await requireSite(params);
  const firstArea = site.localities[0] ?? site.city;
  return (
    <>
      <section className="page py-14 sm:py-20">
        <h1 className="max-w-3xl animate-fade-up text-4xl font-bold leading-tight sm:text-5xl">
          A {site.city ? `${site.city} ` : ''}brokerage built on referrals{site.foundedYear ? ` since ${site.foundedYear}` : ''}.
        </h1>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="prose-body space-y-5">
            <p>
              {site.name} started as a small office{firstArea ? ` in ${firstArea}` : ''}, helping families find homes close to
              work and school. Today our team covers {site.city ? `${site.city}, including ` : ''}{localityList(site, 4)}.
            </p>
            <p>
              We work with homebuyers, sellers, landlords, tenants and businesses. Whether it is a first flat or an office
              for a growing team, we visit every property ourselves, share honest feedback on price and location, and stay
              involved until the paperwork is done.
            </p>
            {site.mahareraAgentNo && (
              <p>
                We are registered with MahaRERA (agent no. {site.mahareraAgentNo}) and follow its code of conduct for real estate agents.
              </p>
            )}
          </div>
          <Reveal className="rounded-2xl border border-line bg-mist p-6">
            <h2 className="text-xl font-semibold">How we work</h2>
            <ol className="mt-4 space-y-4 text-[15px] leading-relaxed">
              <li><span className="font-semibold">1. Understand your needs.</span> Budget, locality, commute, schools, timelines.</li>
              <li><span className="font-semibold">2. Shortlist and visit.</span> Only properties we have checked ourselves.</li>
              <li><span className="font-semibold">3. Negotiate.</span> Based on recent deals in the same building or area.</li>
              <li><span className="font-semibold">4. Close.</span> Loan, agreement registration and handover support.</li>
            </ol>
          </Reveal>
        </div>
      </section>

      {site.demoContent && (
        <section className="bg-mist">
          <div className="page py-14 sm:py-20">
            <h2 className="section-title">Our team</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {TEAM.map((m) => (
                <li key={m.name} className="rounded-2xl border border-line bg-white p-6 shadow-card transition duration-500 hover:-translate-y-1 hover:shadow-lift">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark font-display text-xl font-bold text-white" aria-hidden="true">
                    {m.initials}
                  </div>
                  <p className="mt-4 font-semibold">{m.name}</p>
                  <p className="text-sm text-muted">{m.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="page py-14 text-center sm:py-20">
        <h2 className="section-title">Looking to buy, sell or rent?</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">Talk to us about what you need. The first conversation is free and carries no obligation.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={href(site, '/properties')} className="btn-outline">Browse properties</Link>
          <Link href={href(site, '/contact')} className="btn-primary">Contact us</Link>
        </div>
      </section>
    </>
  );
}
