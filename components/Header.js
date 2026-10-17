'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logo from './Logo';
import { href } from '@/lib/site';

const NAV = [
  { path: '/', label: 'Home' },
  { path: '/properties', label: 'Properties' },
  { path: '/services', label: 'Services' },
  { path: '/about', label: 'About us' },
  { path: '/contact', label: 'Contact' },
];

export default function Header({ site }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const links = NAV.map((item) => ({ ...item, href: href(site, item.path) }));
  const isActive = (item) => (item.path === '/' ? pathname === item.href : pathname.startsWith(item.href));

  // A soft shadow once the page scrolls, so the header lifts off the content.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={`sticky top-0 z-40 border-b bg-white/85 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? 'border-line shadow-[0_8px_30px_-12px_rgb(11_19_36_/_0.18)]' : 'border-transparent'}`}>
      <div className="hidden bg-ink text-white/70 lg:block">
        <div className="page flex h-9 items-center justify-between text-xs">
          <p>{site.hours}</p>
          <div className="flex items-center gap-5">
            {site.email && <a href={`mailto:${site.email}`} className="transition-colors hover:text-white">{site.email}</a>}
            {site.phoneHref && <a href={`tel:${site.phoneHref}`} className="transition-colors hover:text-white">{site.phoneDisplay}</a>}
          </div>
        </div>
      </div>
      <div className="page flex h-[68px] items-center justify-between gap-4">
        <Logo site={site} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((item) => (
            <Link
              key={item.path}
              href={item.href}
              className={`group relative rounded-md px-3 py-2 text-[15px] font-medium transition-colors ${isActive(item) ? 'text-brand' : 'text-ink/70 hover:text-ink'}`}
              aria-current={isActive(item) ? 'page' : undefined}
            >
              {item.label}
              <span className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-brand transition-transform duration-300 ${isActive(item) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {site.phoneHref && (
            <a href={`tel:${site.phoneHref}`} className="btn-primary hidden py-2.5 sm:inline-flex">
              Call {site.phoneDisplay}
            </a>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line transition hover:border-ink/40 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu: slides open (grid rows animate from 0 to the content's height). */}
      <div id="mobile-nav" className={`grid border-t bg-white transition-[grid-template-rows,border-color] duration-300 ease-out md:hidden ${open ? 'grid-rows-[1fr] border-line' : 'grid-rows-[0fr] border-transparent'}`}>
        <nav className="overflow-hidden" aria-label="Mobile" inert={!open}>
          <div className="page flex flex-col py-3">
            {links.map((item) => (
              <Link
                key={item.path}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-2 py-3 text-base font-medium ${isActive(item) ? 'text-brand' : 'text-ink'}`}
              >
                {item.label}
              </Link>
            ))}
            {site.phoneHref && (
              <a href={`tel:${site.phoneHref}`} className="btn-primary mt-2">
                Call {site.phoneDisplay}
              </a>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
