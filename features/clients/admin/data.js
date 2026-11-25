// Server-side loading shared by the clients pages.
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/format';
import { describeRequirement } from '../requirement';

// The firm as a full row, for the sync and matching (the admin context only carries the site view of it).
export async function firmRow(firmId) {
  const { data } = await createAdminClient().from('firms').select('*').eq('id', firmId).single();
  return data;
}

// Matches as MatchCard props. filter(q) narrows the query: by status, client, listing.
export async function loadMatches(firmId, filter = (q) => q, limit = 50) {
  const { data, error } = await filter(createAdminClient().from('client_matches')
    .select('id, score, reasons, status, created_at, clients(*), listings(id, title, locality, price, deal_type, photos)')
    .eq('firm_id', firmId))
    .order('score', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
  return {
    error,
    matches: (data ?? []).filter((m) => m.clients && m.listings).map((m) => ({
      id: m.id, score: m.score, reasons: m.reasons, status: m.status,
      client: { id: m.clients.id, name: m.clients.name, phone: m.clients.phone, req: describeRequirement(m.clients) },
      listing: { id: m.listings.id, title: m.listings.title, locality: m.listings.locality, price: formatPrice(m.listings.price, m.listings.deal_type), photo: m.listings.photos?.[0] ?? null },
    })),
  };
}

// Shown instead of a page when supabase/15_clients.sql has not been run yet.
export const notSetUp = (error) => error && /client|relation|does not exist|schema cache/i.test(error.message ?? '');
