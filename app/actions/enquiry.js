'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

// Website enquiries are saved here, never directly from the browser: each one can queue an automatic AI
// call to the number in it, so spam must be stopped before it reaches the database.
// Bots that trip a check get the normal "sent" answer, so they learn nothing.

const LIMITS = {
  perVisitorPerHour: 5,  // same IP
  perFirmPerHour: 40,    // flood guard for one firm's site
  samePhoneMinutes: 10,  // a double-submit of the same number is saved once
};
const SOURCES = ['website', 'callback', 'property', 'contact'];
const MIN_FILL_MS = 2500; // people take longer than this to fill the form

const since = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

async function visitorHash() {
  const h = await headers();
  const ip = h.get('x-nf-client-connection-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '';
  if (!ip) return null;
  // One-way and salted: used only to count recent enquiries from the same visitor.
  return createHash('sha256').update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? ''}`).digest('hex').slice(0, 32);
}

export async function submitEnquiry(input) {
  const name = String(input?.name ?? '').trim().slice(0, 100);
  const phone = String(input?.phone ?? '').trim().slice(0, 30);
  const email = String(input?.email ?? '').trim().slice(0, 150) || null;
  const message = String(input?.message ?? '').trim().slice(0, 2000) || null;
  const source = SOURCES.includes(input?.source) ? input.source : 'website';
  const firmId = String(input?.firmId ?? '');
  const listingId = input?.listingId ? String(input.listingId) : null;

  // Honeypot (a hidden field people never fill) and too-fast submissions: pretend it worked.
  if (input?.website || (Number(input?.startedAt) && Date.now() - Number(input.startedAt) < MIN_FILL_MS)) return { ok: true };

  if (name.length < 2) return { error: 'Enter your name.' };
  if (phone.replace(/\D/g, '').length < 10) return { error: 'Enter a 10-digit mobile number.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Check the email address, or leave it empty.' };
  if (!/^[0-9a-f-]{36}$/i.test(firmId) || (listingId && !/^[0-9a-f-]{36}$/i.test(listingId))) return { error: 'This form could not be sent. Please call us instead.' };

  const db = createAdminClient();
  const ip_hash = await visitorHash();
  const [{ data: firm }, { data: listing }, byVisitor, byFirm, samePhone] = await Promise.all([
    db.from('firms').select('id').eq('id', firmId).eq('active', true).maybeSingle(),
    listingId ? db.from('listings').select('id').eq('id', listingId).eq('firm_id', firmId).maybeSingle() : Promise.resolve({ data: null }),
    ip_hash ? db.from('enquiries').select('id', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since(60)) : Promise.resolve({ count: 0 }),
    db.from('enquiries').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).gte('created_at', since(60)),
    db.from('enquiries').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).eq('phone', phone).gte('created_at', since(LIMITS.samePhoneMinutes)),
  ]);
  if (!firm) return { error: 'This form could not be sent. Please call us instead.' };
  if ((samePhone.count ?? 0) > 0) return { ok: true }; // already have it
  if ((byVisitor.count ?? 0) >= LIMITS.perVisitorPerHour || (byFirm.count ?? 0) >= LIMITS.perFirmPerHour) {
    return { error: 'Too many enquiries were sent from here recently. Please call or WhatsApp us instead.' };
  }

  const { error } = await db.from('enquiries').insert({
    firm_id: firmId, name, phone, email, message, source, ip_hash, listing_id: listing ? listingId : null,
  });
  if (error) {
    console.error('Enquiry not saved:', error.message);
    return { error: 'Your enquiry could not be sent. Check your connection and try again, or call us directly.' };
  }
  return { ok: true };
}
