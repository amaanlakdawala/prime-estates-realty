// Places the next automatic sales call. Called every 10 minutes by Supabase pg_cron (supabase/cron/sales_caller_cron.sql)
// with the shared CRON_SECRET. The feature lives in features/sales-caller.
import { NextResponse } from 'next/server';
import { sameSecret } from '@/lib/secret';
import { runAutoCalls } from '@/features/sales-caller/auto';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!sameSecret(request.headers.get('x-cron-secret') ?? '', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  }
  return NextResponse.json(await runAutoCalls());
}
