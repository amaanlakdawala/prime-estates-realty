// Automatic sales calling: every 10 minutes in calling hours (supabase/cron/sales_caller_cron.sql → /api/sales-calls/run), place the next
// call to the best lead that may be called, one call at a time, up to the daily number set on the tracking page.
import { createAdminClient } from '@/lib/supabase/admin';
import { RULES, callBlocker, placeLeadCall } from './calls';

const DEFAULTS = { enabled: false, statuses: ['contacted'], per_day: 20 };
const STALE_MINUTES = 60; // a call Sarvam never reported on is closed after this
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();

export async function getAutoSettings(db = createAdminClient()) {
  const { data } = await db.from('sales_caller_settings').select('enabled, statuses, per_day').eq('id', 1).maybeSingle();
  return { ...DEFAULTS, ...data };
}

// The leads automatic calling would call next, best first (score, then oldest), with nothing blocking them.
export async function nextUp(settings, limit = 10, db = createAdminClient()) {
  if (!settings.statuses.length) return [];
  const { data: leads } = await db.from('leads').select('*').in('status', settings.statuses)
    .order('score', { ascending: false }).order('created_at').limit(300);
  if (!leads?.length) return [];
  const { data: calls } = await db.from('sales_calls').select('lead_id, created_at').in('lead_id', leads.map((l) => l.id))
    .not('attempt_id', 'is', null).order('created_at', { ascending: false });
  const history = (id) => (calls ?? []).filter((c) => c.lead_id === id);
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
  const [{ count: busy }, { count: today }] = await Promise.all([
    db.from('sales_calls').select('id', { count: 'exact', head: true }).eq('status', 'placing'),
    db.from('sales_calls').select('id', { count: 'exact', head: true }).not('attempt_id', 'is', null).gte('created_at', minutesAgo(24 * 60)),
  ]);
  if ((busy ?? 0) > 0) return { done: 'a call is still in progress' };
  if ((today ?? 0) >= Math.min(settings.per_day, RULES.perDay)) return { done: 'daily number reached' };

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
