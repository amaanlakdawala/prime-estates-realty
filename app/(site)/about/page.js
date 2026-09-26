import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata = { title: 'About us' };

// Replace the names, roles and text below with the firm's real team.
const TEAM = [
  { name: 'Rohan Mehta', role: 'Founder and managing director', initials: 'RM' },
  { name: 'Priya Deshmukh', role: 'Head of residential sales', initials: 'PD' },
  { name: 'Amit Kulkarni', role: 'Commercial leasing', initials: 'AK' },
  { name: 'Neha Joshi', role: 'Rentals and client support', initials: 'NJ' },
];

export default function AboutPage() {
  return (
    <>
      <section className="page py-14 sm:py-20">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          A Pune brokerage built on referrals since {site.foundedYear}.
        </h1>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="prose-body space-y-5">
            <p>
              {site.name} started as a two-person office in Baner, helping IT professionals find their first homes near
              Hinjewadi. Today our team covers Pune’s western and eastern suburbs, from Wakad and Aundh to Kharadi and Hadapsar.
            </p>
            <p>
              We work with homebuyers, sellers, landlords, tenants and businesses. Whether it is a first flat or an office
              for a growing team, we visit every property ourselves, share honest feedback on price and location, and stay
              involved until the paperwork is done.
            </p>
            <p>
              We are registered with MahaRERA (agent no. {site.mahareraAgentNo}) and follow its code of conduct for real estate agents.
            </p>
          </div>
          <div className="rounded-xl bg-stone p-6">
            <h2 className="text-xl font-semibold">How we work</h2>
            <ol className="mt-4 space-y-4 text-[15px] leading-relaxed">
              <li><span className="font-semibold">1. Understand your needs.</span> Budget, locality, commute, schools, timelines.</li>
              <li><span className="font-semibold">2. Shortlist and visit.</span> Only properties we have checked ourselves.</li>
              <li><span className="font-semibold">3. Negotiate.</span> Based on recent deals in the same building or area.</li>
              <li><span className="font-semibold">4. Close.</span> Loan, agreement registration and handover support.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-stone">
        <div className="page py-14 sm:py-20">
          <h2 className="section-title">Our team</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m) => (
              <li key={m.name} className="rounded-xl bg-white p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal font-display text-xl font-semibold text-white" aria-hidden="true">
                  {m.initials}
                </div>
                <p className="mt-4 font-semibold">{m.name}</p>
                <p className="text-sm text-muted">{m.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="page py-14 text-center sm:py-20">
        <h2 className="section-title">Looking to buy, sell or rent?</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">Talk to us about what you need. The first conversation is free and carries no obligation.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/properties" className="btn-outline">Browse properties</Link>
          <Link href="/contact" className="btn-primary">Contact us</Link>
        </div>
      </section>
    </>
  );
}
