// ------------------------------------------------------------
// Firm details. Each client's copy of the site sets these as environment variables
// in Netlify (Project configuration -> Environment variables), so one codebase serves
// every firm. The values after || are used when a variable isn't set.
// See CLIENT_SETUP.md for the full list.
//
// Each variable must be written out in full (process.env.NEXT_PUBLIC_...) so Next.js
// can bake it into the pages at build time.
// ------------------------------------------------------------

const name = process.env.NEXT_PUBLIC_FIRM_NAME || 'Prime Estates Realty';
const city = process.env.NEXT_PUBLIC_FIRM_CITY || 'Pune';
const phoneDisplay = process.env.NEXT_PUBLIC_FIRM_PHONE || '+91 98926 62324';
const address = process.env.NEXT_PUBLIC_FIRM_ADDRESS || 'Office 402, Sai Heritage, Baner Road, Baner, Pune 411045';
const localities = (
  process.env.NEXT_PUBLIC_FIRM_LOCALITIES ||
  'Baner, Balewadi, Aundh, Wakad, Hinjewadi, Pimple Saudagar, Kothrud, Kharadi, Viman Nagar, Hadapsar'
)
  .split(',')
  .map((l) => l.trim())
  .filter(Boolean);

// "+91 98926 62324" or "9892662324" -> "919892662324". A bare 10-digit number is treated as Indian.
function toInternationalDigits(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}
const phoneDigits = toInternationalDigits(phoneDisplay);

export const site = {
  name,
  city,
  description: `${city} real estate brokerage for buying, selling and renting flats, villas, plots, offices and shops.`,
  phoneDisplay,
  phoneHref: `+${phoneDigits}`,
  whatsapp: toInternationalDigits(process.env.NEXT_PUBLIC_FIRM_WHATSAPP || phoneDisplay), // digits only, with country code
  email: process.env.NEXT_PUBLIC_FIRM_EMAIL || 'info@primeestatesrealty.com',
  address,
  hours: process.env.NEXT_PUBLIC_FIRM_HOURS || 'Monday to Saturday, 10 am to 7 pm',
  // Every mention of MahaRERA is hidden until the firm's real registration number is set.
  mahareraAgentNo: process.env.NEXT_PUBLIC_FIRM_RERA_NO || '',
  // Sample testimonials and team members, for demo sites only. Never on a live client site.
  demoContent: process.env.NEXT_PUBLIC_DEMO_CONTENT === 'true',
  foundedYear: Number(process.env.NEXT_PUBLIC_FIRM_FOUNDED_YEAR) || 2012,
  logoUrl: process.env.NEXT_PUBLIC_FIRM_LOGO_URL || '', // optional; a house icon is drawn when empty
  mapQuery: address,
  localities,
};

// "Baner, Aundh and Wakad" from the first few localities, for running text.
export function localityList(count = 3) {
  const items = site.localities.slice(0, count);
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? site.city;
}

export const PROPERTY_TYPES = [
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'villa', label: 'Villa / Bungalow' },
  { value: 'plot', label: 'Plot / Land' },
  { value: 'office', label: 'Office space' },
  { value: 'shop', label: 'Shop / Showroom' },
];

export const DEAL_TYPES = [
  { value: 'buy', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
];

export const AMENITIES = [
  'Covered parking',
  'Lift',
  'Power backup',
  '24x7 security',
  'CCTV',
  'Gym',
  'Swimming pool',
  'Clubhouse',
  'Garden',
  "Children's play area",
  'Piped gas',
  'Rainwater harvesting',
  'Fully furnished',
  'Semi-furnished',
  'Pet friendly',
];

export const BUY_BUDGETS = [
  { value: 2500000, label: '₹25 L' },
  { value: 5000000, label: '₹50 L' },
  { value: 7500000, label: '₹75 L' },
  { value: 10000000, label: '₹1 Cr' },
  { value: 15000000, label: '₹1.5 Cr' },
  { value: 20000000, label: '₹2 Cr' },
  { value: 30000000, label: '₹3 Cr' },
  { value: 50000000, label: '₹5 Cr' },
];

export const RENT_BUDGETS = [
  { value: 10000, label: '₹10,000' },
  { value: 20000, label: '₹20,000' },
  { value: 30000, label: '₹30,000' },
  { value: 50000, label: '₹50,000' },
  { value: 75000, label: '₹75,000' },
  { value: 100000, label: '₹1 L' },
  { value: 200000, label: '₹2 L' },
];

export const STORAGE_BUCKET = 'listing-images';
