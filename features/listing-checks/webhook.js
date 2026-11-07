// Sarvam posts here after every listing check call (connected or not).
//   POST /api/listing-checks/webhook?key=<VOICE_TOOL_SECRET>   (thin route: app/api/listing-checks/webhook/route.js)
import { NextResponse } from 'next/server';
import { sameSecret } from '@/lib/secret';
import { handleCheckReport } from './checks';

export async function POST(request) {
  if (!sameSecret(new URL(request.url).searchParams.get('key') ?? '', process.env.VOICE_TOOL_SECRET)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  }
  const report = await request.json().catch(() => null);
  if (!report?.attempt_id) return NextResponse.json({ error: 'attempt_id is required' }, { status: 400 });
  const known = await handleCheckReport(report);
  return NextResponse.json({ ok: true, ...(!known && { unknown: true }) }); // unknown = a test call: nothing to retry
}
