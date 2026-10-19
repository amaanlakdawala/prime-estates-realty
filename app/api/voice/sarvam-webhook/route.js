// Sarvam posts here after every call it placed for us (connected or not): saves the result on the call
// and updates the contact, as syncFirmCalls does for ElevenLabs calls.
//   POST /api/voice/sarvam-webhook?key=<VOICE_TOOL_SECRET>
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SARVAM_PREFIX, sarvamCallInfo } from '@/lib/sarvam';
import { CONTACT_STATUS } from '@/lib/voice';

export const dynamic = 'force-dynamic';

function authorised(request) {
  const expected = process.env.VOICE_TOOL_SECRET;
  const given = new URL(request.url).searchParams.get('key') ?? '';
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  const report = await request.json().catch(() => null);
  if (!report?.attempt_id) return NextResponse.json({ error: 'attempt_id is required' }, { status: 400 });

  const db = createAdminClient();
  const { data: call } = await db.from('calls').select('id, contact_id').eq('conversation_id', `${SARVAM_PREFIX}${report.attempt_id}`).maybeSingle();
  if (!call) return NextResponse.json({ ok: true, unknown: true }); // not ours (or a test call): nothing to retry

  const info = sarvamCallInfo(report);
  await db.from('calls').update(info).eq('id', call.id);
  if (call.contact_id) {
    const contactStatus = info.result?.do_not_call ? 'do_not_call' : CONTACT_STATUS[info.status];
    await db.from('call_contacts').update({ status: contactStatus }).eq('id', call.contact_id).neq('status', 'do_not_call');
  }
  return NextResponse.json({ ok: true });
}
