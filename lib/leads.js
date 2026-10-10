// Lead finder helpers shared by the server and the browser (nothing secret in here).

export const LEAD_STATUSES = [
  { value: 'new', label: 'New', style: 'bg-stone text-basalt' },
  { value: 'contacted', label: 'Contacted', style: 'bg-teal-light text-teal-dark' },
  { value: 'interested', label: 'Interested', style: 'bg-marigold/30 text-basalt' },
  { value: 'demo_sent', label: 'Demo sent', style: 'bg-marigold text-basalt' },
  { value: 'won', label: 'Won', style: 'bg-teal text-white' },
  { value: 'lost', label: 'Lost', style: 'bg-basalt/10 text-muted' },
  { value: 'do_not_contact', label: 'Do not contact', style: 'bg-red-100 text-red-800' },
];
export const statusLabel = (value) => LEAD_STATUSES.find((s) => s.value === value)?.label ?? value;

export const DEFAULT_CITY = 'Mumbai';
export const DEFAULT_LOCALITIES = [
  'Andheri West', 'Andheri East', 'Bandra West', 'Khar', 'Santacruz', 'Juhu', 'Vile Parle', 'Goregaon', 'Malad', 'Kandivali',
  'Borivali', 'Powai', 'Ghatkopar', 'Chembur', 'Mulund', 'Dadar', 'Worli', 'Lower Parel', 'Colaba', 'Malabar Hill',
];
export const DEFAULT_QUERIES = ['real estate agency', 'property dealer', 'real estate broker'];

// Google business names are often stuffed with keywords:
// "SPY Realtors - Estate Agents in Powai | Real Estate Broker" -> "SPY Realtors".
export function cleanName(name) {
  const first = (name ?? '').split(/\s[-–|]\s|\s\|\s?|\|/)[0].trim();
  // Titles in ALL CAPS read as shouting in a message: "MEHBOOB BHAI" -> "Mehboob Bhai".
  const tidy = first === first.toUpperCase() && /[A-Z]{3}/.test(first)
    ? first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : first;
  return tidy || name || '';
}

// WhatsApp works on Indian mobiles (+91 then 10 digits starting 6-9), not landlines.
export function whatsappNumber(phoneIntl) {
  const digits = (phoneIntl ?? '').replace(/\D/g, '');
  return /^91[6-9]\d{9}$/.test(digits) ? digits : '';
}

// Higher = better prospect for a website service. Each reason is shown on the lead's page.
export function scoreReasons(lead) {
  const reasons = [];
  if (!lead.website) reasons.push(['No website', 3]);
  if (whatsappNumber(lead.phone_intl)) reasons.push(['Mobile number (WhatsApp)', 2]);
  if ((lead.review_count ?? 0) >= 20) reasons.push(['20+ Google reviews (established)', 1]);
  if ((lead.rating ?? 0) >= 4) reasons.push(['Rated 4 or higher', 1]);
  return reasons;
}
export const scoreLead = (lead) => scoreReasons(lead).reduce((sum, [, points]) => sum + points, 0);

// Fills {name} {firm} {city} {demo_link} in the outreach message.
export function fillTemplate(template, values) {
  return template.replace(/\{(name|firm|city|demo_link)\}/g, (_, key) => values[key] || '');
}

// {Hello|Namaste|Hi} -> one option, picked from the lead's id: each lead gets its own wording,
// and the same lead always gets the same wording.
export function spin(text, seed) {
  let i = 0;
  return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, options) => {
    const list = options.split('|');
    let h = 0;
    for (const c of `${seed}:${i++}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return list[h % list.length];
  });
}

export const OPT_OUT_LINE = "Reply STOP if you'd rather not hear from me.";

// The finished WhatsApp message for one lead. Always ends with a way to opt out.
export function buildMessage(template, lead, demoLink) {
  const name = cleanName(lead.name);
  let text = fillTemplate(spin(template, lead.id), {
    name,
    firm: name,
    city: lead.city,
    demo_link: demoLink || '[create the demo website first]',
  }).trim();
  if (!/\bSTOP\b/.test(text)) text += `\n\n${OPT_OUT_LINE}`; // the template's own opt-out line uses "STOP"
  return text;
}
