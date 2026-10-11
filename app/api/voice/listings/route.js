import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

// Listings search for the AI voice agents (Retell / ElevenLabs "tools").
// Returns only what a website visitor can already see: available listings of an active firm.
//   GET  /api/voice/listings?firm=prime-estates&area=Lower%20Parel&bhk=3&deal=buy&max_price=70000000
//   POST /api/voice/listings?firm=prime-estates   body: { args: {…} } (Retell) or {…} (ElevenLabs)
export const dynamic = 'force-dynamic';

const MAX_RESULTS = 4;

// How the agent should say a price out loud.
function spokenPrice(price, deal) {
  const p = Number(price) || 0;
  const trim = (n) => Number(n.toFixed(2)).toString();
  if (deal === 'rent') return `${p.toLocaleString('en-IN')} rupees per month`;
  if (p >= 1e7) return `${trim(p / 1e7)} crore`;
  if (p >= 1e5) return `${trim(p / 1e5)} lakh`;
  return `${p.toLocaleString('en-IN')} rupees`;
}

// Free text from the caller goes into a PostgREST filter, so strip characters that have meaning there.
const clean = (s) => (s ?? '').toString().replace(/[%,()*\\.:"]/g, ' ').trim().slice(0, 60);

function summarise(l, base) {
  return {
    title: l.title,
    area: l.locality,
    bhk: l.bhk ?? null,
    type: l.property_type,
    for: l.deal_type === 'rent' ? 'rent' : 'sale',
    price: spokenPrice(l.price, l.deal_type),
    size: l.area_sqft ? `${Number(l.area_sqft).toLocaleString('en-IN')} sq ft` : null,
    link: `${base}/properties/${l.id}`,
  };
}

async function search(params, origin) {
  const slug = clean(params.firm).toLowerCase();
  if (!slug) return NextResponse.json({ error: 'firm is required' }, { status: 400 });

  const db = createPublicClient();
  const { data: firm } = await db.from('firms').select('id, slug, name').eq('slug', slug).eq('active', true).maybeSingle();
  if (!firm) return NextResponse.json({ error: 'Unknown firm' }, { status: 404 });

  const deal = /rent/i.test(params.deal ?? '') ? 'rent' : /buy|sale|purchase/i.test(params.deal ?? '') ? 'buy' : '';
  const bhk = Number.parseInt(params.bhk, 10);
  const maxPrice = Number(params.max_price) || 0;
  const area = clean(params.area);
  const project = clean(params.project);

  const run = async ({ withProject = true, withBhk = true, withPrice = true } = {}) => {
    let q = db.from('listings')
      .select('id, title, locality, address, bhk, property_type, deal_type, price, area_sqft')
      .eq('firm_id', firm.id)
      .eq('status', 'available');
    if (deal) q = q.eq('deal_type', deal);
    if (withBhk && bhk > 0) q = bhk >= 4 ? q.gte('bhk', 4) : q.eq('bhk', bhk);
    if (withPrice && maxPrice > 0) q = q.lte('price', Math.round(maxPrice * 1.1)); // a little over budget is still worth mentioning
    // A project already pins down the area, so search by project when there is one, otherwise by area.
    if (withProject && project) q = q.or(`title.ilike.%${project}%,address.ilike.%${project}%`);
    else if (area) q = q.or(`locality.ilike.%${area}%,address.ilike.%${area}%,title.ilike.%${area}%`);
    const { data } = await q.order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(MAX_RESULTS);
    return data ?? [];
  };

  const base = `${origin}/${firm.slug}`;
  const exact = await run();
  if (exact.length) {
    return NextResponse.json({
      matches: exact.map((l) => summarise(l, base)),
      note: 'These match what the caller asked for. Mention at most two, briefly, and offer a site visit. Never read out links.',
    });
  }

  // Nothing exact: look for something close, but never tell the caller "we don't have it".
  const similar = project ? await run({ withProject: false }) : (await run({ withBhk: false })).concat(await run({ withPrice: false }));
  const seen = new Set();
  const close = similar.filter((l) => !seen.has(l.id) && seen.add(l.id)).slice(0, 2);
  return NextResponse.json({
    matches: [],
    similar: close.map((l) => summarise(l, base)),
    note: 'No exact match is listed. Do NOT say we do not have it. Say: our consultant will share suitable options with you on WhatsApp. '
      + (close.length ? 'You may briefly mention one similar option from "similar" if it is relevant.' : 'Do not mention any specific property.'),
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  return search(Object.fromEntries(url.searchParams), url.origin);
}

export async function POST(request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const args = body?.args ?? body ?? {}; // Retell sends { name, args, call }; ElevenLabs sends the parameters directly
  return search({ ...Object.fromEntries(url.searchParams), ...args }, url.origin);
}
