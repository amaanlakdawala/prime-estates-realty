import { geminiJson } from '@/lib/gemini';
import { toIndianMobile } from '@/lib/voice';

// Reads a lead email from a property portal (or a pasted lead message) and pulls out the buyer or tenant.
// Each portal writes its own layout and changes it without notice, so Gemini reads it; when Gemini can't be
// reached, a plain search for "Name:" and a mobile number still catches most leads.

// Sender address or text that gives the portal away.
const PORTALS = [
  ['99acres', /99acres/i],
  ['MagicBricks', /magicbricks/i],
  ['Housing.com', /housing\.com|@housing\b/i],
  ['NoBroker', /nobroker/i],
  ['Square Yards', /squareyards|square yards/i],
  ['Makaan', /makaan/i],
  ['PropTiger', /proptiger/i],
  ['CommonFloor', /commonfloor/i],
  ['Facebook', /facebook|fb lead|meta lead/i],
];

export const portalOf = (...texts) => PORTALS.find(([, re]) => texts.some((t) => re.test(t ?? '')))?.[0] ?? '';

// Gmail's "confirm forwarding" email: the firm must open this link once before Gmail forwards anything.
const GMAIL_CONFIRM = /https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"<>]+/i;

const SCHEMA = {
  type: 'object',
  properties: {
    is_lead: { type: 'boolean', description: 'true only when this is a new enquiry from a person interested in a property' },
    portal: { type: 'string', description: 'Website the enquiry came from (99acres, MagicBricks, Housing.com, NoBroker…), empty if unknown' },
    name: { type: 'string', description: 'The enquirer\'s name, empty if not given' },
    phone: { type: 'string', description: 'The enquirer\'s mobile number exactly as written, empty if not given. Never the broker\'s or the portal\'s number.' },
    email: { type: 'string', description: 'The enquirer\'s email, empty if not given' },
    requirement: { type: 'string', description: 'One line for the consultant: buy or rent, property or project, area, BHK, budget, anything they wrote. Empty if nothing.' },
    reason: { type: 'string', description: 'When is_lead is false: what this email is instead, in a few words (newsletter, invoice, report…)' },
  },
  required: ['is_lead', 'portal', 'name', 'phone', 'email', 'requirement', 'reason'],
  additionalProperties: false,
};

const prompt = ({ sender, subject, text }) => `A real estate broker in India receives lead emails from property portals (99acres, MagicBricks, Housing.com, NoBroker and others) and forwards them here. Read this email and pull out the person who enquired.

Ignore the broker's own details, the portal's helpline numbers, unsubscribe text, ads and listings the portal recommends. A forwarded email may start with the broker's own forwarding lines; read the forwarded lead below them. Portal newsletters, payment reminders, performance reports and "your listing is live" messages are not leads.

From: ${sender}
Subject: ${subject}

${text.slice(0, 6000)}`;

// When Gemini is unavailable: a "Name:" line and the first mobile number that isn't the portal's.
function fallback({ sender, subject, text }) {
  // "Name: Rahul Mehta", or a table cell turned into text: "Buyer Name  Rahul Mehta".
  const name = text.match(/\b(?:name|buyer|customer|client)(?:\s*:|\s{2,}|\t)\s*([A-Za-z][A-Za-z.']*(?: [A-Za-z.']+){0,3})/i)?.[1]?.trim() ?? '';
  const phone = [...text.matchAll(/(?:\+?91[\s-]*)?\b[6-9]\d{4}[\s-]?\d{5}\b/g)].map((m) => toIndianMobile(m[0])).find(Boolean) ?? '';
  const requirement = text.match(/\b(?:requirement|interested in|property|project|message)(?:\s*:|\s{2,}|\t)\s*(\w.{2,200})/i)?.[1]?.trim() ?? '';
  return { is_lead: Boolean(phone), portal: portalOf(sender, subject, text), name, phone, email: '', requirement, reason: phone ? '' : 'No mobile number found' };
}

// Returns { lead: { name, phone, email, requirement, portal } | null, portal, note, gmailConfirm }.
export async function readLeadEmail({ sender = '', subject = '', text = '' }) {
  const confirm = /forwarding-noreply@google\.com/i.test(sender) || /gmail forwarding confirmation/i.test(subject)
    ? text.match(GMAIL_CONFIRM)?.[0] ?? null : null;
  if (confirm) return { lead: null, portal: '', note: 'Gmail asks you to confirm forwarding to this address.', gmailConfirm: confirm };

  let answer;
  try {
    answer = await geminiJson([prompt({ sender, subject, text })], SCHEMA);
  } catch (err) {
    console.error('Lead email not read by Gemini, using the simple reader:', err.message);
    answer = fallback({ sender, subject, text });
  }
  const portal = answer?.portal?.trim() || portalOf(sender, subject, text);
  const phone = toIndianMobile(answer?.phone);
  if (!answer?.is_lead) return { lead: null, portal, note: answer?.reason?.trim() || 'Not a lead email.' };
  if (!phone) return { lead: null, portal, note: 'A lead, but without a valid Indian mobile number. Call them from the portal.' };
  return {
    lead: {
      name: String(answer.name ?? '').trim().slice(0, 120) || 'Portal lead',
      phone,
      email: /^\S+@\S+\.\S+$/.test(answer.email ?? '') ? answer.email.trim().slice(0, 200) : null,
      requirement: String(answer.requirement ?? '').trim().slice(0, 1500),
      portal,
    },
    portal,
    note: '',
  };
}
