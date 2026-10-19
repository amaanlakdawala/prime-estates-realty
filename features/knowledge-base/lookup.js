// Server only. Looks up towers/projects and areas in the knowledge base, and works out which areas
// are near each other from their map positions.
import { createAdminClient } from '@/lib/supabase/admin';
import { englishNumber } from '@/lib/spoken-amount';
import { toEnglishPlaces } from '@/lib/place-names';

// Read at most every 10 seconds per server instance: one search looks up several names, and an edit in the
// admin panel still reaches calls within seconds (the panel and the API can run in different instances).
let cache = { at: 0, areas: [], projects: [] };
export async function loadKnowledge() {
  if (Date.now() - cache.at < 10 * 1000) return cache;
  const db = createAdminClient();
  const [{ data: areas }, { data: projects }] = await Promise.all([
    db.from('kb_areas').select('name, zone, lat, lng, aliases'),
    db.from('kb_projects').select('name, aliases, area, developer, configurations, price_min_psf, price_max_psf, price_verified'),
  ]);
  cache = { at: Date.now(), areas: areas ?? [], projects: projects ?? [] };
  return cache;
}
export function forgetKnowledge() { cache.at = 0; }

// Callers' words arrive through speech-to-text ("Lodha World Park", "andheri (w)", "Oberoi Sky-City"),
// so names are compared loosely: lowercase letters and digits only, scored by shared letter pairs.
const norm = (s) => (s ?? '').toString().toLowerCase().replace(/\(w\)|\bwest\b/g, ' west').replace(/\(e\)|\beast\b/g, ' east').replace(/[^a-z0-9]+/g, ' ').trim();
const pairs = (s) => { const t = s.replace(/ /g, ''); return Array.from({ length: Math.max(t.length - 1, 0) }, (_, i) => t.slice(i, i + 2)); };
function similarity(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // One name inside the other ("lokhandwala" in "lokhandwala complex") counts, unless it is only a small part
  // of it: "lodha" alone must not match "lodha park".
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if ((` ${long} `).includes(` ${short} `) && short.length / long.length >= 0.6) return 0.9;
  const p = pairs(x), q = pairs(y);
  const counts = new Map();
  for (const g of q) counts.set(g, (counts.get(g) ?? 0) + 1);
  let shared = 0;
  for (const g of p) if (counts.get(g)) { shared++; counts.set(g, counts.get(g) - 1); }
  return (2 * shared) / (p.length + q.length || 1);
}
// Names may arrive in Devanagari (Riya writes place names that way for her voice): compared in English.
function bestOf(rows, name) {
  const q = toEnglishPlaces(name);
  return rows
    .map((r) => ({ row: r, score: Math.max(similarity(q, r.name), ...(r.aliases ?? []).map((a) => similarity(q, a))) }))
    .sort((a, b) => b.score - a.score)[0];
}

const MATCH = 0.72; // below this a name is treated as unknown rather than guessed

export async function findProject(q) {
  const { projects } = await loadKnowledge();
  const best = bestOf(projects, q);
  return best && best.score >= MATCH ? best.row : null;
}

export async function findArea(q) {
  const { areas } = await loadKnowledge();
  const best = bestOf(areas, q);
  return best && best.score >= MATCH ? best.row : null;
}

// Regions callers name instead of an area ("South Mumbai", "SoBo", "western line"). Each zone is the
// group of areas with that `zone` in kb_areas.
const ZONE_NAMES = {
  'South Mumbai': ['SoBo', 'South Bombay', 'Town'],
  'Central Mumbai': ['Central Bombay'],
  'Western suburbs': ['Western line', 'West suburbs', 'Western Mumbai'],
  'Eastern suburbs': ['Central line', 'East suburbs', 'Harbour line'],
  Thane: ['Thane district'],
  'Navi Mumbai': ['New Bombay', 'New Mumbai'],
  'Mira-Bhayandar': ['Mira Bhayandar', 'Mira Road Bhayandar'],
};

// { name, areas: [...], lat, lng } (lat/lng = middle of its areas), or null.
export async function findZone(q) {
  const { areas } = await loadKnowledge();
  const zones = Object.entries(ZONE_NAMES).map(([name, aliases]) => ({ name, aliases }));
  const best = bestOf(zones, q);
  if (!best || best.score < MATCH) return null;
  const inZone = areas.filter((a) => a.zone === best.row.name);
  if (!inZone.length) return null;
  const avg = (k) => inZone.reduce((s, a) => s + a[k], 0) / inZone.length;
  return { name: best.row.name, areas: inZone.map((a) => a.name), lat: avg('lat'), lng: avg('lng') };
}

// Straight-line distance in km between two areas' centres.
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// How a distance should be described to a caller.
export const nearness = (km) => (km <= 4 ? 'very close' : km <= 8 ? 'close' : km <= 15 ? 'a bit far' : 'far');

// The areas closest to `area`, nearest first, each with its distance and how near it is.
export async function nearbyAreas(area, { count = 5, withinKm = 15 } = {}) {
  const { areas } = await loadKnowledge();
  return areas
    .filter((a) => a.name !== area.name && !area.areas?.includes(a.name)) // a zone's own areas aren't "nearby"
    .map((a) => ({ name: a.name, km: Math.round(distanceKm(area, a) * 10) / 10 }))
    .filter((a) => a.km <= withinKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, count)
    .map((a) => ({ ...a, nearness: nearness(a.km) }));
}

// "about forty-five to sixty thousand rupees per square foot", or null when there is no checked price.
export function spokenRate(p) {
  if (!p.price_verified || !p.price_min_psf) return null;
  const k = (n) => englishNumber(Math.round(n / 1000));
  return p.price_max_psf && p.price_max_psf !== p.price_min_psf
    ? `about ${k(p.price_min_psf)} to ${k(p.price_max_psf)} thousand rupees per square foot`
    : `about ${k(p.price_min_psf)} thousand rupees per square foot`;
}
