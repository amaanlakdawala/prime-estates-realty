// Keeps a firm's clients up to date. Server only. Runs when the dashboard or the clients page opens, so it needs no
// schedule: new enquiries (website forms, AI chatbot, WhatsApp, portal leads) and finished AI calls become clients
// with their requirement, then every active client is matched against the available listings.
import { createAdminClient } from '@/lib/supabase/admin';
import { toIndianMobile } from '@/lib/voice';
import { loadKnowledge } from '@/features/knowledge-base/lookup';
import { fromCallResult, fromListing, mergeIntoClient, parseRequirement } from './requirement';
import { findMatches } from './match';

const LOOKBACK_DAYS = 60;
const BATCH = 200;
const ACTIVE = ['new', 'contacted', 'site_visit', 'negotiation'];
const since = (days) => new Date(Date.now() - days * 864e5).toISOString();
const phoneOf = (raw) => toIndianMobile(raw) ?? String(raw ?? '').replace(/[^\d+]/g, '').slice(0, 20);

// Refs already taken in, from a list of candidate refs (looked up in chunks to keep the URLs short).
async function knownRefs(db, firmId, refs) {
  const known = new Set();
  for (let i = 0; i < refs.length; i += 80) {
    const { data } = await db.from('client_activities').select('ref').eq('firm_id', firmId).in('ref', refs.slice(i, i + 80));
    for (const r of data ?? []) known.add(r.ref);
  }
  return known;
}

// One person: find or create the client, merge what we learned, log it once (ref).
async function takeIn(db, firm, { phone, name, source, requirement, stage, followUp, activity }) {
  if (!phone || phone.length < 7) return;
  const { data: existing } = await db.from('clients').select('*').eq('firm_id', firm.id).eq('phone', phone).maybeSingle();
  const client = existing ?? { req_areas: [] };
  const fields = {
    ...(requirement ? mergeIntoClient(client, requirement) : {}),
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!existing?.name && name) fields.name = name.slice(0, 120);
  // Stages only move forward automatically: a new enquiry never pulls a client in negotiation back to "new".
  const order = ['new', 'contacted', 'site_visit', 'negotiation', 'won', 'lost'];
  if (stage && order.indexOf(stage) > order.indexOf(existing?.stage ?? 'new') && !['won', 'lost'].includes(existing?.stage)) fields.stage = stage;
  if (followUp && (!existing?.next_follow_up || existing.next_follow_up > followUp)) fields.next_follow_up = followUp;

  let id = existing?.id;
  if (existing) await db.from('clients').update(fields).eq('id', existing.id);
  else {
    const { data, error } = await db.from('clients').insert({ firm_id: firm.id, phone, source, ...fields }).select('id').single();
    if (error) return; // e.g. a duplicate created by a parallel page load
    id = data.id;
  }
  await db.from('client_activities').insert({ firm_id: firm.id, client_id: id, ...activity });
}

export async function syncClients(firm) {
  const db = createAdminClient();
  const { areas } = await loadKnowledge();
  const places = areas.map((a) => ({ name: a.name, aliases: a.aliases }));
  const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Enquiries from every channel.
  const { data: enquiries } = await db.from('enquiries').select('id, created_at, name, phone, message, source, listings(*)')
    .eq('firm_id', firm.id).gte('created_at', since(LOOKBACK_DAYS)).order('created_at').limit(1000);
  const enqKnown = await knownRefs(db, firm.id, (enquiries ?? []).map((e) => `enquiry:${e.id}`));
  let taken = 0;
  for (const e of enquiries ?? []) {
    if (enqKnown.has(`enquiry:${e.id}`) || taken >= BATCH) continue;
    const fromText = parseRequirement(e.message ?? '', places);
    const requirement = e.listings ? { ...fromListing(e.listings), ...Object.fromEntries(Object.entries(fromText).filter(([, v]) => v && (!Array.isArray(v) || v.length))) } : fromText;
    await takeIn(db, firm, {
      phone: phoneOf(e.phone), name: e.name, source: e.source || 'website', requirement,
      activity: { kind: 'enquiry', ref: `enquiry:${e.id}`, body: [e.listings && `Asked about ${e.listings.title}.`, e.message].filter(Boolean).join(' ').slice(0, 600) || 'Sent an enquiry.' },
    });
    taken++;
  }

  // Riya's finished calls: the most reliable requirement, and the stage moves on.
  const { data: calls } = await db.from('calls').select('id, created_at, status, result, summary, call_contacts(name, phone)')
    .eq('firm_id', firm.id).eq('status', 'done').gte('created_at', since(LOOKBACK_DAYS)).order('created_at').limit(1000);
  const callKnown = await knownRefs(db, firm.id, (calls ?? []).map((c) => `call:${c.id}`));
  for (const c of calls ?? []) {
    if (callKnown.has(`call:${c.id}`) || !c.call_contacts || taken >= BATCH) continue;
    const r = c.result ?? {};
    await takeIn(db, firm, {
      phone: phoneOf(c.call_contacts.phone), name: c.call_contacts.name, source: 'call',
      requirement: r.do_not_call ? null : fromCallResult(r),
      stage: r.site_visit ? 'site_visit' : 'contacted',
      followUp: r.site_visit || r.callback_time ? tomorrow : null,
      activity: { kind: 'call', ref: `call:${c.id}`, body: [`AI call (Riya).`, c.summary, r.site_visit && `Site visit: ${r.site_visit}`, r.callback_time && `Call back: ${r.callback_time}`].filter(Boolean).join(' ').slice(0, 600) },
    });
    taken++;
  }
  return taken;
}

// Recomputes the firm's matches: new fits are added as "new", fits that no longer hold (listing sold, requirement
// changed) are removed unless the team already acted on them. clientId limits it to one client.
export async function runMatching(firm, { clientId = null } = {}) {
  const db = createAdminClient();
  let q = db.from('clients').select('*').eq('firm_id', firm.id).in('stage', ACTIVE);
  if (clientId) q = q.eq('id', clientId);
  const [{ data: clients }, { data: listings }] = await Promise.all([
    q.limit(3000),
    db.from('listings').select('id, title, locality, address, bhk, property_type, deal_type, price, status').eq('firm_id', firm.id).eq('status', 'available').limit(2000),
  ]);
  const matches = await findMatches(clients ?? [], listings ?? []);
  let existingQ = db.from('client_matches').select('id, client_id, listing_id, status, score').eq('firm_id', firm.id);
  if (clientId) existingQ = existingQ.eq('client_id', clientId);
  const { data: existing } = await existingQ.limit(10000);
  const key = (m) => `${m.client_id}:${m.listing_id}`;
  const now = new Map(matches.map((m) => [key(m), m]));
  const had = new Map((existing ?? []).map((m) => [key(m), m]));

  const fresh = matches.filter((m) => !had.has(key(m))).map((m) => ({ firm_id: firm.id, ...m }));
  for (let i = 0; i < fresh.length; i += 500) await db.from('client_matches').upsert(fresh.slice(i, i + 500), { onConflict: 'client_id,listing_id', ignoreDuplicates: true });
  for (const m of matches.filter((x) => had.has(key(x)) && had.get(key(x)).score !== x.score)) {
    await db.from('client_matches').update({ score: m.score, reasons: m.reasons }).eq('id', had.get(key(m)).id);
  }
  const gone = (existing ?? []).filter((m) => !now.has(key(m)) && m.status === 'new').map((m) => m.id);
  for (let i = 0; i < gone.length; i += 100) await db.from('client_matches').delete().in('id', gone.slice(i, i + 100));
  return { added: fresh.length, removed: gone.length };
}

// Both, for a page that is about to show clients or matches. Never breaks the page: errors only go to the log.
export async function refreshClients(firm) {
  try {
    await syncClients(firm);
    await runMatching(firm);
  } catch (err) {
    console.error('Clients refresh failed:', err.message);
  }
}

