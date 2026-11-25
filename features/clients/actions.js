'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext, isUuid } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { callContactNow, toIndianMobile } from '@/lib/voice';
import { loadKnowledge } from '@/features/knowledge-base/lookup';
import { mergeIntoClient, parseAmount, parseRequirement, describeRequirement } from './requirement';
import { runMatching } from './sync';
import { STAGES, shareMessage, stageOf, waNumber } from './format';
import { whatsappLink } from '@/lib/format';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexorautomate.netlify.app';
const clip = (v, n) => (v ?? '').toString().trim().slice(0, n);
const run = (fn) => fn().catch((err) => ({ error: err.message }));

// The firm this login works on (its own, or the one the platform admin is managing), as a full row.
async function requireFirmRow() {
  const ctx = await getAdminContext();
  if (!ctx?.firm) throw new Error('Choose a firm first.');
  if (!ctx.isPlatformAdmin && !ctx.firm.active) throw new Error('Your account is paused.');
  const { data: firm } = await createAdminClient().from('firms').select('*').eq('id', ctx.firm.id).single();
  return { ctx, firm };
}
async function ownClient(db, firmId, clientId) {
  if (!isUuid(clientId)) throw new Error('Unknown client.');
  const { data } = await db.from('clients').select('*').eq('id', clientId).eq('firm_id', firmId).maybeSingle();
  if (!data) throw new Error('Unknown client.');
  return data;
}
const log = (db, firmId, clientId, kind, body) => db.from('client_activities').insert({ firm_id: firmId, client_id: clientId, kind, body: clip(body, 1000) });
const refresh = (clientId) => { revalidatePath('/admin/dashboard'); revalidatePath('/admin/clients'); if (clientId) revalidatePath(`/admin/clients/${clientId}`); };

// "Add client": name, mobile, and what they want in their own words (read into fields, editable after).
export async function addClient(formData) {
  return run(async () => {
    const { ctx, firm } = await requireFirmRow();
    const db = createAdminClient();
    const phone = toIndianMobile(formData.get('phone'));
    if (!phone) throw new Error('Enter a valid 10-digit mobile number.');
    const { areas } = await loadKnowledge();
    const wants = clip(formData.get('wants'), 500);
    const req = parseRequirement(wants, areas.map((a) => ({ name: a.name, aliases: a.aliases })));
    const { data, error } = await db.from('clients').insert({
      firm_id: firm.id, phone, name: clip(formData.get('name'), 120), source: 'manual',
      ...mergeIntoClient({ req_areas: [] }, { ...req, notes: wants }),
    }).select('id').single();
    if (error) throw new Error(error.code === '23505' ? 'This number is already one of your clients.' : error.message);
    await log(db, firm.id, data.id, 'note', `Added by ${ctx.user.email}.${wants ? ` Wants: ${wants}` : ''}`);
    await runMatching(firm, { clientId: data.id });
    refresh();
    return { id: data.id };
  });
}

// Stage and follow-up date from the client page or the pipeline.
export async function updateClientStage(clientId, { stage, followUp }) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    const db = createAdminClient();
    const client = await ownClient(db, firm.id, clientId);
    const fields = { updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() };
    if (stage !== undefined) {
      if (!STAGES.some((s) => s.value === stage)) throw new Error('Unknown stage.');
      fields.stage = stage;
    }
    if (followUp !== undefined) fields.next_follow_up = /^\d{4}-\d{2}-\d{2}$/.test(followUp ?? '') ? followUp : null;
    const { error } = await db.from('clients').update(fields).eq('id', client.id);
    if (error) throw new Error(error.message);
    if (stage !== undefined && stage !== client.stage) await log(db, firm.id, client.id, 'stage', `${stageOf(client.stage).label} → ${stageOf(stage).label}`);
    if (followUp !== undefined && fields.next_follow_up !== client.next_follow_up) await log(db, firm.id, client.id, 'follow_up', fields.next_follow_up ? `Follow-up set for ${fields.next_follow_up}` : 'Follow-up cleared');
    if (stage !== undefined && ['won', 'lost'].includes(stage)) await db.from('client_matches').delete().eq('client_id', client.id).eq('status', 'new');
    refresh(client.id);
    return { success: true };
  });
}

// The requirement form on the client page. Budgets accept "1.5 cr", "85 lakh", "60k".
export async function saveRequirement(clientId, formData) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    const db = createAdminClient();
    const client = await ownClient(db, firm.id, clientId);
    const int = (k) => { const n = Number.parseInt(formData.get(k), 10); return n > 0 && n < 20 ? n : null; };
    const deal = clip(formData.get('deal'), 4), type = clip(formData.get('type'), 6);
    let bhkMin = int('bhk_min'), bhkMax = int('bhk_max') ?? bhkMin;
    if (bhkMin && bhkMax && bhkMax < bhkMin) [bhkMin, bhkMax] = [bhkMax, bhkMin];
    const fields = {
      req_deal: ['buy', 'rent'].includes(deal) ? deal : '',
      req_type: ['flat', 'villa', 'plot', 'office', 'shop'].includes(type) ? type : '',
      req_bhk_min: bhkMin, req_bhk_max: bhkMax,
      req_budget_min: parseAmount(formData.get('budget_min')), req_budget_max: parseAmount(formData.get('budget_max')),
      req_areas: clip(formData.get('areas'), 400).split(',').map((a) => a.trim()).filter(Boolean).slice(0, 6),
      req_notes: clip(formData.get('req_notes'), 500),
      req_updated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const { error } = await db.from('clients').update(fields).eq('id', client.id);
    if (error) throw new Error(error.message);
    await log(db, firm.id, client.id, 'note', `Requirement updated: ${describeRequirement({ ...client, ...fields })}`);
    const result = await runMatching(firm, { clientId: client.id });
    refresh(client.id);
    return { success: true, added: result.added };
  });
}

export async function addClientNote(clientId, text) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    const db = createAdminClient();
    const client = await ownClient(db, firm.id, clientId);
    const body = clip(text, 1000);
    if (!body) throw new Error('Write a note first.');
    await log(db, firm.id, client.id, 'note', body);
    await db.from('clients').update({ last_activity_at: new Date().toISOString() }).eq('id', client.id);
    refresh(client.id);
    return { success: true };
  });
}

async function ownMatch(db, firmId, matchId) {
  if (!isUuid(matchId)) throw new Error('Unknown match.');
  const { data } = await db.from('client_matches').select('*, clients(*), listings(*)').eq('id', matchId).eq('firm_id', firmId).maybeSingle();
  if (!data?.clients || !data?.listings) throw new Error('This match no longer exists.');
  return data;
}

// "Share on WhatsApp": records the share and returns the wa.me link with the message filled in.
export async function shareMatch(matchId) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    const db = createAdminClient();
    const m = await ownMatch(db, firm.id, matchId);
    const l = m.listings;
    const link = firm.website_enabled !== false && l.show_on_website !== false ? `${SITE}/${firm.slug}/properties/${l.id}` : null;
    const text = shareMessage({ client: m.clients, listing: l, firmName: firm.name, link });
    await db.from('client_matches').update({ status: 'shared', shared_at: new Date().toISOString() }).eq('id', m.id);
    await log(db, firm.id, m.client_id, 'share', `Shared on WhatsApp: ${l.title} (${l.locality}).`);
    await db.from('clients').update({ last_activity_at: new Date().toISOString(), ...(m.clients.stage === 'new' && { stage: 'contacted' }) }).eq('id', m.client_id);
    refresh(m.client_id);
    return { url: whatsappLink(waNumber(m.clients.phone), text) };
  });
}

// Interested / not interested / dismiss.
export async function setMatchStatus(matchId, status) {
  return run(async () => {
    const { firm } = await requireFirmRow();
    if (!['interested', 'not_interested', 'dismissed', 'new', 'shared'].includes(status)) throw new Error('Unknown status.');
    const db = createAdminClient();
    const m = await ownMatch(db, firm.id, matchId);
    await db.from('client_matches').update({ status }).eq('id', m.id);
    if (status === 'interested' || status === 'not_interested') {
      await log(db, firm.id, m.client_id, 'note', `${status === 'interested' ? 'Interested in' : 'Not interested in'} ${m.listings.title}.`);
    }
    refresh(m.client_id);
    return { success: true };
  });
}

// "Riya calls": an AI call telling the client about this listing and offering a site visit.
export async function callAboutMatch(matchId) {
  return run(async () => {
    const { ctx, firm } = await requireFirmRow();
    const db = createAdminClient();
    const m = await ownMatch(db, firm.id, matchId);
    const phone = toIndianMobile(m.clients.phone);
    if (!phone) throw new Error('This client has no Indian mobile number.');
    const l = m.listings;
    const { data: contact, error } = await db.from('call_contacts').upsert({
      firm_id: firm.id, phone, name: clip(m.clients.name, 120), source: 'manual', consent_confirmed: true, created_by: ctx.user.id,
      context: `Our consultant found a property that matches what they asked for: ${l.title} in ${l.locality}. Tell them about it and offer a site visit.`,
      notes: clip(describeRequirement(m.clients), 500),
    }, { onConflict: 'firm_id,phone' }).select('*').single();
    if (error) throw new Error(error.message);
    await callContactNow({ firm, contact, startedBy: ctx.user.id });
    await db.from('client_matches').update({ status: 'shared', shared_at: new Date().toISOString() }).eq('id', m.id);
    await log(db, firm.id, m.client_id, 'share', `Riya (AI) is calling about ${l.title}.`);
    refresh(m.client_id);
    return { success: true };
  });
}
