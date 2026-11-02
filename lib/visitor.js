import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

// A one-way, salted hash of the visitor's IP, used only to count their recent enquiries and chat messages.
export async function visitorHash() {
  const h = await headers();
  const ip = h.get('x-nf-client-connection-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '';
  if (!ip) return null;
  return createHash('sha256').update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? ''}`).digest('hex').slice(0, 32);
}
