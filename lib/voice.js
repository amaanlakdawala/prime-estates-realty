// AI calling through ElevenLabs (agent) + Twilio (phone line). Server only: uses secret keys.
import { createAdminClient } from '@/lib/supabase/admin';

const EL = 'https://api.elevenlabs.io/v1/convai';
const elHeaders = () => ({ 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' });

// "98200 12345", "09820012345", "+91 98200-12345" -> "+919820012345". Only Indian mobiles; null otherwise.
export function toIndianMobile(phone) {
  let digits = (phone ?? '').toString().replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

// Calls only between 9 am and 9 pm Indian time (TRAI's window for commercial calls).
export const CALLING_HOURS = { start: 9, end: 21 };
export function withinCallingHours(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(date));
  return hour >= CALLING_HOURS.start && hour < CALLING_HOURS.end;
}

// Office hours used for visits and callbacks when a firm hasn't set its own.
export const DEFAULT_FIRM_HOURS = 'Monday to Saturday, 10 am to 7 pm';

// "Thursday, 15 October 2026, 5:30 pm" in India time, so the agent can work out "kal", "this Sunday" and
// spot impossible times like 1 am or next year.
export function indiaNow(date = new Date()) {
  const f = (o) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...o }).format(date);
  return `${f({ weekday: 'long' })}, ${f({ day: 'numeric', month: 'long', year: 'numeric' })}, ${f({ hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

// What the agent is told about this firm and this person (matches the {{variables}} in its prompt).
export function callVariables(firm, contact) {
  const first = (contact.name ?? '').trim().split(/\s+/)[0];
  const reason = contact.context?.trim()
    || (contact.source === 'website' ? 'They filled a property enquiry form on our website.' : 'They had shown interest in a property with us earlier.');
  return {
    greeting_name: first ? `${first} जी` : 'जी',
    customer_name: contact.name?.trim() || '',
    call_reason: reason,
    known_requirement: contact.notes?.trim() || '',
    today: indiaNow(),
    firm_name: firm.name,
    firm_city: firm.city || '',
    firm_slug: firm.slug,
    firm_address: firm.address || '',
    firm_hours: firm.hours || DEFAULT_FIRM_HOURS,
    firm_founded: firm.founded_year ? String(firm.founded_year) : '',
    firm_areas: (firm.localities ?? []).join(', '),
  };
}

export async function placeCall({ voice, toNumber, variables }) {
  const agentId = voice === 'simran' ? process.env.ELEVENLABS_AGENT_ID_SIMRAN : process.env.ELEVENLABS_AGENT_ID_SIA;
  if (!process.env.ELEVENLABS_API_KEY || !agentId || !process.env.ELEVENLABS_PHONE_NUMBER_ID) {
    throw new Error('AI calling is not configured on the server (ElevenLabs keys missing).');
  }
  const res = await fetch(`${EL}/twilio/outbound-call`, {
    method: 'POST',
    headers: elHeaders(),
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
      to_number: toNumber,
      conversation_initiation_client_data: { dynamic_variables: variables },
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false || !data.conversation_id) {
    const detail = data.message || data.detail?.message || (Array.isArray(data.detail) ? data.detail[0]?.msg : '') || `HTTP ${res.status}`;
    throw new Error(`The call could not be placed: ${detail}`);
  }
  return { conversationId: data.conversation_id, callSid: data.callSid ?? null };
}

// The last error ElevenLabs gave when reading a conversation (HTTP status and its short reason), for the scheduler's report.
export let lastReadError = null;

// Reads a finished (or running) conversation and turns it into what we store on the call.
export async function readConversation(conversationId) {
  if (!process.env.ELEVENLABS_API_KEY) { lastReadError = 'ELEVENLABS_API_KEY is not set'; return null; }
  const res = await fetch(`${EL}/conversations/${conversationId}`, { headers: elHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    lastReadError = `HTTP ${res.status}${body.detail?.status ? ` (${body.detail.status})` : ''}`;
    console.error(`ElevenLabs conversation ${conversationId}: ${lastReadError}`);
    return null;
  }
  const c = await res.json();
  const transcript = (c.transcript ?? []).filter((t) => t.message).map((t) => ({ role: t.role === 'agent' ? 'agent' : 'caller', text: t.message, at: t.time_in_call_secs ?? null }));
  const callerSpoke = transcript.some((t) => t.role === 'caller');
  let status = 'in_progress';
  if (c.status === 'done') status = callerSpoke ? 'done' : 'no_answer';
  else if (c.status === 'failed') status = callerSpoke ? 'failed' : 'no_answer';
  const result = Object.fromEntries(Object.entries(c.analysis?.data_collection_results ?? {}).map(([k, v]) => [k, v?.value ?? null]));
  return {
    status,
    duration_secs: c.metadata?.call_duration_secs ?? null,
    summary: c.analysis?.transcript_summary ?? null,
    result: Object.keys(result).length ? result : null,
    transcript: transcript.length ? transcript : null,
  };
}

// A call that must not be placed (switched off, outside hours, do-not-call, over the limit…).
// Unlike a technical failure, retrying won't help.
export class CallBlocked extends Error {}

export async function callsThisMonth(db, firmId) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from('calls').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).gte('created_at', start.toISOString());
  return count ?? 0;
}

// The one place a call is placed, for the Call button and the automatic queue alike, so every
// safeguard applies to both. firm and contact are full database rows. Returns the new call's id.
export async function callContactNow({ firm, contact, startedBy = null }) {
  const db = createAdminClient();
  if (!firm.active) throw new CallBlocked('This firm is paused.');
  if (!firm.ai_calls_enabled) throw new CallBlocked('AI calling is not switched on for this firm yet.');
  if (!withinCallingHours()) throw new CallBlocked(`Calls can only be made between ${CALLING_HOURS.start} am and ${CALLING_HOURS.end - 12} pm (Indian time).`);
  if (contact.status === 'do_not_call') throw new CallBlocked('This person asked not to be called.');
  if (!contact.consent_confirmed) throw new CallBlocked('Consent for this contact is not confirmed.');
  if ((await callsThisMonth(db, firm.id)) >= firm.ai_calls_monthly_limit) throw new CallBlocked(`This month's limit of ${firm.ai_calls_monthly_limit} AI calls is reached.`);
  const { data: busy } = await db.from('calls').select('id').eq('contact_id', contact.id).in('status', ['queued', 'in_progress']).limit(1);
  if (busy?.length) throw new CallBlocked('A call to this person is already in progress.');

  const { conversationId, callSid } = await placeCall({ voice: firm.voice_agent, toNumber: contact.phone, variables: callVariables(firm, contact) });
  const { data: call, error } = await db.from('calls').insert({
    firm_id: firm.id, contact_id: contact.id, conversation_id: conversationId, call_sid: callSid, status: 'in_progress', started_by: startedBy,
  }).select('id').single();
  if (error) throw new Error(error.message);
  await db.from('call_contacts').update({ status: 'calling', call_count: contact.call_count + 1, last_called_at: new Date().toISOString() }).eq('id', contact.id);
  return call.id;
}

const CONTACT_STATUS = { done: 'called', no_answer: 'no_answer', failed: 'failed' };

// Brings unfinished calls of a firm up to date from ElevenLabs, and updates their contacts.
export async function syncFirmCalls(firmId) {
  const db = createAdminClient();
  const { data: open } = await db.from('calls').select('id, contact_id, conversation_id, created_at').eq('firm_id', firmId).in('status', ['queued', 'in_progress']).limit(50);
  const stats = { open: open?.length ?? 0, updated: 0, unreadable: 0 };
  for (const call of open ?? []) {
    if (!call.conversation_id) continue;
    const info = await readConversation(call.conversation_id);
    if (!info) { stats.unreadable++; continue; }
    stats.updated++;
    // A call ElevenLabs never reports as finished is given up on after an hour.
    const stale = info.status === 'in_progress' && Date.now() - new Date(call.created_at).getTime() > 60 * 60 * 1000;
    const status = stale ? 'failed' : info.status;
    await db.from('calls').update({ ...info, status, error: stale ? 'No result from the call service' : null }).eq('id', call.id);
    if (status !== 'in_progress' && call.contact_id) {
      const contactStatus = info.result?.do_not_call ? 'do_not_call' : CONTACT_STATUS[status];
      await db.from('call_contacts').update({ status: contactStatus }).eq('id', call.contact_id).neq('status', 'do_not_call');
    }
  }
  return stats;
}
