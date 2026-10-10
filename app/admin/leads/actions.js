'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchPlaces } from '@/lib/places';
import { cleanName, LEAD_STATUSES, scoreLead } from '@/lib/leads';
import { RESERVED_SLUGS } from '@/lib/site';

const MONTHLY_LIMIT = Number(process.env.LEADS_MONTHLY_REQUEST_LIMIT) || 900;
const thisMonth = () => new Date().toISOString().slice(0, 7);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requirePlatformAdmin() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) throw new Error('Only the platform admin can use the lead finder.');
  return ctx;
}

async function logActivity(db, leadId, kind, body = '') {
  await db.from('lead_activities').insert({ lead_id: leadId, kind, body });
}

// One Google search page: saves new leads, refreshes known ones. The browser calls this once per
// area, search phrase and page, so no single request runs long enough to time out on Netlify.
export async function searchLeads({ city, locality, query, pageToken = null, requireCity = true }) {
  try {
    await requirePlatformAdmin();
    const db = createAdminClient();

    const month = thisMonth();
    const { data: usageRow } = await db.from('places_usage').select('requests').eq('month', month).maybeSingle();
    if ((usageRow?.requests ?? 0) >= MONTHLY_LIMIT) {
      return { error: `This month's limit of ${MONTHLY_LIMIT} Google searches is reached, to stay inside Google's free allowance. It resets on the 1st.`, limitReached: true };
    }

    const cityName = (city ?? '').trim();
    const area = (locality ?? '').trim();
    const textQuery = `${query.trim()} in ${area ? `${area}, ` : ''}${cityName}`;
    const { places, nextPageToken } = await searchPlaces({ textQuery, pageToken });
    const { data: used } = await db.rpc('bump_places_usage', { m: month, n: 1 });

    const now = new Date().toISOString();
    const keep = places.filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY'
      && (!requireCity || !cityName || (p.formattedAddress ?? '').toLowerCase().includes(cityName.toLowerCase())));
    const rows = keep.map((p) => {
      const lead = {
        place_id: p.id,
        name: p.displayName?.text ?? 'Unnamed business',
        phone: p.nationalPhoneNumber ?? '',
        phone_intl: p.internationalPhoneNumber ?? '',
        website: p.websiteUri ?? '',
        address: p.formattedAddress ?? '',
        rating: p.rating ?? null,
        review_count: p.userRatingCount ?? 0,
        maps_url: p.googleMapsUri ?? '',
        last_refreshed_at: now,
      };
      return { ...lead, score: scoreLead(lead) };
    });

    let added = 0;
    if (rows.length) {
      const { data: existing } = await db.from('leads').select('place_id').in('place_id', rows.map((r) => r.place_id));
      const known = new Set((existing ?? []).map((r) => r.place_id));
      const fresh = rows.filter((r) => !known.has(r.place_id)).map((r) => ({ ...r, city: cityName, locality: area }));
      const refresh = rows.filter((r) => known.has(r.place_id)); // Google's details only: your status and notes stay
      if (fresh.length) {
        const { error } = await db.from('leads').insert(fresh);
        if (error) throw error;
        added = fresh.length;
      }
      if (refresh.length) {
        const { error } = await db.from('leads').upsert(refresh, { onConflict: 'place_id' });
        if (error) throw error;
      }
    }

    return { textQuery, found: rows.length, added, nextPageToken, used: used ?? (usageRow?.requests ?? 0) + 1, limit: MONTHLY_LIMIT };
  } catch (err) {
    return { error: err.message };
  }
}

export async function updateLead(leadId, { status, nextFollowUp }) {
  try {
    await requirePlatformAdmin();
    if (!UUID.test(leadId)) throw new Error('Unknown lead.');
    if (!LEAD_STATUSES.some((s) => s.value === status)) throw new Error('Unknown status.');
    const db = createAdminClient();
    const { data: before } = await db.from('leads').select('status').eq('id', leadId).single();
    const followUp = /^\d{4}-\d{2}-\d{2}$/.test(nextFollowUp ?? '') ? nextFollowUp : null;
    const { error } = await db.from('leads').update({ status, next_follow_up: followUp }).eq('id', leadId);
    if (error) throw error;
    if (before?.status !== status) {
      await logActivity(db, leadId, 'status', `${LEAD_STATUSES.find((s) => s.value === before?.status)?.label ?? before?.status} → ${LEAD_STATUSES.find((s) => s.value === status).label}`);
    }
    revalidatePath('/admin/leads', 'layout');
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

export async function addLeadNote(leadId, body) {
  try {
    await requirePlatformAdmin();
    const text = (body ?? '').toString().trim().slice(0, 2000);
    if (!text) throw new Error('Write a note first.');
    const db = createAdminClient();
    await logActivity(db, leadId, 'note', text);
    revalidatePath(`/admin/leads/${leadId}`);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

// Recorded when you tap Call or WhatsApp. A new lead moves to Contacted.
export async function logContact(leadId, kind) {
  try {
    await requirePlatformAdmin();
    if (!['call', 'whatsapp'].includes(kind)) throw new Error('Unknown contact type.');
    const db = createAdminClient();
    const { data: lead } = await db.from('leads').select('status').eq('id', leadId).single();
    if (lead?.status === 'do_not_contact') throw new Error('This lead asked not to be contacted.');
    const update = { last_contacted_at: new Date().toISOString() };
    if (lead?.status === 'new') update.status = 'contacted';
    await db.from('leads').update(update).eq('id', leadId);
    await logActivity(db, leadId, kind, kind === 'call' ? 'Called' : 'Opened WhatsApp');
    if (update.status) await logActivity(db, leadId, 'status', 'New → Contacted');
    revalidatePath('/admin/leads', 'layout');
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

// Send queue: you sent the message yourself in WhatsApp; this records it, marks the lead
// Contacted and books the follow-up.
export async function markWhatsAppSent(leadId, { followUpDays = 3, message = '' } = {}) {
  try {
    await requirePlatformAdmin();
    if (!UUID.test(leadId)) throw new Error('Unknown lead.');
    const db = createAdminClient();
    const { data: lead } = await db.from('leads').select('status').eq('id', leadId).single();
    if (lead?.status === 'do_not_contact') throw new Error('This lead asked not to be contacted.');

    const followUp = new Date(Date.now() + Math.min(Math.max(Number(followUpDays) || 3, 1), 30) * 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in Indian time
    const update = { last_contacted_at: new Date().toISOString(), next_follow_up: followUp };
    if (['new', 'contacted'].includes(lead?.status)) update.status = 'contacted';
    const { error } = await db.from('leads').update(update).eq('id', leadId);
    if (error) throw error;

    await logActivity(db, leadId, 'whatsapp', `Sent from the send queue:\n${message.toString().slice(0, 1500)}`);
    if (lead?.status === 'new') await logActivity(db, leadId, 'status', 'New → Contacted');
    return { success: true, followUp };
  } catch (err) {
    return { error: err.message };
  }
}

// A demo website for the lead, filled with their details, to send before the first call.
export async function createDemoSite(leadId) {
  try {
    await requirePlatformAdmin();
    const db = createAdminClient();
    const { data: lead } = await db.from('leads').select('*').eq('id', leadId).single();
    if (!lead) throw new Error('Unknown lead.');
    if (lead.demo_firm_id) {
      const { data: existing } = await db.from('firms').select('id, slug').eq('id', lead.demo_firm_id).maybeSingle();
      if (existing) return { firmId: existing.id, slug: existing.slug };
    }

    const name = cleanName(lead.name);
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34) || 'demo';
    const { data: taken } = await db.from('firms').select('slug').like('slug', `${base}%`);
    const used = new Set([...(taken ?? []).map((f) => f.slug), ...RESERVED_SLUGS]);
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

    const { data: firm, error } = await db.from('firms').insert({
      slug,
      name,
      city: lead.city,
      phone: lead.phone_intl || lead.phone,
      address: lead.address,
      localities: lead.locality ? [lead.locality] : [],
      demo_content: true,
    }).select('id, slug').single();
    if (error) throw error;

    await db.from('leads').update({ demo_firm_id: firm.id }).eq('id', leadId);
    await logActivity(db, leadId, 'demo', `Demo website created at /${firm.slug}`);
    revalidatePath('/admin', 'layout');
    return { firmId: firm.id, slug: firm.slug };
  } catch (err) {
    return { error: err.message };
  }
}

export async function saveTemplate(body) {
  try {
    await requirePlatformAdmin();
    const text = (body ?? '').toString().trim().slice(0, 2000);
    if (!text) throw new Error('The message can\'t be empty.');
    const { error } = await createAdminClient().from('outreach_template').upsert({ id: 1, body: text });
    if (error) throw error;
    revalidatePath('/admin/leads', 'layout');
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}
