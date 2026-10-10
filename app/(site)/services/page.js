import Link from 'next/link';
import { localityList } from '@/lib/site';

export const metadata = { title: 'Services' };

const SERVICES = [
  {
    id: 'buy',
    title: 'Buying a home',
    intro: 'For first-time buyers, upgraders and investors looking at ready or under-construction homes.',
    points: ['Shortlists based on budget, commute and schools', 'Site visits grouped to save your weekends', 'Price negotiation using recent deals nearby', 'Home loan tie-ups with leading banks', 'Agreement and registration support'],
    cta: { href: '/properties?deal=buy', label: 'See properties for sale' },
  },
  {
    id: 'sell',
    title: 'Selling your property',
    intro: 'For owners who want a fair price without months of calls from casual enquirers.',
    points: ['Price assessment based on nearby transactions', 'Professional photos and listing on this site', 'Buyer screening before any visit', 'Negotiation and token amount handling', 'Documentation through to registration'],
    cta: { href: '/contact', label: 'Get a price assessment' },
  },
  {
    id: 'rent',
    title: 'Renting and letting out',
    intro: 'For tenants who want a reliable landlord, and landlords who want a reliable tenant.',
    points: ['Tenant background and employment checks', 'Registered leave and licence agreements', 'Police verification assistance', 'Move-in inspection with photos', 'Renewal reminders'],
    cta: { href: '/properties?deal=rent', label: 'See properties for rent' },
  },
  {
    id: 'commercial',
    title: 'Commercial spaces',
    intro: `For startups, clinics, retailers and growing teams across ${localityList(3)} and more.`,
    points: ['Offices, shops and showrooms on lease or sale', 'Fit-out and lock-in terms negotiated', 'Parking and power load checks', 'Title and approvals verified'],
    cta: { href: '/properties?type=office', label: 'See commercial listings' },
  },
  {
    id: 'advisory',
    title: 'Investment advisory',
    intro: 'For buyers comparing projects, localities or rental yields before they commit.',
    points: ['Locality comparison on price trends and upcoming infrastructure', 'Builder track record and RERA status checks', 'Expected rental yield estimates'],
    cta: { href: '/contact', label: 'Book a consultation' },
  },
];

export default function ServicesPage() {
  return (
    <div className="page py-14 sm:py-20">
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">Services</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Everything from the first site visit to the day you get the keys.</p>
      <div className="mt-12 divide-y divide-line border-y border-line">
        {SERVICES.map((s) => (
          <section key={s.id} id={s.id} className="grid scroll-mt-24 gap-6 py-10 md:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">{s.title}</h2>
              <p className="mt-3 max-w-md text-muted">{s.intro}</p>
              <Link href={s.cta.href} className="btn-primary mt-5">{s.cta.label}</Link>
            </div>
            <ul className="space-y-3 self-center">
              {s.points.map((p) => (
                <li key={p} className="flex gap-3 text-[16px]">
                  <svg className="mt-1 flex-none" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" stroke="#0F5C5A" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
