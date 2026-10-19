import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import { fromVoiceAgent } from '@/lib/voice-key';
import { englishAmount, englishNumber, englishSize } from '@/lib/spoken-amount';
import { toEnglishPlaces } from '@/lib/place-names';
import { distanceKm, findArea, findProject, findZone, nearbyAreas, nearness } from '@/features/knowledge-base/lookup';

// Listings search for the AI voice agents (ElevenLabs "tools").
// The agents send the x-voice-key header (VOICE_TOOL_SECRET): then the search covers the firm's whole
// available inventory, including private listings and firms without a public website. Without the key
// it returns only what a website visitor can already see.
//   GET  /api/voice/listings?firm=prime-estates&area=Lower%20Parel&bhk=3&deal=buy&max_price=70000000
//   POST /api/voice/listings?firm=prime-estates   body: { args: {…} } (Retell) or {…} (ElevenLabs)
export const dynamic = 'force-dynamic';

const MAX_RESULTS = 4;

// How the agent says a price, already in English words as brokers say them on a Hinglish call ("fifty-five
// thousand per month", "eight and a half crore"): converting digits herself, she mixed up amounts.
const spokenPrice = (price, deal) => `${englishAmount(price)}${deal === 'rent' ? ' per month' : ''}`;

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
    size: l.area_sqft ? `${englishSize(l.area_sqft)} square feet` : null, // in English words, like the price
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
  // Riya writes place names in Devanagari for her voice; listings store them in English.
  const area = clean(toEnglishPlaces(params.area));
  const project = clean(toEnglishPlaces(params.project));
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
    // With a single match, the closest others too, so "और कोई option है?" gets a real property, not "हाँ" and the
    // consultant sentence.
    const taken = new Set(exact.map((l) => l.id));
    const more = exact.length < 2
      ? (await run({ withBhk: false })).concat(await run({ withPrice: false }), await run({ withArea: false, withProject: false }))
        .filter((l) => !taken.has(l.id) && taken.add(l.id)).slice(0, 2)
      : [];
    return NextResponse.json({
      matches: exact.map((l) => summarise(l, base)),
      ...(more.length && { more_options: more.map((l) => summarise(l, base)) }),
      note: 'These match what the caller asked for. Mention at most two, briefly, and offer a site visit. Never read out links.'
        + (more.length ? ' If they ask for more options, offer one from "more_options", saying briefly how it differs (area, BHK or price).' : ''),
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
    ? await run({ otherDeal: true, withProject: Boolean(project), withBhk: false, withPrice: false, limit: 2 })
    : [];

  // The sentences to say are written here, with the real areas and prices filled in: left to assemble them
  // from the lists, the agent skipped the same-area rental and named areas that have no listings.
  // In the caller's own words: "Goregaon" stays "Goregaon", even though it is matched to Goregaon West for distances.
  const asked = zone?.name ?? (project || area);
  const kind = (l) => (l.bhk ? `${englishNumber(l.bhk)} BHK` : l.property_type); // "two BHK", like the prices
  const both = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} और ${names.at(-1)}` : names[0]);
  const otherDealLine = otherDeal[0]
    ? `${otherDeal[0].locality} में एक ${kind(otherDeal[0])} ${deal === 'rent' ? 'sale' : 'rent'} के लिए है, ${spokenPrice(otherDeal[0].price, otherDeal[0].deal_type)}, अगर वो चलेगा.`
    : '';
  const rules = `Do NOT claim or hint that we have options in ${asked}, and do NOT say we do not have it. `
    + 'Say "say_now" now, in your voice, keeping its areas and prices exactly. If they ask again whether we have anything there, say "say_if_asked_again" once, '
    + 'then move on: never repeat the consultant sentence after that.';

  if (elsewhere.length) {
    const first = elsewhere[0];
    const ready = both([...new Set(elsewhere.map((l) => l.locality))]);
    return NextResponse.json({
      matches: [],
      similar: [],
      other_areas: elsewhere.map((l) => ({ ...summarise(l, base), ...(l.km != null && { km_away: l.km, nearness: nearness(l.km) }) })),
      ...(otherDeal.length && { same_area_other_deal: otherDeal.map((l) => summarise(l, base)) }),
      // What we have comes first and the consultant last: opening with "consultant options निकालेंगे" made a
      // caller ask three or four times before hearing a property.
      say_now: [
        otherDealLine,
        `${otherDealLine ? 'और ' : ''}अभी मेरे पास ${first.locality} में एक ${kind(first)} है, ${spokenPrice(first.price, first.deal_type)}${first.km > 8 ? `, ${asked} से थोड़ा दूर है` : ''}.`,
        `${asked} के और options हमारे consultant भेज देंगे. देखना चाहेंगे?`,
      ].filter(Boolean).join(' '),
      // The same-area property goes in here too: on a call she dropped it from say_now, even when asked directly.
      say_if_asked_again: [otherDealLine, `${otherDealLine ? 'बाकी' : 'अभी'} ready options ${ready} में हैं, और ${asked} के लिए consultant fresh options निकालेंगे.`].filter(Boolean).join(' '),
      note: `Nothing is listed in ${asked}. ${rules} If they say no to the first property, you may offer the next one in "other_areas".`,
    });
  }
  return NextResponse.json({
    matches: [],
    similar: [],
    other_areas: [],
    ...(otherDeal.length && { same_area_other_deal: otherDeal.map((l) => summarise(l, base)) }),
    nearby_areas: nearby,
    say_now: [otherDealLine, `${otherDealLine ? 'और' : 'ठीक है,'} ${asked} के लिए हमारे consultant आपकी requirement के हिसाब से options देखकर आपसे खुद contact करेंगे.`].filter(Boolean).join(' '),
    say_if_asked_again: `${asked} के लिए consultant fresh options निकालेंगे और आपसे contact करेंगे.`,
    note: `Nothing to offer right now. ${rules} Do not mention any other property. If you suggest other areas, use only "nearby_areas".`,
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
