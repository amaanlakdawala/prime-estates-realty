import { createAdminClient } from '@/lib/supabase/admin';

// Saves a website enquiry (the forms in app/actions/enquiry.js and the AI chatbot in lib/chat/assistant.js).
// Each one can queue an automatic AI call to the number in it (supabase/05_auto_call.sql), so the limits here
// stop floods before they reach the database. The caller has already checked the name and phone.

const LIMITS = {
  perVisitorPerHour: 5,  // same IP
  perFirmPerHour: 40,    // flood guard for one firm's site
  samePhoneMinutes: 10,  // a double-submit of the same number is saved once
};

const since = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

// { ok: true } (also when the same number was saved minutes ago), or { error } in words for the visitor.
export async function saveEnquiry({ firmId, name, phone, email = null, message = null, source, listingId = null, ipHash }) {
  const db = createAdminClient();
  const [{ data: firm }, { data: listing }, byVisitor, byFirm, samePhone] = await Promise.all([
    db.from('firms').select('id').eq('id', firmId).eq('active', true).maybeSingle(),
    listingId ? db.from('listings').select('id').eq('id', listingId).eq('firm_id', firmId).maybeSingle() : Promise.resolve({ data: null }),
    ipHash ? db.from('enquiries').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since(60)) : Promise.resolve({ count: 0 }),
    db.from('enquiries').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).gte('created_at', since(60)),
    db.from('enquiries').select('id', { count: 'exact', head: true }).eq('firm_id', firmId).eq('phone', phone).gte('created_at', since(LIMITS.samePhoneMinutes)),
  ]);
  if (!firm) return { error: 'This form could not be sent. Please call us instead.' };
  if ((samePhone.count ?? 0) > 0) return { ok: true }; // already have it
  if ((byVisitor.count ?? 0) >= LIMITS.perVisitorPerHour || (byFirm.count ?? 0) >= LIMITS.perFirmPerHour) {
    return { error: 'Too many enquiries were sent from here recently. Please call or WhatsApp us instead.' };
  }

  const { error } = await db.from('enquiries').insert({
    firm_id: firmId, name, phone, email, message, source, ip_hash: ipHash, listing_id: listing ? listingId : null,
  });
  if (error) {
    console.error('Enquiry not saved:', error.message);
    return { error: 'Your enquiry could not be sent. Check your connection and try again, or call us directly.' };
  }
  return { ok: true };
}
