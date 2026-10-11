// Places automatic AI calls for website enquiries that are due, and saves the results of finished calls.
// Called every minute by Supabase pg_cron (see supabase/auto_call_cron.sql) with the shared CRON_SECRET.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callContactNow, syncFirmCalls, withinCallingHours, CallBlocked } from '@/lib/voice';

export const dynamic = 'force-dynamic';

const BATCH = 5;          // calls placed per run at most (keeps each run well inside the function time limit)
const MAX_ATTEMPTS = 3;   // a technical failure is retried twice, 10 minutes apart
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // a call that couldn't go out within a day is dropped, never placed late
const minutesFromNow = (m) => new Date(Date.now() + m * 60 * 1000).toISOString();

function authorised(request) {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get('x-cron-secret') ?? '';
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  const db = createAdminClient();
  const report = { placed: 0, skipped: 0, retry: 0, failed: 0, later: 0 };

  // Items a crashed run left half-done go back in the line.
  await db.from('call_queue').update({ status: 'pending' }).eq('status', 'processing').lt('run_after', minutesFromNow(-15));

  const { data: due } = await db.from('call_queue').select('*').eq('status', 'pending').lte('run_after', new Date().toISOString())
    .order('run_after').limit(BATCH);
  const busyFirms = new Set();

  for (const item of due ?? []) {
    const finish = (fields) => db.from('call_queue').update(fields).eq('id', item.id);

    if (Date.now() - new Date(item.created_at).getTime() > MAX_AGE_MS) {
      await finish({ status: 'skipped', note: 'Not placed within 24 hours of the enquiry.' }); report.skipped++; continue;
    }
    if (!withinCallingHours()) {
      const { data: next } = await db.rpc('next_calling_time', { t: new Date().toISOString() });
      await finish({ run_after: next }); report.later++; continue;
    }

    // Claim it; if another run got there first, leave it.
    const { data: claimed } = await db.from('call_queue').update({ status: 'processing', attempts: item.attempts + 1 })
      .eq('id', item.id).eq('status', 'pending').select('id');
    if (!claimed?.length) continue;

    const [{ data: firm }, { data: contact }] = await Promise.all([
      db.from('firms').select('*').eq('id', item.firm_id).single(),
      db.from('call_contacts').select('*').eq('id', item.contact_id).maybeSingle(),
    ]);
    if (!contact) { await finish({ status: 'skipped', note: 'The contact was removed.' }); report.skipped++; continue; }
    if (!firm?.ai_auto_call_enquiries) { await finish({ status: 'skipped', note: 'Automatic calling was switched off.' }); report.skipped++; continue; }

    // One call at a time per firm: if one is running, try again in two minutes.
    const { data: running } = busyFirms.has(firm.id)
      ? { data: [true] }
      : await db.from('calls').select('id').eq('firm_id', firm.id).in('status', ['queued', 'in_progress']).limit(1);
    if (running?.length) {
      await finish({ status: 'pending', attempts: item.attempts, run_after: minutesFromNow(2) }); report.later++; continue;
    }

    try {
      const callId = await callContactNow({ firm, contact });
      busyFirms.add(firm.id);
      await finish({ status: 'placed', call_id: callId, note: null }); report.placed++;
    } catch (err) {
      if (err instanceof CallBlocked && !withinCallingHours()) { // the clock passed 9 pm during this run
        const { data: next } = await db.rpc('next_calling_time', { t: new Date().toISOString() });
        await finish({ status: 'pending', attempts: item.attempts, run_after: next }); report.later++;
      } else if (err instanceof CallBlocked) {
        await finish({ status: 'skipped', note: err.message }); report.skipped++;
      } else if (item.attempts + 1 < MAX_ATTEMPTS) {
        await finish({ status: 'pending', run_after: minutesFromNow(10), note: err.message }); report.retry++;
      } else {
        await finish({ status: 'failed', note: err.message }); report.failed++;
      }
    }
  }

  // Save the results of calls that have finished, for every firm, even if nobody has the page open.
  const { data: open } = await db.from('calls').select('firm_id').in('status', ['queued', 'in_progress']).limit(200);
  for (const firmId of new Set((open ?? []).map((c) => c.firm_id))) await syncFirmCalls(firmId);

  return NextResponse.json({ ok: true, ...report });
}
