import Link from 'next/link';
import { site } from '@/lib/site';

export default function Logo({ light = false }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
      {site.logoUrl ? (
        <img src={site.logoUrl} alt="" className="h-9 w-auto max-w-[120px] object-contain" />
      ) : (
        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <rect width="34" height="34" rx="8" fill={light ? '#F2B632' : '#0F5C5A'} />
          <path d="M8 24V15l9-7 9 7v9h-6v-6h-6v6z" fill={light ? '#1F2A2E' : '#fff'} />
        </svg>
      )}
      <span className={`font-display text-lg font-semibold leading-none ${light ? 'text-white' : 'text-basalt'}`}>
        {site.name}
      </span>
    </Link>
  );
}
