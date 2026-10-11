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

// What the agent is told about this firm and this person (matches the {{variables}} in its prompt).
export function callVariables(firm, contact) {
  const first = (contact.name ?? '').trim().split(/\s+/)[0];
  const reason = contact.context?.trim()
    || (contact.source === 'website' ? 'They filled a property enquiry form on our website.' : 'They had shown interest in a property with us earlier.');
  return {
    greeting_name: first ? `${first} जी` : 'जी',
    customer_name: contact.name?.trim() || 'the customer',
    call_reason: reason,
    known_requirement: contact.notes?.trim() || '',
    firm_name: firm.name,
    firm_city: firm.city || '',
    firm_slug: firm.slug,
    firm_address: firm.address || '',
    firm_hours: firm.hours || '',
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

// Reads a finished (or running) conversation and turns it into what we store on the call.
export async function readConversation(conversationId) {
  const res = await fetch(`${EL}/conversations/${conversationId}`, { headers: elHeaders(), cache: 'no-store' });
  if (!res.ok) return null;
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

const CONTACT_STATUS = { done: 'called', no_answer: 'no_answer', failed: 'failed' };

// Brings unfinished calls of a firm up to date from ElevenLabs, and updates their contacts.
export async function syncFirmCalls(firmId) {
  const db = createAdminClient();
  const { data: open } = await db.from('calls').select('id, contact_id, conversation_id, created_at').eq('firm_id', firmId).in('status', ['queued', 'in_progress']).limit(50);
  for (const call of open ?? []) {
    if (!call.conversation_id) continue;
    const info = await readConversation(call.conversation_id);
    if (!info) continue;
    // A call ElevenLabs never reports as finished is given up on after an hour.
    const stale = info.status === 'in_progress' && Date.now() - new Date(call.created_at).getTime() > 60 * 60 * 1000;
    const status = stale ? 'failed' : info.status;
    await db.from('calls').update({ ...info, status, error: stale ? 'No result from the call service' : null }).eq('id', call.id);
    if (status !== 'in_progress' && call.contact_id) {
      const contactStatus = info.result?.do_not_call ? 'do_not_call' : CONTACT_STATUS[status];
      await db.from('call_contacts').update({ status: contactStatus }).eq('id', call.contact_id).neq('status', 'do_not_call');
    }
  }
}
