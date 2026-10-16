import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';

// Listings search for the AI voice agents (ElevenLabs "tools").
// The agents send the x-voice-key header (VOICE_TOOL_SECRET): then the search covers the firm's whole
// available inventory, including private listings and firms without a public website. Without the key
// it returns only what a website visitor can already see.
//   GET  /api/voice/listings?firm=prime-estates&area=Lower%20Parel&bhk=3&deal=buy&max_price=70000000
//   POST /api/voice/listings?firm=prime-estates   body: { args: {…} } (Retell) or {…} (ElevenLabs)
export const dynamic = 'force-dynamic';

const MAX_RESULTS = 4;

// How the agent should say a price out loud.
function spokenPrice(price, deal) {
  const p = Number(price) || 0;
  const trim = (n) => Number(n.toFixed(2)).toString();
  // Rents as people say them ("1.25 lakh per month", "48 thousand per month"): the agent misread long digit strings.
  if (deal === 'rent') return p >= 1e5 ? `${trim(p / 1e5)} lakh per month` : p >= 1e3 ? `${trim(p / 1e3)} thousand per month` : `${p} rupees per month`;
  if (p >= 1e7) return `${trim(p / 1e7)} crore`;
  if (p >= 1e5) return `${trim(p / 1e5)} lakh`;
  return `${p.toLocaleString('en-IN')} rupees`;
}

// Free text from the caller goes into a PostgREST filter, so strip characters that have meaning there.
const clean = (s) => (s ?? '').toString().replace(/[%,()*\\.:"]/g, ' ').trim().slice(0, 60);

// The agent's key, compared in constant time.
function trusted(request) {
  const expected = process.env.VOICE_TOOL_SECRET;
  const given = request.headers.get('x-voice-key') ?? '';
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function summarise(l, base) {
  return {
    title: l.title,
    area: l.locality,
    bhk: l.bhk ?? null,
    type: l.property_type,
    for: l.deal_type === 'rent' ? 'rent' : 'sale',
    price: spokenPrice(l.price, l.deal_type),
    size: l.area_sqft ? `${Number(l.area_sqft).toLocaleString('en-IN')} sq ft` : null,
    link: base && l.show_on_website !== false ? `${base}/properties/${l.id}` : null, // never link to a page that isn't public
  };
}

async function search(params, origin, isAgent) {
  const slug = clean(params.firm).toLowerCase();
  if (!slug) return NextResponse.json({ error: 'firm is required' }, { status: 400 });

  const db = isAgent ? createAdminClient() : createPublicClient();
  const { data: firm } = await db.from('firms').select('id, slug, name, website_enabled').eq('slug', slug).eq('active', true).maybeSingle();
  if (!firm) return NextResponse.json({ error: 'Unknown firm' }, { status: 404 });

  const deal = /rent/i.test(params.deal ?? '') ? 'rent' : /buy|sale|purchase/i.test(params.deal ?? '') ? 'buy' : '';
  const bhk = Number.parseInt(params.bhk, 10);
  const maxPrice = Number(params.max_price) || 0;
  const area = clean(params.area);
  const project = clean(params.project);

  const run = async ({ withProject = true, withArea = true, withBhk = true, withPrice = true } = {}) => {
    let q = db.from('listings')
      .select('id, title, locality, address, bhk, property_type, deal_type, price, area_sqft, show_on_website')
      .eq('firm_id', firm.id)
      .eq('status', 'available');
    if (deal) q = q.eq('deal_type', deal);
    if (withBhk && bhk > 0) q = bhk >= 4 ? q.gte('bhk', 4) : q.eq('bhk', bhk);
    if (withPrice && maxPrice > 0) q = q.lte('price', Math.round(maxPrice * 1.1)); // a little over budget is still worth mentioning
    // A project already pins down the area, so search by project when there is one, otherwise by area.
    if (withProject && project) q = q.or(`title.ilike.%${project}%,address.ilike.%${project}%`);
    else if (withArea && area) q = q.or(`locality.ilike.%${area}%,address.ilike.%${area}%,title.ilike.%${area}%`);
    const { data } = await q.order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(MAX_RESULTS);
    return data ?? [];
  };

  const base = firm.website_enabled === false ? '' : `${origin}/${firm.slug}`;
  const exact = await run();
  if (exact.length) {
    return NextResponse.json({
      matches: exact.map((l) => summarise(l, base)),
      note: 'These match what the caller asked for. Mention at most two, briefly, and offer a site visit. Never read out links.',
    });
  }

  // Nothing exact: look for something close, but never tell the caller "we don't have it".
  const seen = new Set();
  const fresh = (rows) => rows.filter((l) => !seen.has(l.id) && seen.add(l.id)).slice(0, 2);
  const similar = fresh(project ? await run({ withProject: false }) : (await run({ withBhk: false })).concat(await run({ withPrice: false })));
  if (similar.length) {
    return NextResponse.json({
      matches: [],
      similar: similar.map((l) => summarise(l, base)),
      note: 'No exact match. "similar" is in the area or project they asked for but differs in BHK or budget. Do NOT say we do not have it. '
        + 'Offer one of them, saying briefly how it differs, and add that the consultant will share more options on WhatsApp.',
    });
  }

  // Nothing in that area at all: the closest real options elsewhere in the firm's listings, so that a caller
  // asking "what do you have right now?" gets an honest answer instead of the same sentence again.
  const elsewhere = area || project
    ? fresh((await run({ withProject: false, withArea: false })).concat(await run({ withProject: false, withArea: false, withBhk: false, withPrice: false })))
    : [];
  if (elsewhere.length) {
    return NextResponse.json({
      matches: [],
      similar: [],
      other_areas: elsewhere.map((l) => summarise(l, base)),
      note: 'Nothing is listed in the area or project they asked for, so do NOT claim or hint that we have options there. Do NOT say we do not have it either. '
        + 'In this same reply: one short clause that the consultant will look for options there (only if you have not said so already), then describe the first '
        + 'property in "other_areas" with its area, BHK and price, and ask if they would like to see it. Do not just name areas: name the property.',
    });
  }
  return NextResponse.json({
    matches: [],
    similar: [],
    other_areas: [],
    note: 'Nothing to offer right now. Do not mention any property, and do not claim or hint that we have options. '
      + 'Do NOT say we do not have it: say the consultant will look for options for their requirement and contact them.',
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  return search(Object.fromEntries(url.searchParams), url.origin, trusted(request));
}

export async function POST(request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const args = body?.args ?? body ?? {}; // Retell sends { name, args, call }; ElevenLabs sends the parameters directly
  return search({ ...Object.fromEntries(url.searchParams), ...args }, url.origin, trusted(request));
}
