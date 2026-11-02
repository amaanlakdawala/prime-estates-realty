import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toSite } from '@/lib/site';
import { visitorHash } from '@/lib/visitor';
import { chatReply } from '@/lib/chat/assistant';

// The website chatbot (components/ChatWidget.js). Only for firms whose chatbot the platform admin switched on.
//   POST /api/chat   body: { firm: 'prime-estates', messages: [{ role: 'user'|'assistant', content }…] }
// Each message costs the platform an AI call, so: limits per visitor and per firm, short messages, short chats.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LIMITS = {
  messageChars: 600,
  visitorMessages: 20,     // per conversation
  perVisitorPerHour: 40,
  perFirmPerDay: 600,
};

const since = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const fail = (error, status) => NextResponse.json({ error }, { status });

export async function POST(request) {
  // Only the firm websites on this domain may use it, not other sites borrowing the AI.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return fail('Not allowed', 403);
  if (!process.env.GEMINI_API_KEY) return fail('The chat is not available right now.', 503);

  const body = await request.json().catch(() => null);
  const slug = String(body?.firm ?? '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !Array.isArray(body?.messages)) return fail('Bad request', 400);

  // Plain text turns only, starting and ending with the visitor (the greeting shown in the window is dropped).
  // Two visitor messages in a row (the first got an error instead of a reply) are joined into one.
  const messages = [];
  for (const m of body.messages.slice(-2 * LIMITS.visitorMessages - 2)) {
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) continue;
    const content = m.content.trim().slice(0, m.role === 'user' ? LIMITS.messageChars : 2000);
    if (messages.at(-1)?.role === m.role) messages.at(-1).content += `\n${content}`;
    else messages.push({ role: m.role, content });
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  if (!messages.length || messages.at(-1).role !== 'user') return fail('Bad request', 400);
  if (body.messages.filter((m) => m?.role === 'user').length > LIMITS.visitorMessages) {
    return fail('This chat is getting long. Please call or WhatsApp us, and our team will take it from here.', 429);
  }

  const db = createAdminClient();
  const { data: firm } = await db.from('firms').select('*').eq('slug', slug).eq('active', true).eq('website_enabled', true).maybeSingle();
  if (!firm?.ai_chat_enabled) return fail('The chat is not available on this website.', 404);

  const ipHash = await visitorHash();
  const [byVisitor, byFirm] = await Promise.all([
    ipHash ? db.from('chat_turns').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since(60)) : Promise.resolve({ count: 0 }),
    db.from('chat_turns').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).gte('created_at', since(24 * 60)),
  ]);
  if ((byVisitor.count ?? 0) >= LIMITS.perVisitorPerHour || (byFirm.count ?? 0) >= LIMITS.perFirmPerDay) {
    return fail('The chat is busy right now. Please call or WhatsApp us instead.', 429);
  }

  try {
    const site = toSite(firm);
    const result = await chatReply(site, messages, ipHash);
    await db.from('chat_turns').insert({
      firm_id: firm.id, ip_hash: ipHash, input_tokens: result.usage.input, output_tokens: result.usage.output, enquiry_saved: result.saved,
    });
    return NextResponse.json({ reply: result.reply, listings: result.listings, saved: result.saved });
  } catch (err) {
    console.error('Chat failed:', err.message);
    return fail('Sorry, the chat is not working right now. Please call or WhatsApp us instead.', 502);
  }
}
