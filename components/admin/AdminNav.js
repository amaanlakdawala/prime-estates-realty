'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FIRM_LINKS = [
  { href: '/admin', label: 'Listings', match: (p) => p === '/admin' || /^\/admin\/[0-9a-f-]{36}\/edit/.test(p) },
  { href: '/admin/new', label: 'Add listing', match: (p) => p === '/admin/new' },
  { href: '/admin/enquiries', label: 'Enquiries', match: (p) => p.startsWith('/admin/enquiries') },
  { href: '/admin/calls', label: 'AI calls', match: (p) => p.startsWith('/admin/calls') },
  { href: '/admin/portal-leads', label: 'Portal leads', match: (p) => p.startsWith('/admin/portal-leads'), service: 'portalLeads' },
  { href: '/admin/listing-checks', label: 'Listing checks', match: (p) => p.startsWith('/admin/listing-checks'), service: 'listingChecks' },
  { href: '/admin/whatsapp', label: 'WhatsApp', match: (p) => p.startsWith('/admin/whatsapp'), service: 'whatsapp' },
  { href: '/admin/writeup', label: 'WhatsApp write-up', match: (p) => p.startsWith('/admin/writeup') },
  { href: '/admin/profile', label: 'Firm profile', match: (p) => p.startsWith('/admin/profile') },
];

const PLATFORM_LINKS = [
  { href: '/admin/leads', label: 'Leads', match: (p) => p.startsWith('/admin/leads') },
  { href: '/admin/firms', label: 'Firms', match: (p) => p.startsWith('/admin/firms') },
  { href: '/admin/knowledge', label: 'Towers & areas', match: (p) => p.startsWith('/admin/knowledge') },
  { href: '/admin/users', label: 'Logins', match: (p) => p.startsWith('/admin/users') },
];

// Platform admin: Firms and Logins, plus the firm pages while managing a firm.
// Firm login: only its own firm's pages. Add-on service pages show only when that service is on for the firm.
// services: { portalLeads, listingChecks, whatsapp } booleans.
export default function AdminNav({ mobile = false, isPlatformAdmin = false, hasFirm = false, services = {} }) {
  const pathname = usePathname();
  const firmLinks = FIRM_LINKS.filter((l) => !l.service || services[l.service]);
  const links = [...(isPlatformAdmin ? PLATFORM_LINKS : []), ...(hasFirm ? firmLinks : [])];
  return (
    <nav className={mobile ? 'flex flex-wrap gap-1' : 'hidden gap-1 md:flex'} aria-label="Admin">
      {links.map((l) => {
        const active = l.match(pathname);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
