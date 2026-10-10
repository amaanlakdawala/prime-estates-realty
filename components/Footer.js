import Link from 'next/link';
import Logo from './Logo';
import { site } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="bg-basalt text-white/80">
      <div className="page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed">
            Helping families and businesses buy, sell and rent property across {site.city} since {site.foundedYear}.
          </p>
          {site.mahareraAgentNo && <p className="mt-4 text-sm text-white/60">MahaRERA agent registration no. {site.mahareraAgentNo}</p>}
        </div>
        <div>
          <h2 className="font-display text-base font-semibold text-white">Explore</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><Link className="hover:text-white" href="/properties?deal=buy">Properties for sale</Link></li>
            <li><Link className="hover:text-white" href="/properties?deal=rent">Properties for rent</Link></li>
            <li><Link className="hover:text-white" href="/services">Services</Link></li>
            <li><Link className="hover:text-white" href="/about">About us</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-base font-semibold text-white">Visit or call</h2>
          <address className="mt-3 space-y-2 text-[15px] not-italic">
            <p>{site.address}</p>
            <p><a className="hover:text-white" href={`tel:${site.phoneHref}`}>{site.phoneDisplay}</a></p>
            <p><a className="hover:text-white" href={`mailto:${site.email}`}>{site.email}</a></p>
            <p className="text-white/60">{site.hours}</p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page flex flex-col gap-2 py-5 text-sm text-white/55 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p>We use the details you share only to reply to your enquiry. We never sell or share them.</p>
        </div>
      </div>
    </footer>
  );
}
