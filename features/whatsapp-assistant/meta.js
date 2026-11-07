import { createHmac, timingSafeEqual } from 'node:crypto';

// Meta's WhatsApp Cloud API: checking that a webhook really comes from Meta, and sending messages. Server only.
// WHATSAPP_ACCESS_TOKEN: a permanent system-user token (or the firm's own, saved with its number).
// META_APP_SECRET: signs every webhook. WHATSAPP_API_VERSION: Graph API version, e.g. v23.0.
const graph = () => `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v23.0'}`;

// X-Hub-Signature-256: "sha256=<hex HMAC of the raw body with the app secret>".
export function validSignature(rawBody, header) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(header.slice(7));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const tokenOf = (number) => number.access_token || process.env.WHATSAPP_ACCESS_TOKEN;

async function post(number, body) {
  const token = tokenOf(number);
  if (!token) throw new Error('No WhatsApp access token (WHATSAPP_ACCESS_TOKEN is not set).');
  const res = await fetch(`${graph()}/${number.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp refused the message (HTTP ${res.status}): ${data.error?.error_data?.details || data.error?.message || 'no reason given'}`);
  return data.messages?.[0]?.id ?? null;
}

// number: a whatsapp_numbers row. to: digits with country code. Returns Meta's message id.
export const sendText = (number, to, text) => post(number, { recipient_type: 'individual', to, type: 'text', text: { body: text.slice(0, 4000), preview_url: true } });
export const sendImage = (number, to, link, caption) => post(number, { recipient_type: 'individual', to, type: 'image', image: { link, caption: caption.slice(0, 1000) } });
// Blue ticks on the client's message, and the "typing…" dots while the reply is written.
export const markRead = (number, messageId) => post(number, { status: 'read', message_id: messageId, typing_indicator: { type: 'text' } }).catch(() => null);

// A voice note or photo the client sent: { data: base64, mimeType }, or null if it can't be fetched.
export async function downloadMedia(number, mediaId) {
  const token = tokenOf(number);
  const meta = await fetch(`${graph()}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  if (!meta?.url || (meta.file_size ?? 0) > 8e6) return null;
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return null;
  return { data: Buffer.from(await res.arrayBuffer()).toString('base64'), mimeType: (meta.mime_type || 'audio/ogg').split(';')[0] };
}
