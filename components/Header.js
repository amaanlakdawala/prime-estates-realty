'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Logo from './Logo';
import { site } from '@/lib/site';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/properties', label: 'Properties' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="hidden bg-basalt text-white/80 lg:block">
        <div className="page flex h-9 items-center justify-between text-xs">
          <p>{site.hours}</p>
          <div className="flex items-center gap-5">
            <a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a>
            <a href={`tel:${site.phoneHref}`} className="hover:text-white">{site.phoneDisplay}</a>
          </div>
        </div>
      </div>
      <div className="page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-[15px] font-medium ${
                isActive(item.href) ? 'text-teal' : 'text-basalt/80 hover:text-basalt'
              }`}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={`tel:${site.phoneHref}`} className="btn-primary hidden py-2.5 sm:inline-flex">
            Call {site.phoneDisplay}
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line md:hidden"
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
      {open && (
        <nav id="mobile-nav" className="border-t border-line bg-white md:hidden" aria-label="Mobile">
          <div className="page flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-2 py-3 text-base font-medium ${isActive(item.href) ? 'text-teal' : 'text-basalt'}`}
              >
                {item.label}
              </Link>
            ))}
            <a href={`tel:${site.phoneHref}`} className="btn-primary mt-2">
              Call {site.phoneDisplay}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
