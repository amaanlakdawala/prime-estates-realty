import Link from 'next/link';
import { PLATFORM_NAME, href } from '@/lib/site';

// A firm's logo and name, linking to its home page. Without a site (sign-in page) it shows your brand.
export default function Logo({ site = null, light = false }) {
  const name = site?.name ?? PLATFORM_NAME;
  return (
    <Link href={site ? href(site) : '/'} className="group flex items-center gap-2.5" aria-label={`${name} home`}>
      {site?.logoUrl ? (
        <img src={site.logoUrl} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
      ) : (
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
          <defs>
            <linearGradient id={light ? 'logo-g-light' : 'logo-g'} x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor={light ? '#8AB4FF' : '#2B59E8'} />
              <stop offset="1" stopColor={light ? '#2B59E8' : '#1F45C2'} />
            </linearGradient>
          </defs>
          <rect width="34" height="34" rx="9" fill={light ? 'url(#logo-g-light)' : 'url(#logo-g)'} />
          <path d="M8 24V15l9-7 9 7v9h-6v-6h-6v6z" fill="#fff" />
        </svg>
      )}
      <span className={`font-display text-lg font-bold leading-none tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        {name}
      </span>
    </Link>
  );
}
