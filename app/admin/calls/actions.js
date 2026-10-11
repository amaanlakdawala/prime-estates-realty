'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { callVariables, placeCall, readConversation, syncFirmCalls, toIndianMobile, withinCallingHours, CALLING_HOURS } from '@/lib/voice';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMPORT = 1000;
const clip = (v, max) => (v ?? '').toString().trim().slice(0, max);

// The firm this login works on (a firm login's own firm, or the one the platform admin is managing).
async function requireFirmRow() {
  const ctx = await getAdminContext();
  if (!ctx?.firm) throw new Error('Choose a firm first.');
  if (!ctx.isPlatformAdmin && !ctx.firm.active) throw new Error('Your account is paused.');
  const { data: firm } = await createAdminClient().from('firms').select('*').eq('id', ctx.firm.id).single();
  return { ctx, firm };
}

const run = (fn) => fn().catch((err) => ({ error: err.message }));

export async function addContact(formData) {
  return run(async () => {
    const { ctx, firm } = await requireFirmRow();
    if (formData.get('consent') !== 'on') throw new Error('Please confirm this person asked to be contacted or is your client.');
    const phone = toIndianMobile(formData.get('phone'));
    if (!phone) throw new Error('Enter a valid Indian mobile number (10 digits).');
    const { error } = await createAdminClient().from('call_contacts').insert({
      firm_id: firm.id,
      name: clip(formData.get('name'), 120),
      phone,
      context: clip(formData.get('context'), 300),
      notes: clip(formData.get('notes'), 500),
      source: 'manual',
      consent_confirmed: true,
      created_by: ctx.user.id,
    });
    if (error) throw new Error(error.code === '23505' ? 'This number is already in your list.' : error.message);
    revalidatePath('/admin/calls');
    return { success: true };
  });
}

// rows: [{ name, phone, context, notes }] read from the uploaded CSV in the browser.
export async function importContacts(rows, consent) {
  return run(async () => {
    const { ctx, firm } = await requireFirmRow();
    if (!consent) throw new Error('Please confirm everyone in this file asked to be contacted or is your client.');
    if (!Array.isArray(rows) || !rows.length) throw new Error('The file has no contacts.');
    if (rows.length > MAX_IMPORT) throw new Error(`Upload at most ${MAX_IMPORT} contacts at a time.`);

    const seen = new Set();
    const valid = [];
    let invalid = 0;
    for (const r of rows) {
      const phone = toIndianMobile(r.phone);
      if (!phone) { invalid++; continue; }
      if (seen.has(phone)) continue;
      seen.add(phone);
      valid.push({ firm_id: firm.id, name: clip(r.name, 120), phone, context: clip(r.context, 300), notes: clip(r.notes, 500), source: 'upload', consent_confirmed: true, created_by: ctx.user.id });
    }
    const db = createAdminClient();
    const { data: existing } = valid.length
      ? await db.from('call_contacts').select('phone').eq('firm_id', firm.id).in('phone', valid.map((v) => v.phone))
      : { data: [] };
    const known = new Set((existing ?? []).map((e) => e.phone));
    const fresh = valid.filter((v) => !known.has(v.phone));
    if (fresh.length) {
      const { error } = await db.from('call_contacts').insert(fresh);
      if (error) throw new Error(error.message);
    }
    revalidatePath('/admin/calls');
    return { success: true, added: fresh.length, alreadyListed: valid.length - fresh.length, invalid, duplicatesInFile: rows.length - invalid - valid.length };
  });
}

async function ownContact(firmId, contactId) {
  if (!UUID.test(contactId ?? '')) throw new Error('Unknown contact.');
  const { data } = await createAdminClient().from('call_contacts').select('*').eq('id', contactId).eq('firm_id', firmId).maybeSingle();
  if (!data) throw new Error('Unknown contact.');
  return data;
}

export async function deleteContact(contactId) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    await ownContact(firm.id, contactId);
    await createAdminClient().from('call_contacts').delete().eq('id', contactId);
    revalidatePath('/admin/calls');
    return { success: true };
  });
}

export async function markDoNotCall(contactId) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    await ownContact(firm.id, contactId);
    await createAdminClient().from('call_contacts').update({ status: 'do_not_call' }).eq('id', contactId);
    revalidatePath('/admin/calls');
    return { success: true };
  });
}

async function callsThisMonth(db, firmId) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from('calls').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).gte('created_at', start.toISOString());
  return count ?? 0;
}

async function callContact(ctx, firm, contact) {
  const db = createAdminClient();
  if (!firm.ai_calls_enabled) throw new Error('AI calling is not switched on for this firm yet.');
  if (!withinCallingHours()) throw new Error(`Calls can only be made between ${CALLING_HOURS.start} am and ${CALLING_HOURS.end - 12} pm (Indian time).`);
  if (contact.status === 'do_not_call') throw new Error('This person asked not to be called.');
  if (!contact.consent_confirmed) throw new Error('Consent for this contact is not confirmed.');
  if ((await callsThisMonth(db, firm.id)) >= firm.ai_calls_monthly_limit) throw new Error(`This month's limit of ${firm.ai_calls_monthly_limit} AI calls is reached.`);
  const { data: busy } = await db.from('calls').select('id').eq('contact_id', contact.id).in('status', ['queued', 'in_progress']).limit(1);
  if (busy?.length) throw new Error('A call to this person is already in progress.');

  const { conversationId, callSid } = await placeCall({ voice: firm.voice_agent, toNumber: contact.phone, variables: callVariables(firm, contact) });
  const { data: call, error } = await db.from('calls').insert({
    firm_id: firm.id, contact_id: contact.id, conversation_id: conversationId, call_sid: callSid, status: 'in_progress', started_by: ctx.user.id,
  }).select('id').single();
  if (error) throw new Error(error.message);
  await db.from('call_contacts').update({ status: 'calling', call_count: contact.call_count + 1, last_called_at: new Date().toISOString() }).eq('id', contact.id);
  return call.id;
}

export async function startCall(contactId) {
  return run(async () => {
    const { ctx, firm } = await requireFirmRow();
    const contact = await ownContact(firm.id, contactId);
    const callId = await callContact(ctx, firm, contact);
    revalidatePath('/admin/calls');
    return { success: true, callId };
  });
}

// "AI call" on a website enquiry: adds the person to the call list (they asked to be contacted) and calls.
export async function callEnquiry(enquiryId) {
  return run(async () => {
    const { ctx, firm } = await requireFirmRow();
    if (!UUID.test(enquiryId ?? '')) throw new Error('Unknown enquiry.');
    const db = createAdminClient();
    const { data: enq } = await db.from('enquiries').select('*, listings(title)').eq('id', enquiryId).eq('firm_id', firm.id).maybeSingle();
    if (!enq) throw new Error('Unknown enquiry.');
    const phone = toIndianMobile(enq.phone);
    if (!phone) throw new Error('This enquiry has no valid Indian mobile number.');
    const notes = [enq.listings?.title && `Asked about: ${enq.listings.title}`, enq.message].filter(Boolean).join('. ');
    const { data: contact, error } = await db.from('call_contacts').upsert({
      firm_id: firm.id, name: clip(enq.name, 120), phone, source: 'website', enquiry_id: enq.id,
      context: 'They filled a property enquiry form on our website.', notes: clip(notes, 500), consent_confirmed: true, created_by: ctx.user.id,
    }, { onConflict: 'firm_id,phone' }).select('*').single();
    if (error) throw new Error(error.message);
    const callId = await callContact(ctx, firm, contact);
    revalidatePath('/admin/calls');
    return { success: true, callId };
  });
}

// Used by the page while calls are running: refreshes them and reports where each stands.
export async function refreshCalls(callIds = []) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    await syncFirmCalls(firm.id);
    const ids = callIds.filter((id) => UUID.test(id));
    const { data } = ids.length ? await createAdminClient().from('calls').select('id, status').eq('firm_id', firm.id).in('id', ids) : { data: [] };
    return { success: true, calls: data ?? [] };
  });
}

// Re-reads one finished call from ElevenLabs (e.g. if the summary arrived late).
export async function reloadCall(callId) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    if (!UUID.test(callId ?? '')) throw new Error('Unknown call.');
    const db = createAdminClient();
    const { data: call } = await db.from('calls').select('conversation_id').eq('id', callId).eq('firm_id', firm.id).maybeSingle();
    if (!call?.conversation_id) throw new Error('Unknown call.');
    const info = await readConversation(call.conversation_id);
    if (info) await db.from('calls').update(info).eq('id', callId);
    revalidatePath('/admin/calls');
    return { success: true };
  });
}
