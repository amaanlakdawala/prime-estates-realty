'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Listings', match: (p) => p === '/admin' || /^\/admin\/[^/]+\/edit/.test(p) },
  { href: '/admin/new', label: 'Add listing', match: (p) => p === '/admin/new' },
  { href: '/admin/enquiries', label: 'Enquiries', match: (p) => p.startsWith('/admin/enquiries') },
];

const ADMIN_ONLY_LINK = { href: '/admin/users', label: 'Team', match: (p) => p.startsWith('/admin/users') };

export default function AdminNav({ mobile = false, isAdmin = false }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_ONLY_LINK] : LINKS;
  return (
    <nav className={mobile ? 'flex gap-1' : 'hidden gap-1 md:flex'} aria-label="Admin">
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
