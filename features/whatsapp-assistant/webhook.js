// Meta's WhatsApp webhook (thin route: app/api/whatsapp/webhook/route.js). Set it up in the Meta app:
// WhatsApp → Configuration → Callback URL https://<site>/api/whatsapp/webhook, Verify token = WHATSAPP_VERIFY_TOKEN,
// and subscribe to the "messages" field.
import { NextResponse } from 'next/server';
import { sameSecret } from '@/lib/secret';
import { validSignature } from './meta';
import { handleWebhook } from './engine';

// Meta checks the address once, when it is saved: echo its challenge if the token matches.
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const ok = q.get('hub.mode') === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && sameSecret(q.get('hub.verify_token') ?? '', process.env.WHATSAPP_VERIFY_TOKEN);
  return ok ? new NextResponse(q.get('hub.challenge') ?? '', { status: 200 }) : NextResponse.json({ error: 'Not allowed' }, { status: 403 });
}

// Every incoming message and delivery report. Signed by Meta with the app secret.
export async function POST(request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  try {
    await handleWebhook(payload);
  } catch (err) {
    console.error('WhatsApp webhook failed:', err.message); // answered 200 anyway: a retry would fail the same way
  }
  return NextResponse.json({ ok: true });
}
