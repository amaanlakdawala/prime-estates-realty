import { createPublicClient } from '@/lib/supabase/public';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice, typeLabel } from '@/lib/format';
import { findArea, findZone } from '@/features/knowledge-base/lookup';

// Listings search for the website chatbot and the WhatsApp assistant. On the website it reads as a visitor: only
// listings already public on the firm's site. On WhatsApp (includePrivate) it also offers the firm's private
// listings, like the calling assistant does, but links only to listings that are on the public site.
// Prices are written as on the site.

const MAX_RESULTS = 4;

// Free text from the visitor goes into a PostgREST filter, so strip characters that have meaning there.
const clean = (s) => (s ?? '').toString().replace(/[%,()*\\.:"]/g, ' ').trim().slice(0, 60);

// What the chatbot is told about a listing, and what the chat window shows as a card.
// base: where listing pages live ('/slug', or a full address for WhatsApp); null = no link.
function card(l, base) {
  return {
    id: l.id,
    title: l.title,
    area: l.locality,
    bhk: l.bhk ?? null,
    type: typeLabel(l.property_type),
    for: l.deal_type === 'rent' ? 'rent' : 'sale',
    price: formatPrice(l.price, l.deal_type),
    size: l.area_sqft ? `${Number(l.area_sqft).toLocaleString('en-IN')} sq ft` : null,
    photo: l.photos?.[0] ?? null,
    link: base && l.show_on_website !== false ? `${base}/properties/${l.id}` : null,
  };
}

// params: { deal: 'buy'|'rent'|'any', area, type, bhk, max_price } as the chatbot's search_listings tool sends them.
// options: { includePrivate, base } for WhatsApp.
// Returns { match: 'exact'|'similar'|'other_areas'|'none', listings: [card…] }.
export async function searchListings(site, params, { includePrivate = false, base = site.base } = {}) {
  // Website: the database rules allow only available, public listings of a live website. WhatsApp: the firm's own, with the server key.
  const db = includePrivate ? createAdminClient() : createPublicClient();
  const deal = params.deal === 'rent' || params.deal === 'buy' ? params.deal : '';
  const type = ['flat', 'villa', 'plot', 'office', 'shop'].includes(params.type) ? params.type : '';
  const bhk = Number.parseInt(params.bhk, 10) || 0;
  const maxPrice = Number(params.max_price) || 0;
  const area = clean(params.area);
  const zone = area && !(await findArea(area)) ? await findZone(area) : null; // "South Mumbai", "Western suburbs"…

  const run = async ({ withArea = true, withBhk = true, withPrice = true } = {}) => {
    let q = db.from('listings')
      .select('id, title, locality, bhk, property_type, deal_type, price, area_sqft, photos, show_on_website')
      .eq('firm_id', site.id)
      .eq('status', 'available');
    if (deal) q = q.eq('deal_type', deal);
    if (type) q = q.eq('property_type', type);
    else if (bhk > 0) q = q.in('property_type', ['flat', 'villa']); // a BHK means a home, even when BHK is relaxed
    if (withBhk && bhk > 0) q = bhk >= 4 ? q.gte('bhk', 4) : q.eq('bhk', bhk);
    if (withPrice && maxPrice > 0) q = q.lte('price', Math.round(maxPrice * 1.1)); // a little over budget is still worth showing
    if (withArea && zone) q = q.or(zone.areas.map((n) => `locality.ilike.%${clean(n)}%`).join(','));
    else if (withArea && area) q = q.or(`locality.ilike.%${area}%,address.ilike.%${area}%,title.ilike.%${area}%`);
    const { data, error } = await q.order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(MAX_RESULTS);
    if (error) console.error('Chat search failed:', error.message);
    return data ?? [];
  };

  const linkBase = site.websiteEnabled === false ? null : base;
  const result = (match, rows) => ({ match, listings: rows.map((l) => card(l, linkBase)) });
  const exact = await run();
  if (exact.length) return result('exact', exact);
  if (bhk || maxPrice) {
    const seen = new Set();
    const similar = (await run({ withBhk: false })).concat(await run({ withPrice: false }))
      .filter((l) => !seen.has(l.id) && seen.add(l.id)).slice(0, MAX_RESULTS);
    if (similar.length) return result('similar', similar);
  }
  if (area) {
    const elsewhere = await run({ withArea: false });
    if (elsewhere.length) return result('other_areas', elsewhere);
  }
  return result('none', []);
}
