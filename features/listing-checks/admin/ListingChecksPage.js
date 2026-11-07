import Link from 'next/link';
import { requireFirm } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime, formatPrice } from '@/lib/format';
import { minutes } from '@/features/sales-caller/format';
import { CHECK_HOURS_TEXT, listingsToCheck, propertyWords } from '../checks';
import CheckNowButton from './CheckNowButton';

const STATUS = {
  placing: ['Calling…', 'bg-accent/20'],
  done: ['Answered', 'bg-brand-light text-brand-dark'],
  no_answer: ['Not answered', 'bg-mist text-muted'],
  failed: ['Failed', 'bg-red-50 text-red-800'],
};

// Firm page: which listings Riya checks with their owners, what is due, and what each call found.
export default async function ListingChecksPage() {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const db = createAdminClient();
  const { data: firm } = await db.from('firms').select('*').eq('id', ctx.firm.id).single();

  if (!firm?.listing_checks_enabled) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold">Listing checks</h1>
        <p className="mt-3 text-muted">
          Riya calls your property owners every week to check each listing is still available and at what price. This service isn&apos;t switched on for your firm.{' '}
          {ctx.isPlatformAdmin ? <Link href={`/admin/firms/${firm.id}`} className="font-semibold text-brand underline">Switch it on under Firms → this firm.</Link> : 'Contact us to switch it on.'}
        </p>
      </div>
    );
  }

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ items, total, missingOwner, paused }, { data: checks }, { count: used }] = await Promise.all([
    listingsToCheck(firm, db),
    db.from('listing_checks').select('*, listings(id, title, locality, bhk, property_type, deal_type, price, status)').eq('firm_id', firm.id)
      .order('created_at', { ascending: false }).limit(50),
    db.from('listing_checks').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).not('attempt_id', 'is', null).gte('created_at', monthStart.toISOString()),
  ]);
  const now = Date.now();
  const due = items.filter((i) => !i.dueAt || i.dueAt.getTime() <= now);
  const upcoming = items.filter((i) => i.dueAt && i.dueAt.getTime() > now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Listing checks</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Riya calls the owner of each available listing every {firm.listing_check_days} days and asks if it is still available and at what price.
            When the owner says it&apos;s gone, the listing is marked Sold or Rented; a new price is updated on the listing. Clients only hear about properties that really are available.
          </p>
        </div>
        <div className="text-sm">
          <p className="text-muted">Check calls this month</p>
          <p className="font-display text-2xl font-semibold">{used ?? 0}<span className="text-base text-muted"> / {firm.listing_checks_monthly_limit}</span></p>
        </div>
      </div>

      <p className="text-sm text-muted">
        Calls go out {CHECK_HOURS_TEXT}, one at a time. Add the owner&apos;s name and mobile number on each listing (Listings → Edit → Owner).
        {missingOwner > 0 && <> <span className="font-semibold text-ink">{missingOwner} of your {total} available listings have no owner number yet</span>, so they aren&apos;t checked.</>}
        {paused > 0 && <> {paused} paused because the owner asked not to be called.</>}
      </p>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Due now <span className="text-base font-normal text-muted">({due.length})</span></h2>
        {!due.length ? (
          <p className="mt-3 text-sm text-muted">Nothing due. {upcoming[0] ? `Next check: ${formatDateTime(upcoming[0].dueAt.toISOString())}.` : 'Add owner numbers on your listings to start.'}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {due.slice(0, 30).map(({ listing, owner }) => (
              <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <Link href={`/admin/${listing.id}/edit`} className="font-medium hover:underline">{listing.title}</Link>
                  <span className="block text-muted">{propertyWords(listing)} · {formatPrice(listing.price, listing.deal_type)} · owner {owner.owner_name || owner.owner_phone}</span>
                </span>
                <CheckNowButton listingId={listing.id} />
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 0 && <p className="mt-3 text-sm text-muted">{upcoming.length} more listing{upcoming.length === 1 ? '' : 's'} checked recently; next due {formatDateTime(upcoming[0].dueAt.toISOString())}.</p>}
      </section>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Recent checks</h2>
        {!checks?.length ? (
          <p className="mt-3 text-sm text-muted">No check calls yet. Results appear here a minute or two after each call.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {checks.map((c) => {
              const [label, tone] = STATUS[c.status] ?? STATUS.placing;
              return (
                <li key={c.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                    {c.listings ? <Link href={`/admin/${c.listings.id}/edit`} className="font-medium hover:underline">{c.listings.title}</Link> : <span className="text-muted">Deleted listing</span>}
                    <span className="text-muted">{formatDateTime(c.created_at)}{c.duration_secs ? ` · ${minutes(c.duration_secs)}` : ''}</span>
                  </div>
                  {(c.outcome || c.error) && <p className="mt-1">{c.outcome || c.error}</p>}
                  {c.transcript?.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-brand">Conversation</summary>
                      <div className="mt-2 space-y-1 rounded-lg bg-mist p-3">
                        {c.transcript.map((t, i) => <p key={i}><span className="font-semibold">{t.role === 'agent' ? 'Riya' : 'Owner'}:</span> {t.text}</p>)}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
