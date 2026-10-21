// WhatsApp write-ups: one fixed layout for every property, whether it came from a listing or from
// pasted text the AI tidied. WhatsApp formatting: *bold*, _italic_. Safe to use in the browser.
import { formatPrice, typeLabel } from '@/lib/format';

// The fields a write-up is built from. Every field is a string ('' = not known) or a list of strings.
export const EMPTY_PROPERTY = {
  headline: '', deal: '', location: '', price: '', area: '', floor: '', furnishing: '', parking: '',
  facing: '', possession: '', amenities: [], highlights: [], notes: '', rera: '', link: '',
};

const FURNISHING = ['Fully furnished', 'Semi-furnished'];
const PARKING = ['Covered parking'];

// A platform listing turned into write-up fields. Only public listings of a live website get a link.
export function propertyFromListing(listing, site, { origin = '', withPrice = true, withNotes = false } = {}) {
  const amenities = listing.amenities ?? [];
  const deal = listing.deal_type === 'rent' ? 'Rent' : 'Sale';
  const kind = typeLabel(listing.property_type).split('/')[0].trim();
  const headline = [listing.bhk ? `${listing.bhk} BHK` : '', kind, `for ${deal}`].filter(Boolean).join(' ');
  const linkable = origin && site.websiteEnabled !== false && listing.show_on_website !== false;
  return {
    ...EMPTY_PROPERTY,
    headline,
    deal,
    location: [listing.title?.includes(listing.locality) ? listing.title.replace(/^.*\bin\s+/i, '') : listing.locality, site.city]
      .filter((v, i, a) => v && a.indexOf(v) === i).join(', '),
    price: withPrice ? formatPrice(listing.price, listing.deal_type) : '',
    area: listing.area_sqft ? `${Number(listing.area_sqft).toLocaleString('en-IN')} sq ft` : '',
    floor: listing.floor ?? '',
    furnishing: amenities.find((a) => FURNISHING.includes(a)) ?? '',
    parking: amenities.includes('Covered parking') ? 'Covered' : '',
    amenities: amenities.filter((a) => !FURNISHING.includes(a) && !PARKING.includes(a)).slice(0, 6),
    notes: withNotes && listing.description ? listing.description.replace(/\s+/g, ' ').trim().slice(0, 280) : '',
    rera: listing.rera_number ?? '',
    link: linkable ? `${origin}/${site.slug}/properties/${listing.id}` : '',
  };
}

// "8097546742", "+91 80975-46742" -> "+91 80975 46742"; anything else is returned as typed.
export function prettyPhone(phone) {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : (phone ?? '').trim();
}

export const validPhone = (phone) => (phone ?? '').replace(/\D/g, '').length >= 10;

// One property block. emoji: false gives a plain, label-only version.
function block(p, e) {
  const icon = (sym) => (e ? `${sym} ` : '');
  const row = (sym, label, value) => (value ? `${icon(sym)}*${label}:* ${value}` : null);
  const lines = [
    `${icon('🏡')}*${p.headline || 'Property'}*`,
    p.location ? `${icon('📍')}${p.location}` : null,
    '',
    row('💰', 'Price', p.price),
    row('📐', 'Area', p.area),
    row('🏢', 'Floor', p.floor),
    row('🛋️', 'Furnishing', p.furnishing),
    row('🚗', 'Parking', p.parking),
    row('🧭', 'Facing', p.facing),
    row('🗓️', 'Possession', p.possession),
    p.amenities?.length ? `${icon('✅')}*Amenities:* ${p.amenities.join(', ')}` : null,
    ...(p.highlights ?? []).slice(0, 5).map((h) => `${e ? '✨' : '•'} ${h}`),
    p.notes ? `\n${p.notes}` : null,
    p.rera ? `${icon('🧾')}MahaRERA: ${p.rera}` : null,
    p.link ? `\n${icon('🔗')}Photos & details: ${p.link}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function contactBlock(contact, firmName, e) {
  const who = [contact.name?.trim(), prettyPhone(contact.phone)].filter(Boolean).join(' – ');
  return [`${e ? '📞 ' : ''}*Contact:* ${who}`, firmName ? `_${firmName}_` : null].filter(Boolean).join('\n');
}

// The full message: each property followed by the contact, separated by a divider.
export function renderWriteup(properties, contact, { firmName = '', emoji = true } = {}) {
  const divider = emoji ? '━━━━━━━━━━━━━━' : '--------------';
  return properties.map((p) => `${block(p, emoji)}\n\n${contactBlock(contact, firmName, emoji)}`).join(`\n\n${divider}\n\n`);
}
