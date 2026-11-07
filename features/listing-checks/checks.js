// Listing checks: Riya calls the owner of each available listing (on Sarvam), asks whether it is still available
// and at what price, and the listing is closed or re-priced from the answer. Server only.
// Placing: runListingChecks (every minute from /api/voice/process-queue) and checkListingNow (the Check now button).
// Results: handleCheckReport (Sarvam's webhook).
import { createAdminClient } from '@/lib/supabase/admin';
import { addToSarvamCampaign, sarvamCallInfo } from '@/lib/sarvam';
import { toIndianMobile } from '@/lib/voice';
import { englishAmount } from '@/lib/spoken-amount';
import { formatPrice, typeLabel } from '@/lib/format';
import { revalidateSite } from '@/app/actions/site';
import { MISSED } from '@/features/sales-caller/format';

export const CHECK_WEBHOOK_PATH = '/api/listing-checks/webhook';

// Calls go through the Sarvam campaign "Riya listing checks" (agent "Riya listing check", prompt.md), for the same
// reason as the sales caller: this account may call only OTP-verified numbers with single API calls.
const CAMPAIGN_ID = () => process.env.LISTING_CHECK_SARVAM_CAMPAIGN_ID;

// Owners are business contacts of the firm: office hours, Monday to Saturday, one call at a time per firm.
export const RULES = {
  days: [1, 2, 3, 4, 5, 6],   // Mon–Sat (0 = Sunday)
  startHour: 10,              // IST
  endHour: 19,                // last call starts before 7 pm
  retryAfterMissedDays: 1,    // not answered: try again the next day…
  missedInARow: 3,            // …up to 3 times, then wait the firm's usual number of days
};

const RESULT_FIELDS = ['still_available', 'new_price', 'available_from', 'owner_note', 'callback_time', 'do_not_call'];
const STALE_MINUTES = 60;
const DAY = 864e5;

function indiaClock() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hour: Number(parts.hour) };
}
export function withinCheckHours() {
  const { day, hour } = indiaClock();
  return RULES.days.includes(day) && hour >= RULES.startHour && hour < RULES.endHour;
}
export const CHECK_HOURS_TEXT = `Monday to Saturday, ${RULES.startHour} am to ${RULES.endHour - 12} pm`;

// "2 BHK flat in Powai", "office in Andheri East".
export function propertyWords(l) {
  const kind = typeLabel(l.property_type).toLowerCase();
  return `${l.bhk && ['flat', 'villa'].includes(l.property_type) ? `${l.bhk} BHK ` : ''}${kind} in ${l.locality}`;
}

function callVariables(firm, listing, owner) {
  const first = (owner.owner_name ?? '').trim().split(/\s+/)[0];
  return {
    firm_name: firm.name,
    owner_greeting: first ? `${first} ji` : 'ji',
    property: propertyWords(listing),
    deal: listing.deal_type === 'rent' ? 'rent' : 'sale',
    price_words: `${englishAmount(listing.price)}${listing.deal_type === 'rent' ? ' per month' : ''}`,
    today: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
  };
}

const monthStart = () => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

// When this listing is next due for a check, from its earlier checks (newest first). null = never: due now.
export function nextCheckAt(history, everyDays) {
  const placed = history.filter((c) => c.attempt_id || c.status === 'placing');
  if (!placed.length) return null;
  const last = new Date(placed[0].created_at).getTime();
  if (placed[0].status === 'placing') return new Date(last + DAY); // still going
  if (placed[0].status === 'done') return new Date(last + everyDays * DAY);
  const missed = placed.findIndex((c) => c.status === 'done');
  const missedRun = missed === -1 ? placed.length : missed;
  return new Date(last + (missedRun >= RULES.missedInARow ? everyDays : RULES.retryAfterMissedDays) * DAY);
}

// The firm's available listings with an owner number, each with its check history and when it is due.
export async function listingsToCheck(firm, db = createAdminClient()) {
  const [{ data: listings }, { data: owners }] = await Promise.all([
    db.from('listings').select('id, title, locality, bhk, property_type, deal_type, price, status').eq('firm_id', firm.id).eq('status', 'available')
      .order('created_at', { ascending: false }).limit(1000),
    db.from('listing_owners').select('*').eq('firm_id', firm.id),
  ]);
  const ownerOf = new Map((owners ?? []).map((o) => [o.listing_id, o]));
  const withOwner = (listings ?? []).filter((l) => toIndianMobile(ownerOf.get(l.id)?.owner_phone) && !ownerOf.get(l.id)?.checks_paused);
  const { data: checks } = withOwner.length
    ? await db.from('listing_checks').select('listing_id, created_at, status, attempt_id').in('listing_id', withOwner.map((l) => l.id))
      .gte('created_at', new Date(Date.now() - 90 * DAY).toISOString()).order('created_at', { ascending: false })
    : { data: [] };
  return {
    total: listings?.length ?? 0,
    missingOwner: (listings ?? []).filter((l) => !toIndianMobile(ownerOf.get(l.id)?.owner_phone)).length,
    paused: (listings ?? []).filter((l) => ownerOf.get(l.id)?.checks_paused).length,
    items: withOwner.map((l) => {
      const due = nextCheckAt((checks ?? []).filter((c) => c.listing_id === l.id), firm.listing_check_days ?? 7);
      return { listing: l, owner: ownerOf.get(l.id), dueAt: due };
    }).sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0)),
  };
}

// Places one check call. Throws with a reason in words when it can't.
async function placeCheck(db, firm, listing, owner) {
  if (!CAMPAIGN_ID()) throw new Error('Listing checks are not set up in Sarvam yet (LISTING_CHECK_SARVAM_CAMPAIGN_ID is missing).');
  const toNumber = toIndianMobile(owner.owner_phone);
  if (!toNumber) throw new Error('No valid Indian mobile number for the owner.');
  const { count } = await db.from('listing_checks').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id)
    .not('attempt_id', 'is', null).gte('created_at', monthStart());
  if ((count ?? 0) >= (firm.listing_checks_monthly_limit ?? 200)) throw new Error(`This month's limit of ${firm.listing_checks_monthly_limit} check calls is reached.`);

  const { data: row, error } = await db.from('listing_checks').insert({ firm_id: firm.id, listing_id: listing.id, to_number: toNumber }).select('id').single();
  if (error) throw new Error(error.message);
  try {
    // The row id travels as the user identifier and comes back on the webhook.
    const { cohortId } = await addToSarvamCampaign({ campaignId: CAMPAIGN_ID(), toNumber, identifier: row.id, variables: callVariables(firm, listing, owner) });
    await db.from('listing_checks').update({ attempt_id: `cohort:${cohortId}` }).eq('id', row.id);
  } catch (err) {
    await db.from('listing_checks').update({ status: 'failed', error: err.message }).eq('id', row.id);
    throw err;
  }
  return row.id;
}

// "Check now" on the Listing checks page.
export async function checkListingNow(firm, listingId) {
  if (!withinCheckHours()) throw new Error(`Check calls go out ${CHECK_HOURS_TEXT}.`);
  const db = createAdminClient();
  const [{ data: listing }, { data: owner }, { count: busy }] = await Promise.all([
    db.from('listings').select('*').eq('id', listingId).eq('firm_id', firm.id).maybeSingle(),
    db.from('listing_owners').select('*').eq('listing_id', listingId).eq('firm_id', firm.id).maybeSingle(),
    db.from('listing_checks').select('id', { count: 'exact', head: true }).eq('listing_id', listingId).eq('status', 'placing'),
  ]);
  if (!listing) throw new Error('Unknown listing.');
  if (listing.status !== 'available') throw new Error('This listing is already closed.');
  if (!owner?.owner_phone) throw new Error('Add the owner\'s mobile number on the listing first.');
  if (owner.checks_paused) throw new Error('The owner asked not to be called; checks are paused for this listing.');
  if (busy) throw new Error('A check call for this listing is already on its way.');
  return placeCheck(db, firm, listing, owner);
}

// One run for every firm with the service on: at most one call per firm, only when none of its calls is still going.
export async function runListingChecks() {
  if (!CAMPAIGN_ID()) return { done: 'not set up' };
  if (!withinCheckHours()) return { done: 'outside hours' };
  const db = createAdminClient();
  await db.from('listing_checks').update({ status: 'failed', error: 'No result from Sarvam within an hour.' })
    .eq('status', 'placing').lt('created_at', new Date(Date.now() - STALE_MINUTES * 60e3).toISOString());

  const { data: firms } = await db.from('firms').select('*').eq('listing_checks_enabled', true).eq('active', true);
  const report = { placed: 0, busy: 0, nothingDue: 0, failed: [] };
  for (const firm of firms ?? []) {
    const { count: busy } = await db.from('listing_checks').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).eq('status', 'placing');
    if (busy) { report.busy++; continue; }
    const { items } = await listingsToCheck(firm, db);
    const due = items.find((i) => !i.dueAt || i.dueAt.getTime() <= Date.now());
    if (!due) { report.nothingDue++; continue; }
    try {
      await placeCheck(db, firm, due.listing, due.owner);
      report.placed++;
    } catch (err) {
      report.failed.push(`${firm.slug}: ${err.message}`);
    }
  }
  return report;
}

const said = (v) => String(v ?? '').trim().toLowerCase();
const isYes = (v) => v === true || /^(yes|haan|han|available|true)/.test(said(v));
const isNo = (v) => v === false || /^(no|nahi|nahin|not|false|sold|rented)/.test(said(v));

// Sarvam's end-of-call report: save it, then close or re-price the listing from what the owner said.
export async function handleCheckReport(report) {
  const db = createAdminClient();
  const byRow = /^[0-9a-f-]{36}$/i.test(report.user_identifier ?? '') && report.user_identifier;
  const { data: check } = byRow
    ? await db.from('listing_checks').select('*').eq('id', byRow).maybeSingle()
    : await db.from('listing_checks').select('*').eq('attempt_id', report.attempt_id).maybeSingle();
  if (!check) return false;
  if (report.next_action_status) return true; // Sarvam will try again; the last attempt carries the result

  const info = sarvamCallInfo(report, RESULT_FIELDS);
  if (info.missed) info.error = MISSED[info.missed][1];
  const r = info.result ?? {};
  const [{ data: listing }, { data: firm }] = await Promise.all([
    check.listing_id ? db.from('listings').select('*').eq('id', check.listing_id).maybeSingle() : { data: null },
    db.from('firms').select('slug').eq('id', check.firm_id).maybeSingle(),
  ]);

  let outcome = '';
  const notes = [r.owner_note && `Owner: ${r.owner_note}`, r.callback_time && `Call back: ${r.callback_time}`, r.available_from && `Available from: ${r.available_from}`].filter(Boolean);
  if (info.status === 'done' && listing) {
    if (r.do_not_call) {
      await db.from('listing_owners').update({ checks_paused: true, updated_at: new Date().toISOString() }).eq('listing_id', listing.id);
      outcome = 'The owner asked not to be called again: checks paused for this listing.';
    } else if (isNo(r.still_available) && listing.status === 'available') {
      const closed = listing.deal_type === 'rent' ? 'rented' : 'sold';
      await db.from('listings').update({ status: closed }).eq('id', listing.id);
      outcome = `No longer available: marked ${closed === 'rented' ? 'Rented' : 'Sold'} and taken off the website and AI search.`;
    } else if (isYes(r.still_available)) {
      const price = Math.round(Number(String(r.new_price ?? '').replace(/[^\d.]/g, '')) || 0);
      const sane = price > 0 && price !== Number(listing.price) && price >= listing.price * 0.3 && price <= listing.price * 3;
      if (sane) {
        await db.from('listings').update({ price }).eq('id', listing.id);
        outcome = `Still available, new price: ${formatPrice(price, listing.deal_type)} (was ${formatPrice(listing.price, listing.deal_type)}). Listing updated.`;
      } else {
        outcome = price > 0 && price !== Number(listing.price)
          ? `Still available. The owner mentioned ${formatPrice(price, listing.deal_type)}, which looks unlikely, so the price was not changed: please check.`
          : 'Still available at the same price.';
      }
    } else {
      outcome = 'No clear answer from the owner: please check yourself.';
    }
    if (outcome.includes('Listing updated') || outcome.includes('taken off')) await revalidateSite(firm?.slug);
  }
  await db.from('listing_checks').update({
    attempt_id: report.attempt_id,
    status: info.status, duration_secs: info.duration_secs, result: info.result, transcript: info.transcript, error: info.error,
    outcome: [outcome, ...notes].filter(Boolean).join(' ').slice(0, 600),
  }).eq('id', check.id);
  return true;
}
