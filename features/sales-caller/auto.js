// Automatic sales calling: every 5 minutes in calling hours (supabase/cron/sales_caller_cron.sql → /api/sales-calls/run), place the next
// call to the best lead that may be called, one call at a time, with no daily limit.
import { createAdminClient } from '@/lib/supabase/admin';
import { callBlocker, placeLeadCall } from './calls';

const DEFAULTS = { enabled: false, statuses: ['contacted'] };
const STALE_MINUTES = 60; // a call Sarvam never reported on is closed after this
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();

export async function getAutoSettings(db = createAdminClient()) {
  const { data } = await db.from('sales_caller_settings').select('enabled, statuses').eq('id', 1).maybeSingle();
  return { ...DEFAULTS, ...data };
}

// Supabase returns at most 1,000 rows per request, so longer lists are read in pages.
async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await query().range(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

// The leads automatic calling would call next, best first (score, then oldest), with nothing blocking them.
// Reads every candidate lead and every placed call: at ~110 calls a day, the best few hundred leads are all inside
// their 3-day gap at once, and looking only at those stopped calling while hundreds of others were waiting.
export async function nextUp(settings, limit = 10, db = createAdminClient()) {
  if (!settings.statuses.length) return [];
  const [leads, calls] = await Promise.all([
    allRows(() => db.from('leads').select('*').in('status', settings.statuses).order('score', { ascending: false }).order('created_at').order('id')),
    allRows(() => db.from('sales_calls').select('lead_id, created_at').not('attempt_id', 'is', null).order('created_at', { ascending: false }).order('id')),
  ]);
  if (!leads.length) return [];
  const byLead = new Map();
  for (const c of calls) byLead.set(c.lead_id, [...(byLead.get(c.lead_id) ?? []), c]);
  const history = (id) => byLead.get(id) ?? [];
  // The calling-hours check is left out here, so the list also shows who is next outside hours.
  return leads.filter((l) => {
    const why = callBlocker(l, history(l.id));
    return !why || why.startsWith('AI calls go out');
  }).slice(0, limit);
}

// One run: returns what it did, for the cron log.
export async function runAutoCalls() {
  const db = createAdminClient();
  const settings = await getAutoSettings(db);
  if (!settings.enabled) return { done: 'switched off' };

  await db.from('sales_calls').update({ status: 'failed', error: 'No result from Sarvam within an hour.' })
    .eq('status', 'placing').lt('created_at', minutesAgo(STALE_MINUTES));
  const { count: busy } = await db.from('sales_calls').select('id', { count: 'exact', head: true }).eq('status', 'placing');
  if ((busy ?? 0) > 0) return { done: 'a call is still in progress' };

  const [lead] = await nextUp(settings, 1, db);
  if (!lead) return { done: 'nobody to call' };
  try {
    await placeLeadCall(lead.id); // checks the calling hours and every other rule again
    return { done: 'placed', lead: lead.name };
  } catch (err) {
    // Out of Sarvam credit: every further call would fail the same way, so switch automatic calling off.
    if (err.message.includes('HTTP 402')) await db.from('sales_caller_settings').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', 1);
    return { done: 'not placed', lead: lead.name, reason: err.message };
  }
}
