'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFirmService, runAction } from '@/features/shared/firm-service';
import { sendText } from './meta';

const WINDOW_MS = 24 * 3600e3; // WhatsApp allows free-form replies only within 24 hours of the client's last message

// Platform admin: link the firm's WhatsApp Business number (from Meta's WhatsApp Manager → API setup).
export async function connectNumber(formData) {
  return runAction(async () => {
    const { ctx, firm } = await requireFirmService('whatsapp_ai_enabled', 'The WhatsApp assistant');
    if (!ctx.isPlatformAdmin) throw new Error('Only the platform admin can connect a number.');
    const phoneNumberId = (formData.get('phone_number_id') ?? '').toString().trim();
    if (!/^\d{6,30}$/.test(phoneNumberId)) throw new Error('The phone number ID is the long number from Meta\'s API setup page, digits only.');
    const token = (formData.get('access_token') ?? '').toString().trim();
    const db = createAdminClient();
    await db.from('whatsapp_numbers').delete().eq('firm_id', firm.id);
    const { error } = await db.from('whatsapp_numbers').insert({
      phone_number_id: phoneNumberId,
      firm_id: firm.id,
      display_number: (formData.get('display_number') ?? '').toString().trim().slice(0, 30),
      access_token: token.slice(0, 1000), // empty = the platform's WHATSAPP_ACCESS_TOKEN
    });
    if (error) throw new Error(error.code === '23505' ? 'That number is already connected to another firm.' : error.message);
    revalidatePath('/admin/whatsapp');
    return { success: true };
  });
}

export async function disconnectNumber() {
  return runAction(async () => {
    const { ctx, firm } = await requireFirmService('whatsapp_ai_enabled', 'The WhatsApp assistant');
    if (!ctx.isPlatformAdmin) throw new Error('Only the platform admin can disconnect the number.');
    await createAdminClient().from('whatsapp_numbers').delete().eq('firm_id', firm.id);
    revalidatePath('/admin/whatsapp');
    return { success: true };
  });
}

// "Take over" (the AI stops replying in this chat) or "Let Riya reply".
export async function setChatMode(conversationId, mode) {
  return runAction(async () => {
    const { firm } = await requireFirmService('whatsapp_ai_enabled', 'The WhatsApp assistant');
    if (!isUuid(conversationId) || !['ai', 'human'].includes(mode)) throw new Error('Unknown chat.');
    const { error } = await createAdminClient().from('whatsapp_conversations')
      .update({ mode, ...(mode === 'ai' && { handover_reason: '' }) }).eq('id', conversationId).eq('firm_id', firm.id);
    if (error) throw new Error(error.message);
    revalidatePath('/admin/whatsapp');
    return { success: true };
  });
}

// A reply typed by the team in the admin panel. Takes the chat over, so Riya doesn't answer on top of it.
export async function sendTeamReply(conversationId, text) {
  return runAction(async () => {
    const { firm } = await requireFirmService('whatsapp_ai_enabled', 'The WhatsApp assistant');
    if (!isUuid(conversationId)) throw new Error('Unknown chat.');
    const body = (text ?? '').toString().trim().slice(0, 4000);
    if (!body) throw new Error('Write a message first.');
    const db = createAdminClient();
    const [{ data: chat }, { data: number }] = await Promise.all([
      db.from('whatsapp_conversations').select('*').eq('id', conversationId).eq('firm_id', firm.id).maybeSingle(),
      db.from('whatsapp_numbers').select('*').eq('firm_id', firm.id).maybeSingle(),
    ]);
    if (!chat) throw new Error('Unknown chat.');
    if (!number) throw new Error('No WhatsApp number is connected.');
    if (!chat.last_client_message_at || Date.now() - new Date(chat.last_client_message_at).getTime() > WINDOW_MS) {
      throw new Error('WhatsApp allows replies only within 24 hours of the client\'s last message. Message them from your phone instead.');
    }
    const waId = await sendText(number, chat.client_phone, body);
    await db.from('whatsapp_messages').insert({ firm_id: firm.id, conversation_id: chat.id, direction: 'out', sender: 'team', body, wa_message_id: waId });
    await db.from('whatsapp_conversations').update({ mode: 'human', last_message_at: new Date().toISOString() }).eq('id', chat.id);
    revalidatePath('/admin/whatsapp');
    return { success: true };
  });
}
