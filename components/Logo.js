import Link from 'next/link';
import { PLATFORM_NAME, href } from '@/lib/site';

// A firm's logo and name, linking to its home page. Without a site (sign-in page) it shows your brand.
export default function Logo({ site = null, light = false }) {
  const name = site?.name ?? PLATFORM_NAME;
  return (
    <Link href={site ? href(site) : '/'} className="flex items-center gap-2.5" aria-label={`${name} home`}>
      {site?.logoUrl ? (
        <img src={site.logoUrl} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
      ) : (
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <rect width="34" height="34" rx="8" fill={light ? '#F2B632' : '#0F5C5A'} />
          <path d="M8 24V15l9-7 9 7v9h-6v-6h-6v6z" fill={light ? '#1F2A2E' : '#fff'} />
        </svg>
      )}
      <span className={`font-display text-lg font-semibold leading-none ${light ? 'text-white' : 'text-basalt'}`}>
        {name}
      </span>
    </Link>
  );
}
