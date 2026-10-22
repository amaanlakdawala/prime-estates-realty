'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext, isUuid } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { callContactNow, ENQUIRY_REASON, syncFirmCalls, toIndianMobile } from '@/lib/voice';

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
  if (!isUuid(contactId)) throw new Error('Unknown contact.');
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

const callContact = (ctx, firm, contact) => callContactNow({ firm, contact, startedBy: ctx.user.id });

// The firm's own switch for calling new website enquiries automatically.
export async function setAutoCallEnquiries(enabled) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    const { error } = await createAdminClient().from('firms').update({ ai_auto_call_enquiries: Boolean(enabled) }).eq('id', firm.id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/calls');
    return { success: true };
  });
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
    if (!isUuid(enquiryId)) throw new Error('Unknown enquiry.');
    const db = createAdminClient();
    const { data: enq } = await db.from('enquiries').select('*, listings(title)').eq('id', enquiryId).eq('firm_id', firm.id).maybeSingle();
    if (!enq) throw new Error('Unknown enquiry.');
    const phone = toIndianMobile(enq.phone);
    if (!phone) throw new Error('This enquiry has no valid Indian mobile number.');
    const notes = [enq.listings?.title && `Asked about: ${enq.listings.title}`, enq.message].filter(Boolean).join('. ');
    const { data: contact, error } = await db.from('call_contacts').upsert({
      firm_id: firm.id, name: clip(enq.name, 120), phone, source: 'website', enquiry_id: enq.id,
      context: ENQUIRY_REASON, notes: clip(notes, 500), consent_confirmed: true, created_by: ctx.user.id,
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
    const ids = callIds.filter(isUuid);
    const { data } = ids.length ? await createAdminClient().from('calls').select('id, status').eq('firm_id', firm.id).in('id', ids) : { data: [] };
    return { success: true, calls: data ?? [] };
  });
}
