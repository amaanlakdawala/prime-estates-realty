// Sales caller: Riya calls a lead (a brokerage) on Sarvam, pitches your services and tries to book a demo.
// Server only. Placing a call: placeLeadCall (from the lead's page). Results: handleCallReport (Sarvam's webhook).
import { createAdminClient } from '@/lib/supabase/admin';
import { addToSarvamCampaign, sarvamCallInfo } from '@/lib/sarvam';
import { toIndianMobile } from '@/lib/voice';
import { cleanName, isUnknownName } from '@/lib/leads';
import { MISSED, describeCall } from './format';

export const SALES_WEBHOOK_PATH = '/api/sales-calls/webhook';

// Calls go through the Sarvam campaign "Riya sales calls": this account may call only OTP-verified numbers
// with single API calls (HTTP 402 for anyone else), a campaign may call anyone. The campaign holds the agent
// (Riya sales caller, features/sales-caller/prompt.md) and its version, the number, the hours (Mon–Sat 10–7)
// and the webhook to SALES_WEBHOOK_PATH. After a new agent commit in Sarvam, raise the campaign's app version.
// Campaigns last at most 90 days: this one ends 31 Jan 2027; then make a new one and set SALES_SARVAM_CAMPAIGN_ID.
const CAMPAIGN_ID = () => process.env.SALES_SARVAM_CAMPAIGN_ID || 'Riya-sales--a8170050-778e';

// Business calls to business owners: weekdays and Saturday, office hours, a few a day, never pushy.
export const RULES = {
  days: [1, 2, 3, 4, 5, 6],                                     // Mon–Sat (0 = Sunday)
  startHour: 10,                                                // IST
  endHour: 19,                                                  // last call starts before 7 pm
  perDay: Number(process.env.SALES_CALLS_PER_DAY) || 30,       // per day, counted from midnight IST
  daysBetweenCalls: 3,                                          // to the same lead
  maxCallsPerLead: 3,
  blockedStatuses: ['do_not_contact', 'won', 'lost'],
};

// The post-call fields the agent fills (configured on the Sarvam agent with the same names).
const RESULT_FIELDS = ['interested', 'demo_time', 'whatsapp_ok', 'callback_time', 'lead_sources', 'website_status', 'objection', 'do_not_call', 'firm_heard'];

// firm_name when the lead's name is not known: the opening line then reads "Am I speaking with kisi property broker?",
// which Riya says as natural Hindi (kya meri baat kisi property broker se ho rahi hai). The prompt checks for this value.
const UNKNOWN_FIRM = 'kisi property broker';

// Riya calls from the company, not a person; the WhatsApp number is yours.
const OWNER = { company: 'Nexora', whatsapp: '80975 46742' };
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexorautomate.netlify.app';

function indiaNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const hour = Number(parts.hour);
  // With the time: without it Riya guessed that 3:30 pm was "काफी देर" for a demo today.
  const time = `${hour % 12 || 12}:${parts.minute} ${hour < 12 ? 'am' : 'pm'}`;
  return { day, hour, label: `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}, ${time}` };
}

// Midnight India time today (IST is UTC+5:30 all year), as an ISO timestamp: the daily limit counts calls since then.
const IST_OFFSET_MS = 330 * 60 * 1000;
export function startOfIndiaDay() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS).toISOString();
}

// Why this lead can't be called right now, or null. Same checks for the button and the server.
export function callBlocker(lead, history = []) {
  if (RULES.blockedStatuses.includes(lead.status)) return lead.status === 'do_not_contact' ? 'They asked not to be contacted.' : `This lead is marked ${lead.status}.`;
  if (!toIndianMobile(lead.phone_intl || lead.phone)) return 'No Indian mobile number for this lead.';
  if (history.length >= RULES.maxCallsPerLead) return `Already called ${RULES.maxCallsPerLead} times by the AI.`;
  const last = history[0];
  if (last && Date.now() - new Date(last.created_at).getTime() < RULES.daysBetweenCalls * 864e5) {
    return `Called by the AI in the last ${RULES.daysBetweenCalls} days.`;
  }
  const now = indiaNow();
  if (!RULES.days.includes(now.day) || now.hour < RULES.startHour || now.hour >= RULES.endHour) {
    return `AI calls go out Monday to Saturday, ${RULES.startHour} am to ${RULES.endHour - 12} pm.`;
  }
  return null;
}

// What the agent knows about the person it is calling (agent variables on the Sarvam agent).
function callVariables(lead, demoSlug) {
  return {
    firm_name: isUnknownName(lead.name) ? UNKNOWN_FIRM : cleanName(lead.name),
    city: lead.city || 'Mumbai',
    area: lead.locality || '',
    has_website: lead.website ? 'yes' : 'no',
    demo_ready: demoSlug ? 'yes' : 'no', // a sample website already made for them (sent on WhatsApp, never read out)
    company_name: OWNER.company,
    owner_whatsapp: OWNER.whatsapp,
    today: indiaNow().label,
  };
}

export async function placeLeadCall(leadId) {
  const db = createAdminClient();
  const [{ data: lead }, { data: history }, today] = await Promise.all([
    db.from('leads').select('*').eq('id', leadId).maybeSingle(),
    // Calls that never reached Sarvam (no attempt id, e.g. out of credit) don't count against the lead or the day.
    db.from('sales_calls').select('created_at').eq('lead_id', leadId).not('attempt_id', 'is', null).order('created_at', { ascending: false }),
    db.from('sales_calls').select('id', { count: 'exact', head: true }).not('attempt_id', 'is', null).gte('created_at', startOfIndiaDay()),
  ]);
  if (!lead) throw new Error('Lead not found.');
  const blocked = callBlocker(lead, history ?? []);
  if (blocked) throw new Error(blocked);
  if ((today.count ?? 0) >= RULES.perDay) throw new Error(`The limit of ${RULES.perDay} AI sales calls today is reached.`);

  const toNumber = toIndianMobile(lead.phone_intl || lead.phone);
  const { data: demo } = lead.demo_firm_id ? await db.from('firms').select('slug').eq('id', lead.demo_firm_id).maybeSingle() : { data: null };
  const { data: row, error } = await db.from('sales_calls').insert({ lead_id: lead.id, to_number: toNumber }).select('id').single();
  if (error) throw new Error(error.message);

  try {
    // The row id travels as the user identifier and comes back on the webhook, which then stores Sarvam's attempt id.
    const { cohortId } = await addToSarvamCampaign({ campaignId: CAMPAIGN_ID(), toNumber, identifier: row.id, variables: callVariables(lead, demo?.slug) });
    await db.from('sales_calls').update({ attempt_id: `cohort:${cohortId}` }).eq('id', row.id);
  } catch (err) {
    await db.from('sales_calls').update({ status: 'failed', error: err.message }).eq('id', row.id);
    throw err;
  }
  await db.from('lead_activities').insert({ lead_id: lead.id, kind: 'call', body: 'AI sales call queued (Riya): Sarvam dials within a few minutes.' });
  await db.from('leads').update({
    last_contacted_at: new Date().toISOString(),
    ...(lead.status === 'new' && { status: 'contacted' }),
  }).eq('id', lead.id);
  return { demoLink: demo ? `${SITE}/${demo.slug}` : null };
}

// Sarvam's end-of-call report: save it on the call, note it on the lead, move the lead's status on.
export async function handleCallReport(report) {
  const db = createAdminClient();
  // Campaign calls are found by the row id sent as user_identifier; their attempt id is only known from here.
  const byRow = /^[0-9a-f-]{36}$/i.test(report.user_identifier ?? '') && report.user_identifier;
  const { data: call } = byRow
    ? await db.from('sales_calls').select('id, lead_id').eq('id', byRow).maybeSingle()
    : await db.from('sales_calls').select('id, lead_id').eq('attempt_id', report.attempt_id).maybeSingle();
  if (!call) return false;
  if (report.next_action_status) return true; // Sarvam will try again; the last attempt carries the result

  const info = sarvamCallInfo(report, RESULT_FIELDS);
  if (info.missed) info.error = MISSED[info.missed][1];
  await db.from('sales_calls').update({
    attempt_id: report.attempt_id,
    status: info.status, duration_secs: info.duration_secs, result: info.result, transcript: info.transcript, error: info.error,
  }).eq('id', call.id);

  const { data: lead } = await db.from('leads').select('status, name').eq('id', call.lead_id).maybeSingle();
  const r = info.result ?? {};
  const update = {};
  if (r.firm_heard && isUnknownName(lead?.name)) update.name = String(r.firm_heard).slice(0, 200);
  if (r.do_not_call) update.status = 'do_not_contact';
  else if ((r.interested || r.demo_time) && ['new', 'contacted'].includes(lead?.status)) update.status = 'interested';
  if (!r.do_not_call && (r.demo_time || r.whatsapp_ok || r.callback_time)) {
    update.next_follow_up = new Date(Date.now() + 864e5).toISOString().slice(0, 10); // tomorrow: send the WhatsApp, confirm the demo
  }
  if (Object.keys(update).length && lead?.status !== 'do_not_contact') await db.from('leads').update(update).eq('id', call.lead_id);
  await db.from('lead_activities').insert({ lead_id: call.lead_id, kind: 'call', body: describeCall(info) });
  return true;
}
