// Which available listings fit a client's requirement, scored 0-100 with the reasons shown to the team.
// Server only (reads the Mumbai areas knowledge base to tell "Jogeshwari is near Andheri West").
import { findArea, findZone, distanceKm } from '@/features/knowledge-base/lookup';
import { formatPrice } from '@/lib/format';
import { hasRequirement } from './requirement';

export const MIN_SCORE = 55;           // below this a listing is not shown as a match
const NEAR_KM = 5, CLOSE_KM = 8;
const HOMES = ['flat', 'villa'];

// Resolves names to knowledge-base areas once per run: "andheri w" -> { name: 'Andheri West', lat, lng }.
export function areaResolver() {
  const cache = new Map();
  return async (name) => {
    const key = String(name ?? '').trim().toLowerCase();
    if (!key) return null;
    if (!cache.has(key)) {
      const area = await findArea(name);
      if (area) cache.set(key, { areas: [area] });
      else {
        const zone = await findZone(name);
        cache.set(key, zone ? { zone: zone.name, areas: zone.areas.map((n) => ({ name: n })) } : { raw: key, areas: [] });
      }
    }
    return cache.get(key);
  };
}

// One listing against one client: { score, reasons } or null when it does not fit.
export async function scoreListing(client, listing, resolve) {
  const reasons = [];
  let score = 0;

  if (client.req_deal) {
    if (listing.deal_type !== client.req_deal) return null;
    score += 5;
  }
  if (client.req_type) {
    const same = client.req_type === listing.property_type || (HOMES.includes(client.req_type) && HOMES.includes(listing.property_type));
    if (!same) return null;
    score += 10;
  } else score += 5;

  if (client.req_bhk_min) {
    const lo = client.req_bhk_min, hi = client.req_bhk_max ?? lo, b = listing.bhk;
    if (!HOMES.includes(listing.property_type) || b == null) return null;
    if (b >= lo && b <= hi) { score += 20; reasons.push(`${b} BHK ✓`); }
    else if (b === lo - 1 || b === hi + 1) { score += 8; reasons.push(`${b} BHK (asked ${lo === hi ? lo : `${lo}–${hi}`})`); }
    else return null;
  } else score += 10;

  if (client.req_budget_max) {
    const max = client.req_budget_max, price = Number(listing.price);
    if (price <= max) { score += 25; reasons.push(`${formatPrice(price, listing.deal_type)} ✓`); }
    else if (price <= max * 1.1) { score += 14; reasons.push(`${formatPrice(price, listing.deal_type)}, a little over ${formatPrice(max, listing.deal_type)}`); }
    else return null;
    if (client.req_budget_min && price < client.req_budget_min * 0.6) score -= 10; // far below what they want to spend
  } else score += 12;

  if (client.req_areas?.length) {
    const listingArea = (await resolve(listing.locality))?.areas?.[0];
    let best = null;
    for (const asked of client.req_areas) {
      const r = await resolve(asked);
      const exact = r?.areas?.some((a) => a.name === listingArea?.name)
        || (r?.raw && `${listing.locality} ${listing.address ?? ''} ${listing.title}`.toLowerCase().includes(r.raw));
      if (exact) { best = { points: 40, why: `${listing.locality} ✓` }; break; }
      if (listingArea?.lat != null) {
        for (const a of r?.areas ?? []) {
          if (a.lat == null) continue;
          const km = distanceKm(a, listingArea);
          if (km <= NEAR_KM && (!best || best.points < 28)) best = { points: 28, why: `${listing.locality}, near ${a.name} (${km.toFixed(1)} km)` };
          else if (km <= CLOSE_KM && !best) best = { points: 18, why: `${listing.locality}, ${km.toFixed(0)} km from ${a.name}` };
        }
      }
    }
    if (!best) return null;
    score += best.points; reasons.unshift(best.why);
  } else score += 15;

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// Every fitting listing for every client with a known requirement: [{ client_id, listing_id, score, reasons }].
export async function findMatches(clients, listings) {
  const resolve = areaResolver();
  const out = [];
  for (const c of clients) {
    if (!hasRequirement(c) || ['won', 'lost'].includes(c.stage)) continue;
    for (const l of listings) {
      if (l.status !== 'available') continue;
      const m = await scoreListing(c, l, resolve);
      if (m && m.score >= MIN_SCORE) out.push({ client_id: c.id, listing_id: l.id, ...m });
    }
  }
  return out;
}
