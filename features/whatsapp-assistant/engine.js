// One webhook from Meta, end to end: log each client message, and unless the team took the chat over, let Riya
// (lib/chat/assistant.js, channel 'whatsapp') reply with text and up to two listing photos.
// Replies always answer a message the client just sent, so they fall inside WhatsApp's free 24-hour window.
import { createAdminClient } from '@/lib/supabase/admin';
import { toSite } from '@/lib/site';
import { toIndianMobile } from '@/lib/voice';
import { geminiJson } from '@/lib/gemini';
import { chatReply } from '@/lib/chat/assistant';
import { downloadMedia, markRead, sendImage, sendText } from './meta';

const LIMITS = {
  history: 30,                  // messages of the conversation the AI reads
  aiRepliesPerChatPerDay: 60,
  aiRepliesPerFirmPerDay: 1500,
};
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexorautomate.netlify.app';
const since = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

// A voice note written out, so Riya can answer it like text.
async function transcribe(number, mediaId) {
  const media = await downloadMedia(number, mediaId);
  if (!media) return null;
  const answer = await geminiJson([
    'Write out exactly what is said in this WhatsApp voice note from a property client in India, in the language and script it is spoken in (Hindi as Roman-letter Hinglish). Only the words, no comments.',
    { inlineData: media },
  ], { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }).catch(() => null);
  return answer?.text?.trim() || null;
}

// What the client sent, as text for the log and for Riya.
async function messageText(number, m) {
  switch (m.type) {
    case 'text': return m.text?.body ?? '';
    case 'button': return m.button?.text ?? '';
    case 'interactive': return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '';
    case 'audio': {
      const said = await transcribe(number, m.audio?.id);
      return said ? `[Voice note] ${said}` : '[A voice note that could not be understood]';
    }
    case 'image': return `[A photo]${m.image?.caption ? ` ${m.image.caption}` : ''}`;
    case 'location': return `[Location: ${[m.location?.name, m.location?.address].filter(Boolean).join(', ') || `${m.location?.latitude}, ${m.location?.longitude}`}]`;
    case 'reaction': return null; // an emoji on an earlier message needs no answer
    default: return `[A ${m.type} message]`;
  }
}

// The listing as a WhatsApp photo caption (or a text when it has no photo).
const caption = (l) => [`*${l.title}*`, [l.price, l.size, l.area].filter(Boolean).join(' · '), l.link].filter(Boolean).join('\n');

async function reply(db, { firm, number, conversation, incoming }) {
  // Several messages in a row: only the newest gets an answer, which reads them all.
  const isNewest = async () => {
    const { data } = await db.from('whatsapp_messages').select('id').eq('conversation_id', conversation.id).eq('direction', 'in')
      .order('created_at', { ascending: false }).limit(1);
    return data?.[0]?.id === incoming.id;
  };
  const [{ count: chatToday }, { count: firmToday }] = await Promise.all([
    db.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id).eq('sender', 'ai').gte('created_at', since(24)),
    db.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).eq('sender', 'ai').gte('created_at', since(24)),
  ]);
  if ((chatToday ?? 0) >= LIMITS.aiRepliesPerChatPerDay || (firmToday ?? 0) >= LIMITS.aiRepliesPerFirmPerDay) {
    await db.from('whatsapp_conversations').update({ mode: 'human', handover_reason: 'Daily limit of AI replies reached.' }).eq('id', conversation.id);
    return;
  }

  const { data: rows } = await db.from('whatsapp_messages').select('direction, sender, body').eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false }).limit(LIMITS.history);
  const messages = [];
  for (const r of (rows ?? []).reverse()) {
    if (!r.body) continue;
    const role = r.direction === 'in' ? 'user' : 'assistant';
    const content = r.sender === 'team' ? `[Team member] ${r.body}` : r.body;
    if (messages.at(-1)?.role === role) messages.at(-1).content += `\n${content}`;
    else messages.push({ role, content });
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  if (messages.at(-1)?.role !== 'user') return;

  const site = toSite(firm);
  const result = await chatReply(site, messages, null, {
    channel: 'whatsapp',
    phone: toIndianMobile(conversation.client_phone) ?? `+${conversation.client_phone}`,
    clientName: conversation.client_name,
    base: `${SITE_URL}${site.base}`,
  });
  if (!(await isNewest())) return;

  const log = (body, waId, extra = {}) => db.from('whatsapp_messages').insert({
    firm_id: firm.id, conversation_id: conversation.id, direction: 'out', sender: 'ai', body, wa_message_id: waId, ...extra,
  });
  try {
    const waId = await sendText(number, conversation.client_phone, result.reply);
    await log(result.reply, waId, { input_tokens: result.usage.input, output_tokens: result.usage.output });
    for (const l of result.listings.slice(0, 2)) {
      const text = caption(l);
      const id = l.photo ? await sendImage(number, conversation.client_phone, l.photo, text) : await sendText(number, conversation.client_phone, text);
      await log(text, id);
    }
  } catch (err) {
    await log(result.reply, null, { error: err.message.slice(0, 300), input_tokens: result.usage.input, output_tokens: result.usage.output });
  }
  const update = { last_message_at: new Date().toISOString() };
  if (result.saved) update.enquiry_saved = true;
  if (result.handedOver) Object.assign(update, { mode: 'human', handover_reason: result.handedOver });
  await db.from('whatsapp_conversations').update(update).eq('id', conversation.id);
}

// One "messages" change from Meta's webhook.
async function handleChange(db, value) {
  const numberId = value?.metadata?.phone_number_id;
  if (!numberId) return;
  const { data: number } = await db.from('whatsapp_numbers').select('*').eq('phone_number_id', numberId).maybeSingle();
  if (!number) return;

  // Delivery reports: only failures are worth keeping.
  for (const s of value.statuses ?? []) {
    if (s.status === 'failed') await db.from('whatsapp_messages').update({ error: (s.errors?.[0]?.title ?? 'Not delivered').slice(0, 300) }).eq('wa_message_id', s.id);
  }
  if (!value.messages?.length) return;

  const { data: firm } = await db.from('firms').select('*').eq('id', number.firm_id).single();
  const names = Object.fromEntries((value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? '']));
  for (const m of value.messages) {
    const body = await messageText(number, m);
    if (body === null) continue;
    const now = new Date().toISOString();
    const { data: conversation, error } = await db.from('whatsapp_conversations').upsert({
      firm_id: firm.id, client_phone: m.from, client_name: (names[m.from] ?? '').slice(0, 120), last_message_at: now, last_client_message_at: now,
    }, { onConflict: 'firm_id,client_phone' }).select('*').single();
    if (error) throw new Error(error.message);
    // The same message delivered twice (Meta retries) is saved, and answered, once.
    const { data: incoming, error: dup } = await db.from('whatsapp_messages').insert({
      firm_id: firm.id, conversation_id: conversation.id, direction: 'in', sender: 'client', body: body.slice(0, 4000), wa_message_id: m.id,
    }).select('id').single();
    if (dup) continue;

    if (!firm.active || !firm.whatsapp_ai_enabled || conversation.mode === 'human') continue;
    await markRead(number, m.id);
    try {
      await reply(db, { firm, number, conversation, incoming });
    } catch (err) {
      console.error('WhatsApp reply failed:', err.message);
    }
  }
}

export async function handleWebhook(payload) {
  const db = createAdminClient();
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'messages') await handleChange(db, change.value);
    }
  }
}
