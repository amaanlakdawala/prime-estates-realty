// ------------------------------------------------------------
// Shared constants and the "site" object every public page and component uses.
// A site is built from one row of the `firms` table (see toSite below), so every client
// firm gets its own name, phone, city and areas from the database. Firms are created and
// edited in the admin panel: Firms (platform admin) or Firm profile (the firm's own login).
// ------------------------------------------------------------

// Web address part that can never be a firm slug, because the app already uses it.
export const RESERVED_SLUGS = ['admin', 'login', 'api', 'demo', 'auth', 'properties', 'about', 'services', 'contact', '_next', 'static', 'public', 'favicon.ico', 'robots.txt', 'sitemap.xml'];

// Your own brand, shown on the sign-in page and admin panel (not on firms' websites).
export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Prime Estates Realty';

// The firm shown at the site root (/). Your demo firm.
export const DEFAULT_FIRM_SLUG = process.env.NEXT_PUBLIC_DEFAULT_FIRM_SLUG || 'prime-estates';

// "+91 98926 62324" or "9892662324" -> "919892662324". A bare 10-digit number is treated as Indian.
export function toInternationalDigits(phone) {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

// Turns a `firms` row into the fields pages and components use.
export function toSite(firm) {
  const city = firm.city || '';
  const phoneDigits = toInternationalDigits(firm.phone);
  return {
    id: firm.id,
    slug: firm.slug,
    // Prefix for every link on the firm's website. Path-based today (/seabreeze/properties);
    // switching to subdomains later means making this '' for requests on the firm's own host.
    base: `/${firm.slug}`,
    name: firm.name,
    city,
    description: `${city ? `${city} real estate` : 'Real estate'} brokerage for buying, selling and renting flats, villas, plots, offices and shops.`,
    phoneDisplay: firm.phone || '',
    phoneHref: phoneDigits ? `+${phoneDigits}` : '',
    whatsapp: toInternationalDigits(firm.whatsapp || firm.phone), // digits with country code, for wa.me links
    whatsappRaw: firm.whatsapp || '', // as typed in the firm profile (empty = same as phone)
    email: firm.email || '',
    address: firm.address || '',
    hours: firm.hours || '',
    mahareraAgentNo: firm.rera_no || '', // empty hides every MahaRERA mention
    foundedYear: firm.founded_year || null,
    logoUrl: firm.logo_url || '',
    heroUrl: firm.hero_url || '',
    mapQuery: firm.address || city,
    localities: firm.localities ?? [],
    demoContent: Boolean(firm.demo_content), // sample testimonials and team: demo firms only
    aiCallsEnabled: Boolean(firm.ai_calls_enabled),
    aiCallsMonthlyLimit: firm.ai_calls_monthly_limit ?? 300,
    voiceAgent: firm.voice_agent || 'sia',
    active: firm.active !== false,
  };
}

// A link on a firm's website: href(site, '/properties') -> '/seabreeze/properties'.
export function href(site, path = '/') {
  return path === '/' ? site.base || '/' : `${site.base}${path}`;
}

// "Baner, Aundh and Wakad" from the first few localities, for running text.
export function localityList(site, count = 3) {
  const items = site.localities.slice(0, count);
  if (!items.length) return site.city || 'your area';
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0];
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
