// A client's requirement as fields: what Riya's calls collected, what an enquiry message says, or the listing they
// asked about. Plain rules, no AI: instant, free, and the same every time.
//   { deal: ''|'buy'|'rent', type, bhkMin, bhkMax, budgetMin, budgetMax, areas: [], notes }
import { formatPrice } from '@/lib/format';

export const EMPTY = { deal: '', type: '', bhkMin: null, bhkMax: null, budgetMin: null, budgetMax: null, areas: [], notes: '' };

// "1.5 cr", "85 lakh", "60k", "₹55,000" -> rupees, or null.
export function parseAmount(text) {
  const m = String(text ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores|cror|l|lac|lacs|lakh|lakhs|k|thousand)?\b/i);
  if (!m) return null;
  const n = Number(m[1]), unit = (m[2] ?? '').toLowerCase();
  if (unit.startsWith('c')) return Math.round(n * 1e7);
  if (unit.startsWith('l')) return Math.round(n * 1e5);
  if (unit === 'k' || unit === 'thousand') return Math.round(n * 1e3);
  return n >= 1000 ? Math.round(n) : null; // a bare "2" is not a budget
}

const AMOUNT = /(?:₹|rs\.?|inr)?\s*\d+(?:[.,]\d+)*\s*(?:cr|crore|crores|l|lac|lacs|lakh|lakhs|k|thousand)\b|(?:₹|rs\.?|inr)\s*\d[\d,]{3,}|\b\d{2,3},\d{3}(?:,\d{3})?\b/gi;

// areas: the knowledge base's areas ({ name, aliases }) and region names, to find places in free text.
export function parseRequirement(text, places = []) {
  const t = ` ${String(text ?? '').toLowerCase()} `;
  const r = { ...EMPTY, areas: [] };
  if (/\b(rent|rental|on rent|kiraye|kiraya|lease|leave and license|pg)\b/.test(t)) r.deal = 'rent';
  else if (/\b(buy|buying|purchase|kharid|resale|for sale|investment|own)\b/.test(t)) r.deal = 'buy';
  if (/\b(office|commercial space)\b/.test(t)) r.type = 'office';
  else if (/\b(shop|showroom|retail)\b/.test(t)) r.type = 'shop';
  else if (/\b(plot|land)\b/.test(t)) r.type = 'plot';
  else if (/\b(villa|bungalow|row ?house)\b/.test(t)) r.type = 'villa';
  else if (/\b(flat|apartment|bhk|rk)\b/.test(t)) r.type = 'flat';

  const range = t.match(/\b([1-6])\s*(?:-|to|or|\/)\s*([1-6])\s*bhk/);
  const one = t.match(/\b([1-6])(?:\.5)?\s*-?\s*bhk/) ?? t.match(/\b([1-6])\s*bedroom/);
  if (range) { r.bhkMin = Number(range[1]); r.bhkMax = Number(range[2]); }
  else if (one) { r.bhkMin = r.bhkMax = Number(one[1]); }
  else if (/\b1\s*rk\b/.test(t)) { r.bhkMin = r.bhkMax = 1; }

  let amounts = [...t.matchAll(AMOUNT)].map((m) => parseAmount(m[0].replace(/₹|rs\.?|inr/gi, ''))).filter(Boolean);
  // A plain "25000" or "budget 9500000": 4 to 8 digits (a phone number has 10), at least 5,000.
  if (!amounts.length) amounts = [...t.matchAll(/(?<![\d+])\d{4,8}(?!\d)/g)].map((m) => Number(m[0])).filter((n) => n >= 5000);
  if (amounts.length >= 2) { r.budgetMin = Math.min(...amounts.slice(0, 2)); r.budgetMax = Math.max(...amounts.slice(0, 2)); }
  else if (amounts.length === 1) r.budgetMax = amounts[0];
  // A rent budget below 10 lakh, or a purchase above it, also tells the deal when nothing else did.
  if (!r.deal && r.budgetMax) r.deal = r.budgetMax < 1e6 ? 'rent' : 'buy';

  for (const p of places) {
    const names = [p.name, ...(p.aliases ?? [])].map((n) => n.toLowerCase()).filter((n) => n.length >= 3);
    if (names.some((n) => t.includes(` ${n}`) || t.includes(`${n} `) || t.includes(`${n},`))) r.areas.push(p.name);
  }
  r.areas = [...new Set(r.areas)].slice(0, 6);
  return r;
}

// What Riya's call collected (calls.result): deal, area, project, bhk, budget_rupees, timeline.
export function fromCallResult(result = {}) {
  const r = { ...EMPTY, areas: [] };
  const deal = String(result.deal ?? '').toLowerCase();
  if (/rent|lease|kiraya/.test(deal)) r.deal = 'rent'; else if (/buy|purchase|sale/.test(deal)) r.deal = 'buy';
  const bhk = Number.parseInt(result.bhk, 10);
  if (bhk > 0 && bhk < 10) { r.bhkMin = r.bhkMax = bhk; r.type = 'flat'; }
  const budget = Number(result.budget_rupees) || parseAmount(result.budget_rupees);
  if (budget > 0) r.budgetMax = Math.round(budget);
  for (const a of [result.area, result.project]) if (a && String(a).trim()) r.areas.push(String(a).trim());
  r.notes = [result.project && `Project: ${result.project}`, result.timeline && `Timeline: ${result.timeline}`].filter(Boolean).join(' · ');
  return r;
}

// Someone who enquired about a listing wants something like it.
export function fromListing(l) {
  return {
    ...EMPTY,
    deal: l.deal_type, type: l.property_type,
    bhkMin: l.bhk ?? null, bhkMax: l.bhk ?? null,
    budgetMax: l.price ? Math.round(l.price * 1.15) : null,
    areas: l.locality ? [l.locality] : [],
    notes: `Asked about: ${l.title}`,
  };
}

// Newer, known values replace older ones; areas add up. Returns clients-table columns.
export function mergeIntoClient(client, r) {
  const keep = (newer, older) => (newer === '' || newer == null ? older : newer);
  const areas = [...new Set([...(r.areas ?? []), ...(client.req_areas ?? [])])].slice(0, 6);
  const notes = [r.notes, client.req_notes].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ').slice(0, 500);
  return {
    req_deal: keep(r.deal, client.req_deal ?? ''),
    req_type: keep(r.type, client.req_type ?? ''),
    req_bhk_min: keep(r.bhkMin, client.req_bhk_min ?? null),
    req_bhk_max: keep(r.bhkMax, client.req_bhk_max ?? null),
    req_budget_min: keep(r.budgetMin, client.req_budget_min ?? null),
    req_budget_max: keep(r.budgetMax, client.req_budget_max ?? null),
    req_areas: areas,
    req_notes: notes,
    req_updated_at: new Date().toISOString(),
  };
}

export const hasRequirement = (c) => Boolean(c.req_deal || c.req_bhk_min || c.req_budget_max || c.req_areas?.length);

// "Rent · 2 BHK · Powai, Andheri West · up to ₹60,000/month"
export function describeRequirement(c) {
  if (!hasRequirement(c)) return 'Requirement not known yet';
  const bhk = c.req_bhk_min ? (c.req_bhk_max && c.req_bhk_max !== c.req_bhk_min ? `${c.req_bhk_min}–${c.req_bhk_max} BHK` : `${c.req_bhk_min} BHK`) : '';
  const type = !bhk && c.req_type ? c.req_type[0].toUpperCase() + c.req_type.slice(1) : '';
  const budget = c.req_budget_max
    ? `${c.req_budget_min ? `${formatPrice(c.req_budget_min, c.req_deal)} – ` : 'up to '}${formatPrice(c.req_budget_max, c.req_deal)}`
    : '';
  return [c.req_deal === 'rent' ? 'Rent' : c.req_deal === 'buy' ? 'Buy' : '', bhk || type, c.req_areas?.join(', '), budget].filter(Boolean).join(' · ');
}
