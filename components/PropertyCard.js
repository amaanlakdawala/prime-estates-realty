import Link from 'next/link';
import PropertyImage from './PropertyImage';
import { formatPrice, shortSpecs } from '@/lib/format';
import { site } from '@/lib/site';

export default function PropertyCard({ listing }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white">
      <Link href={`/properties/${listing.id}`} className="relative block aspect-[4/3] overflow-hidden">
        <PropertyImage src={listing.photos?.[0]} alt={listing.title} />
        <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-basalt">
          {listing.deal_type === 'rent' ? 'For rent' : 'For sale'}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="font-display text-2xl font-semibold text-teal">{formatPrice(listing.price, listing.deal_type)}</p>
        <h3 className="mt-1 font-sans text-base font-semibold leading-snug">
          <Link href={`/properties/${listing.id}`} className="hover:underline">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-muted">{listing.locality}, {site.city}</p>
        <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-sm text-basalt/80">
          {shortSpecs(listing).map((s) => (
            <li key={s} className="rounded-md bg-stone px-2.5 py-1">{s}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
