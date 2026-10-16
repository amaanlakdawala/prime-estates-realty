// The AI assistant's "lookup_place" tool: where a tower/project is, an approximate rate when it has been
// checked, and which areas are near. Only for our voice agents (x-voice-key): the list is not public.
//   GET /api/voice/places?name=Lodha%20World%20Park
import { NextResponse } from 'next/server';
import { fromVoiceAgent } from '@/lib/voice-key';
import { findArea, findProject, findZone, nearbyAreas, spokenRate } from './lookup';

export async function placesHandler(request) {
  if (!fromVoiceAgent(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  const url = new URL(request.url);
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const name = (url.searchParams.get('name') ?? body?.name ?? body?.args?.name ?? '').toString().trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const project = await findProject(name);
  if (project) {
    const area = await findArea(project.area);
    const rate = spokenRate(project);
    return NextResponse.json({
      found: 'project',
      project: {
        name: project.name,
        area: project.area,
        zone: area?.zone ?? null,
        developer: project.developer,
        configurations: project.configurations,
        approx_rate: rate,
      },
      nearby_areas: area ? await nearbyAreas(area) : [],
      note: `${project.name} is in ${project.area}. Say so naturally. `
        + (rate ? `Its approximate market rate is ${rate}: if asked, say it is approximate and the consultant will confirm exact prices. `
          : 'There is no checked price for it: do not give any price or rate for it; say the consultant will share prices. ')
        + `Then search our listings with project "${project.name}" and area "${project.area}".`,
    });
  }

  const area = await findArea(name);
  if (area) {
    return NextResponse.json({
      found: 'area',
      area: { name: area.name, zone: area.zone },
      nearby_areas: await nearbyAreas(area),
      note: `${area.name} is an area (${area.zone}). "nearby_areas" lists the areas closest to it, nearest first, with distances: `
        + 'when suggesting alternatives, suggest only "very close" or "close" ones.',
    });
  }

  const zone = await findZone(name);
  if (zone) {
    return NextResponse.json({
      found: 'region',
      region: { name: zone.name, areas: zone.areas },
      note: `${zone.name} is a region, not one area. It covers: ${zone.areas.join(', ')}. Ask which of these areas they prefer, or search the region as it is.`,
    });
  }

  return NextResponse.json({
    found: null,
    note: 'This name is not in our list. Do not guess where it is or what it costs: ask the caller which area it is in.',
  });
}
