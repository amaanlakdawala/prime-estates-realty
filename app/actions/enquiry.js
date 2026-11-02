'use server';

import { saveEnquiry } from '@/lib/enquiries';
import { visitorHash } from '@/lib/visitor';

// Website enquiries are saved here, never directly from the browser: each one can queue an automatic AI
// call to the number in it, so spam must be stopped before it reaches the database (limits in lib/enquiries.js).
// Bots that trip a check get the normal "sent" answer, so they learn nothing.

const SOURCES = ['website', 'callback', 'property', 'contact'];
const MIN_FILL_MS = 2500; // people take longer than this to fill the form

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

  return saveEnquiry({ firmId, name, phone, email, message, source, listingId, ipHash: await visitorHash() });
}
