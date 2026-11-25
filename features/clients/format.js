// Labels and messages shared by the clients pages (works in the browser and on the server).
import { formatPrice } from '@/lib/format';

export const STAGES = [
  { value: 'new', label: 'New', tone: 'bg-mist text-muted' },
  { value: 'contacted', label: 'Contacted', tone: 'bg-brand-light text-brand-dark' },
  { value: 'site_visit', label: 'Site visit', tone: 'bg-accent/20 text-ink' },
  { value: 'negotiation', label: 'Negotiation', tone: 'bg-accent/40 text-ink' },
  { value: 'won', label: 'Won', tone: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', tone: 'bg-red-50 text-red-800' },
];
export const stageOf = (v) => STAGES.find((s) => s.value === v) ?? STAGES[0];

export const SOURCE_LABELS = { website: 'Website', property: 'Property page', callback: 'Callback form', contact: 'Contact page', chat: 'AI chatbot', whatsapp: 'WhatsApp', call: 'AI call', manual: 'Added by team' };
export const sourceLabel = (s) => (s?.startsWith('portal:') ? s.slice(7) : SOURCE_LABELS[s] ?? s ?? '');

// India time, YYYY-MM-DD.
export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// digits for wa.me: +919820012345 -> 919820012345
export const waNumber = (phone) => String(phone ?? '').replace(/\D/g, '').replace(/^0+/, '').replace(/^(\d{10})$/, '91$1');

// The WhatsApp message a consultant sends when sharing a matching listing (Hinglish, as brokers write).
export function shareMessage({ client, listing, firmName, link }) {
  const first = (client.name ?? '').trim().split(/\s+/)[0];
  return [
    `Namaste${first ? ` ${first} ji` : ''}, ${firmName} se.`,
    `Aapki requirement ke hisaab se ek property hai: ${listing.title}, ${listing.locality}. ${formatPrice(listing.price, listing.deal_type)}${listing.bhk ? `, ${listing.bhk} BHK` : ''}.`,
    link ? `Photos aur details: ${link}` : '',
    'Dekhna chahenge? Aapke time pe site visit arrange kar dete hain.',
  ].filter(Boolean).join('\n');
}
