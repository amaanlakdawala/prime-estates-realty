// ------------------------------------------------------------
// Firm details — edit these to change them across the whole site.
// ------------------------------------------------------------
export const site = {
  name: 'Prime Estates Realty',
  description:
    'Pune real estate brokerage for buying, selling and renting flats, villas, plots, offices and shops.',
  phoneDisplay: '+91 98926 62324',
  phoneHref: '+919892662324',
  whatsapp: '919892662324', // country code + number, no + or spaces
  email: 'info@primeestatesrealty.com',
  address: 'Office 402, Sai Heritage, Baner Road, Baner, Pune 411045',
  hours: 'Monday to Saturday, 10 am to 7 pm',
  mahareraAgentNo: 'A52100000000', // replace with the firm's MahaRERA agent registration number
  foundedYear: 2012,
  mapQuery: 'Baner Road, Baner, Pune',
  localities: [
    'Baner',
    'Balewadi',
    'Aundh',
    'Wakad',
    'Hinjewadi',
    'Pimple Saudagar',
    'Kothrud',
    'Kharadi',
    'Viman Nagar',
    'Hadapsar',
  ],
};

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
