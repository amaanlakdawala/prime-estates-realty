import { PROPERTY_TYPES } from './site';

const trim = (n) => Number(n.toFixed(2)).toString();

export function formatPrice(price, dealType) {
  const p = Number(price) || 0;
  if (dealType === 'rent') return `₹${p.toLocaleString('en-IN')}/month`;
  if (p >= 1e7) return `₹${trim(p / 1e7)} Cr`;
  if (p >= 1e5) return `₹${trim(p / 1e5)} L`;
  return `₹${p.toLocaleString('en-IN')}`;
}

export function typeLabel(value) {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function shortSpecs(listing) {
  const parts = [];
  if (listing.bhk) parts.push(`${listing.bhk} BHK`);
  if (listing.area_sqft) parts.push(`${Number(listing.area_sqft).toLocaleString('en-IN')} sq ft`);
  parts.push(typeLabel(listing.property_type));
  return parts;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function whatsappLink(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
