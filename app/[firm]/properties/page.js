import Link from 'next/link';
import { redirect } from 'next/navigation';
import Reveal from '@/components/Reveal';
import PropertyCard from '@/components/PropertyCard';
import { getSiteBySlug, requireSite } from '@/lib/firm';
import { createPublicClient } from '@/lib/supabase/public';
import { href, PROPERTY_TYPES, BUY_BUDGETS, RENT_BUDGETS } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const site = await getSiteBySlug((await params).firm);
  return { title: site?.city ? `Properties in ${site.city}` : 'Properties' };
}

const PAGE_SIZE = 24; // a firm with hundreds of listings still sends a light page

const SORTS = {
  newest: { column: 'created_at', ascending: false, label: 'Newest first' },
  price_asc: { column: 'price', ascending: true, label: 'Price: low to high' },
  price_desc: { column: 'price', ascending: false, label: 'Price: high to low' },
};

export default async function PropertiesPage(props) {
  const site = await requireSite(props.params);
  const searchParams = await props.searchParams;
  const deal = ['buy', 'rent'].includes(searchParams.deal) ? searchParams.deal : '';
  const locality = searchParams.locality ?? '';
  const type = searchParams.type ?? '';
  const bhk = searchParams.bhk ?? '';
  const min = searchParams.min ?? '';
  const max = searchParams.max ?? '';
  const sort = SORTS[searchParams.sort] ? searchParams.sort : 'newest';
  const page = Math.max(1, Number.parseInt(searchParams.page, 10) || 1);

  let listings = [];
  let total = 0;
  let failed = false;
  let pastEnd = false; // a page number beyond the last page
  try {
    let query = createPublicClient().from('listings').select('*', { count: 'exact' }).eq('firm_id', site.id).eq('status', 'available');
    if (deal) query = query.eq('deal_type', deal);
    if (locality) query = query.eq('locality', locality);
    if (type) query = query.eq('property_type', type);
    if (bhk) query = bhk === '4' ? query.gte('bhk', 4) : query.eq('bhk', Number(bhk));
    if (min) query = query.gte('price', Number(min));
    if (max) query = query.lte('price', Number(max));
    query = query.order(SORTS[sort].column, { ascending: SORTS[sort].ascending }).order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, count, error } = await query;
    if (error?.code === 'PGRST103') pastEnd = true; // the database says the range is past the end
    else if (error) throw error;
    listings = data ?? [];
    total = count ?? listings.length;
  } catch {
    failed = true;
  }

  const budgets = deal === 'rent' ? RENT_BUDGETS : BUY_BUDGETS;
  const tabHref = (d) => {
    const p = new URLSearchParams();
    if (d) p.set('deal', d);
    if (locality) p.set('locality', locality);
    if (type) p.set('type', type);
    if (bhk) p.set('bhk', bhk);
    return href(site, `/properties${p.toString() ? `?${p}` : ''}`);
  };
  const hasFilters = locality || type || bhk || min || max;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // The same filters on another page of results.
  const pageHref = (n) => {
    const p = new URLSearchParams(Object.entries({ deal, locality, type, bhk, min, max, sort: sort === 'newest' ? '' : sort }).filter(([, v]) => v));
    if (n > 1) p.set('page', String(n));
    return href(site, `/properties${p.toString() ? `?${p}` : ''}`);
  };
  if (pastEnd || (!failed && total > 0 && page > pages)) redirect(pageHref(pastEnd ? 1 : pages)); // past the last page

  return (
    <div className="page py-10 sm:py-14">
      <h1 className="animate-fade-up text-4xl font-bold sm:text-5xl">
        {deal === 'rent' ? 'Properties for rent' : deal === 'buy' ? 'Properties for sale' : 'All properties'}
        {locality ? ` in ${locality}` : site.city ? ` in ${site.city}` : ''}
      </h1>

      <nav className="mt-6 flex gap-2" aria-label="Buy or rent">
        {[['', 'All'], ['buy', 'Buy'], ['rent', 'Rent']].map(([d, label]) => (
          <Link key={label} href={tabHref(d)} className={`rounded-full border px-5 py-2 text-sm font-semibold transition duration-300 ${deal === d ? 'border-brand bg-brand text-white shadow-[0_8px_20px_-8px_rgb(43_89_232_/_0.6)]' : 'border-line text-ink hover:-translate-y-0.5 hover:border-ink/40'}`} aria-current={deal === d ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-6 grid animate-fade-up gap-3 rounded-2xl border border-line bg-white p-4 shadow-card [animation-delay:0.1s] sm:grid-cols-3 sm:p-5 lg:grid-cols-6">
        {deal && <input type="hidden" name="deal" value={deal} />}
        <label className="block">
          <span className="field-label">Locality</span>
          <select name="locality" defaultValue={locality} className="field">
            <option value="">All localities</option>
            {site.localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select name="type" defaultValue={type} className="field">
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">BHK</span>
          <select name="bhk" defaultValue={bhk} className="field">
            <option value="">Any</option>
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
            <option value="4">4+ BHK</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Min price</span>
          <select name="min" defaultValue={min} className="field">
            <option value="">No minimum</option>
            {budgets.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Max price</span>
          <select name="max" defaultValue={max} className="field">
            <option value="">No maximum</option>
            {budgets.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Sort by</span>
          <select name="sort" defaultValue={sort} className="field">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
        <div className="flex gap-3 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="btn-primary">Apply filters</button>
          {hasFilters && <Link href={href(site, deal ? `/properties?deal=${deal}` : '/properties')} className="btn-outline">Clear filters</Link>}
        </div>
      </form>

      {failed ? (
        <p className="mt-10 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">
          Listings could not be loaded right now. Refresh the page{site.phoneDisplay ? `, or call us on ${site.phoneDisplay}` : ''}.
        </p>
      ) : listings.length ? (
        <>
          <p className="mt-8 text-sm text-muted">
            {total} {total === 1 ? 'property' : 'properties'} found
            {pages > 1 && ` · showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => <Reveal key={l.id} delay={(i % 3) * 90} className="h-full"><PropertyCard site={site} listing={l} /></Reveal>)}
          </div>
          {pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pages">
              {page > 1 ? <Link href={pageHref(page - 1)} className="btn-outline" rel="prev">← Previous</Link> : <span className="btn-outline pointer-events-none opacity-40" aria-hidden="true">← Previous</span>}
              <span className="text-sm text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className="btn-outline" rel="next">Next →</Link> : <span className="btn-outline pointer-events-none opacity-40" aria-hidden="true">Next →</span>}
            </nav>
          )}
        </>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-semibold">No properties match these filters.</p>
          <p className="mt-1 text-muted">Try a wider budget or another locality, or tell us what you need and we will find it.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href={href(site, '/properties')} className="btn-outline">Clear all filters</Link>
            <Link href={href(site, '/contact')} className="btn-primary">Tell us what you need</Link>
          </div>
        </div>
      )}
    </div>
  );
}
