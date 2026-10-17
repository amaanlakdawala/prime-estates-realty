import Link from 'next/link';
import PropertyImage from './PropertyImage';
import { formatPrice, shortSpecs } from '@/lib/format';
import { href } from '@/lib/site';

export default function PropertyCard({ site, listing }) {
  const url = href(site, `/properties/${listing.id}`);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition duration-500 ease-out hover:-translate-y-1.5 hover:border-transparent hover:shadow-lift">
      <Link href={url} className="relative block aspect-[4/3] overflow-hidden bg-mist">
        <PropertyImage src={listing.photos?.[0]} alt={listing.title} className="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
        <span className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-ink shadow-sm backdrop-blur">
          {listing.deal_type === 'rent' ? 'For rent' : 'For sale'}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="font-display text-2xl font-bold tracking-tight text-brand">{formatPrice(listing.price, listing.deal_type)}</p>
        <h3 className="mt-1 font-sans text-base font-semibold leading-snug">
          <Link href={url} className="after:absolute after:inset-0">{listing.title}</Link>
        </h3>
        <p className="mb-4 mt-1 text-sm text-muted">{[listing.locality, site.city].filter(Boolean).join(', ')}</p>
        <ul className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4 text-sm text-ink/75">
          {shortSpecs(listing).map((s) => (
            <li key={s} className="rounded-lg bg-mist px-2.5 py-1">{s}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
