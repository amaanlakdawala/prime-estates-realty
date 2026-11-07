import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { htmlToText, saveLeadEmail } from './leads';

// Incoming email for the firms' forwarding addresses, from the inbound email service (Postmark by default;
// CloudMailin's JSON and a plain { to, from, subject, text, html } also work). Each firm forwards its portal
// lead emails to PORTAL_INBOX_ADDRESS with its own key after a "+": abc123+<key>@inbound.postmarkapp.com.
// The key is random and secret, so it both finds the firm and keeps strangers out.
//   POST /api/portal-leads/inbound

const KEY = /^[a-f0-9]{24}$/;

// The firm's own forwarding address, or null when the inbound service isn't set up yet.
export function forwardingAddress(key) {
  const inbox = process.env.PORTAL_INBOX_ADDRESS ?? '';
  const at = inbox.indexOf('@');
  return key && at > 0 ? `${inbox.slice(0, at)}+${key}${inbox.slice(at)}` : null;
}

// Every address the email was delivered to, as one string per address.
function recipients(mail) {
  const list = [
    mail.MailboxHash && `+${mail.MailboxHash}@`,
    mail.OriginalRecipient, mail.To, mail.Cc,
    ...(mail.ToFull ?? []).flatMap((t) => [t.Email, t.MailboxHash && `+${t.MailboxHash}@`]),
    mail.envelope?.to, ...(mail.envelope?.recipients ?? []), mail.headers?.to, mail.headers?.To,
    mail.to, mail.recipient,
  ];
  return list.filter((x) => typeof x === 'string' && x);
}

function firmKey(mail, url) {
  const fromUrl = url.searchParams.get('firm');
  if (fromUrl && KEY.test(fromUrl)) return fromUrl;
  for (const r of recipients(mail)) {
    for (const m of r.matchAll(/\+([a-z0-9]+)@/gi)) if (KEY.test(m[1].toLowerCase())) return m[1].toLowerCase();
  }
  return null;
}

export async function POST(request) {
  const url = new URL(request.url);
  const type = request.headers.get('content-type') ?? '';
  const mail = type.includes('json')
    ? await request.json().catch(() => null)
    : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());
  if (!mail) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  // Answer 200 even when the email is ignored, or the email service keeps retrying it.
  const key = firmKey(mail, url);
  if (!key) return NextResponse.json({ ok: true, ignored: 'no firm key in the address' });
  const db = createAdminClient();
  const { data: firm } = await db.from('firms').select('*').eq('portal_inbox_key', key).maybeSingle();
  if (!firm) return NextResponse.json({ ok: true, ignored: 'unknown firm key' });
  if (!firm.active || !firm.portal_leads_enabled) return NextResponse.json({ ok: true, ignored: 'portal leads are switched off for this firm' });

  const sender = String(mail.From ?? mail.envelope?.from ?? mail.headers?.from ?? mail.headers?.From ?? mail.from ?? mail.sender ?? '');
  const subject = String(mail.Subject ?? mail.headers?.subject ?? mail.headers?.Subject ?? mail.subject ?? '');
  const plain = String(mail.TextBody ?? mail.plain ?? mail.text ?? mail['body-plain'] ?? '').trim();
  const text = plain || htmlToText(String(mail.HtmlBody ?? mail.html ?? mail['body-html'] ?? ''));

  const row = await saveLeadEmail(firm, { sender, subject, text });
  return NextResponse.json({ ok: true, status: row.status });
}
