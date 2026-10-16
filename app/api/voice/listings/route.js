import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import { fromVoiceAgent } from '@/lib/voice-key';
import { hindiAmount } from '@/lib/hindi-amount';
import { distanceKm, findArea, findProject, findZone, nearbyAreas, nearness } from '@/features/knowledge-base/lookup';

// Listings search for the AI voice agents (ElevenLabs "tools").
// The agents send the x-voice-key header (VOICE_TOOL_SECRET): then the search covers the firm's whole
// available inventory, including private listings and firms without a public website. Without the key
// it returns only what a website visitor can already see.
//   GET  /api/voice/listings?firm=prime-estates&area=Lower%20Parel&bhk=3&deal=buy&max_price=70000000
//   POST /api/voice/listings?firm=prime-estates   body: { args: {…} } (Retell) or {…} (ElevenLabs)
export const dynamic = 'force-dynamic';

const MAX_RESULTS = 4;

// How the agent should say a price out loud, already in Hindi words ("पचपन हज़ार महीना", "साढ़े आठ करोड़"):
// converting digits herself, she said 55,000 as "पचास पाँच हज़ार" and mixed up amounts.
const spokenPrice = (price, deal) => `${hindiAmount(price)}${deal === 'rent' ? ' महीना' : ''}`;

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
  // Property type in the caller's words: shop, office, plot, villa/bungalow, flat/apartment.
  const t = (params.type ?? '').toString().toLowerCase();
  const type = /shop|retail|showroom/.test(t) ? 'shop' : /office|commercial/.test(t) ? 'office' : /plot|land/.test(t) ? 'plot'
    : /villa|bungalow|house/.test(t) ? 'villa' : /flat|apartment/.test(t) ? 'flat' : '';
  const maxPrice = Number(params.max_price) || 0;
  const area = clean(params.area);
  const project = clean(params.project);
  // "South Mumbai", "Western suburbs"…: a region, searched as all the areas in it.
  const areaRow = area ? await findArea(area) : null;
  const zone = area && !areaRow ? await findZone(area) : null;

  const run = async ({ withProject = true, withArea = true, withBhk = true, withPrice = true, otherDeal = false, limit = MAX_RESULTS } = {}) => {
    let q = db.from('listings')
      .select('id, title, locality, address, bhk, property_type, deal_type, price, area_sqft, show_on_website')
      .eq('firm_id', firm.id)
      .eq('status', 'available');
    if (deal) q = q.eq('deal_type', otherDeal ? (deal === 'rent' ? 'buy' : 'rent') : deal);
    if (type) q = q.eq('property_type', type);
    else if (bhk > 0) q = q.in('property_type', ['flat', 'villa']); // asking for a BHK means a home, even when BHK is relaxed
    if (withBhk && bhk > 0) q = bhk >= 4 ? q.gte('bhk', 4) : q.eq('bhk', bhk);
    if (withPrice && maxPrice > 0) q = q.lte('price', Math.round(maxPrice * 1.1)); // a little over budget is still worth mentioning
    // A project already pins down the area, so search by project when there is one, otherwise by area.
    if (withProject && project) q = q.or(`title.ilike.%${project}%,address.ilike.%${project}%`);
    else if (withArea && zone) q = q.or(zone.areas.map((n) => `locality.ilike.%${clean(n)}%`).join(','));
    else if (withArea && area) q = q.or(`locality.ilike.%${area}%,address.ilike.%${area}%,title.ilike.%${area}%`);
    const { data } = await q.order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
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
  // Nearest first (from the knowledge base's map positions); ones that fit BHK and budget come before the rest.
  const wanted = areaRow ?? zone ?? (project ? await findArea((await findProject(project))?.area ?? '') : null);
  const kmFrom = async (l) => {
    const at = wanted && (await findArea(l.locality));
    return at ? Math.round(distanceKm(wanted, at) * 10) / 10 : null;
  };
  const byDistance = async (rows) => {
    const withKm = await Promise.all(rows.map(async (l) => ({ ...l, km: await kmFrom(l) })));
    return withKm.sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
  };
  const elsewhere = area || project
    ? fresh((await byDistance(await run({ withProject: false, withArea: false, limit: 40 })))
      .concat(await byDistance(await run({ withProject: false, withArea: false, withBhk: false, withPrice: false, limit: 40 }))))
    : [];
  const nearby = wanted ? (await nearbyAreas(wanted, { count: 4, withinKm: 8 })).map((a) => a.name) : [];
  // In the area they asked, but for rent when they want to buy (or the other way round): worth a mention,
  // e.g. a caller who knows of the firm's Goregaon East rental and asks "Goregaon East में है ना?".
  const otherDeal = deal && (area || project)
    ? (await run({ otherDeal: true, withProject: Boolean(project), withBhk: false, withPrice: false, limit: 2 })).map((l) => summarise(l, base))
    : [];
  const otherDealNote = otherDeal.length
    ? ` "same_area_other_deal" is in the area they asked but for ${deal === 'rent' ? 'sale' : 'rent'}: right after the consultant clause, mention it in one line `
      + `("<area> में एक <BHK> ${deal === 'rent' ? 'sale' : 'rent'} के लिए है, <price>, अगर वो भी चलेगा"), then the first "other_areas" property.`
    : '';
  const askedAgain = ' If they ask again whether we have anything in that area, answer once, honestly and without the forbidden words: '
    + '"<area> के लिए consultant fresh options निकालेंगे, अभी ready options <areas from other_areas> में हैं." Name only areas that appear in "other_areas". Do not repeat the consultant sentence after that.';
  if (elsewhere.length) {
    return NextResponse.json({
      matches: [],
      similar: [],
      other_areas: elsewhere.map((l) => ({ ...summarise(l, base), ...(l.km != null && { km_away: l.km, nearness: nearness(l.km) }) })),
      ...(otherDeal.length && { same_area_other_deal: otherDeal }),
      nearby_areas: nearby,
      note: 'Nothing is listed in the area or project they asked for, so do NOT claim or hint that we have options there. Do NOT say we do not have it either. '
        + 'In this same reply: one short clause that the consultant will look for options there (only if you have not said so already), then describe the first '
        + 'property in "other_areas" with its area, BHK and price, and ask if they would like to see it. Do not just name areas: name the property. '
        + 'If its "nearness" is "far" or "a bit far", say honestly that it is some distance away. Say prices exactly as written in "price".'
        + otherDealNote + askedAgain,
    });
  }
  return NextResponse.json({
    matches: [],
    similar: [],
    other_areas: [],
    ...(otherDeal.length && { same_area_other_deal: otherDeal }),
    nearby_areas: nearby,
    note: 'Nothing to offer right now. Do not mention any other property, and do not claim or hint that we have options. '
      + 'Do NOT say we do not have it: say the consultant will look for options for their requirement and contact them. '
      + 'If you suggest other areas, use only "nearby_areas".' + otherDealNote,
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  return search(Object.fromEntries(url.searchParams), url.origin, fromVoiceAgent(request));
}

export async function POST(request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const args = body?.args ?? body ?? {}; // Retell sends { name, args, call }; ElevenLabs sends the parameters directly
  return search({ ...Object.fromEntries(url.searchParams), ...args }, url.origin, fromVoiceAgent(request));
}
