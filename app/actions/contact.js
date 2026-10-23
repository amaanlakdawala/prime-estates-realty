'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { toIndianMobile } from '@/lib/voice';

// The contact form on the platform's own home page: a brokerage asking about Amaan's services. It lands in
// the lead finder (Leads) as an Interested lead with a note, so it is followed up like every other lead.
// Bots that trip a check get the normal "sent" answer, so they learn nothing.

const MIN_FILL_MS = 2500; // people take longer than this to fill the form
const MAX_PER_HOUR = 20; // flood guard across all visitors

export async function submitServiceEnquiry(input) {
  const name = String(input?.name ?? '').trim().slice(0, 100);
  const firm = String(input?.firm ?? '').trim().slice(0, 120);
  const message = String(input?.message ?? '').trim().slice(0, 1000);
  const phone = toIndianMobile(input?.phone);

  if (input?.website || (Number(input?.startedAt) && Date.now() - Number(input.startedAt) < MIN_FILL_MS)) return { ok: true };
  if (name.length < 2) return { error: 'Enter your name.' };
  if (!phone) return { error: 'Enter a 10-digit Indian mobile number.' };

  const db = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from('leads').select('id', { count: 'exact', head: true }).like('place_id', 'site:%').gte('created_at', hourAgo);
  if ((count ?? 0) >= MAX_PER_HOUR) return { error: 'Too many requests right now. Please WhatsApp me instead.' };

  const intl = `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
  const placeId = `site:${phone.slice(1)}`; // one lead per number: asking twice adds a note to the same lead
  const { data: existing } = await db.from('leads').select('id, status').eq('place_id', placeId).maybeSingle();

  let leadId = existing?.id;
  if (existing) {
    if (['new', 'contacted'].includes(existing.status)) await db.from('leads').update({ status: 'interested' }).eq('id', existing.id);
  } else {
    const { data: lead, error } = await db.from('leads').insert({
      place_id: placeId, name: firm || name, phone: intl, phone_intl: intl, city: 'Mumbai', status: 'interested', score: 2,
    }).select('id').single();
    if (error) {
      console.error('Service enquiry not saved:', error.message);
      return { error: 'Your message could not be sent. Please WhatsApp me instead.' };
    }
    leadId = lead.id;
  }
  await db.from('lead_activities').insert({
    lead_id: leadId,
    kind: 'note',
    body: `Enquiry from the website: ${name}${firm ? ` (${firm})` : ''}, ${intl}.${message ? `\n${message}` : ''}`,
  });
  return { ok: true };
}
