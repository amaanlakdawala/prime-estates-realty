import Link from 'next/link';
import { requireFirm, isUuid } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/format';
import ChatControls from './ChatControls';
import ConnectNumber from './ConnectNumber';

const WINDOW_MS = 24 * 3600e3;
const SENDER = { client: 'Client', ai: 'Riya (AI)', team: 'Your team' };
const shownNumber = (digits) => (digits.startsWith('91') && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`);

// Firm page: every WhatsApp chat Riya handled, with "Take over" and a reply box.
export default async function WhatsAppPage({ searchParams }) {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const { chat: chatParam } = (await searchParams) ?? {};
  const db = createAdminClient();
  const firmId = ctx.firm.id;
  const [{ data: firm }, { data: number }, { data: chats }] = await Promise.all([
    db.from('firms').select('whatsapp_ai_enabled').eq('id', firmId).single(),
    db.from('whatsapp_numbers').select('phone_number_id, display_number').eq('firm_id', firmId).maybeSingle(),
    db.from('whatsapp_conversations').select('*').eq('firm_id', firmId).order('last_message_at', { ascending: false }).limit(100),
  ]);

  if (!firm?.whatsapp_ai_enabled) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold">WhatsApp</h1>
        <p className="mt-3 text-muted">
          Riya answers your clients on WhatsApp at any hour, sends matching listings and passes interested clients to your team. This service isn&apos;t switched on for your firm.{' '}
          {ctx.isPlatformAdmin ? <Link href={`/admin/firms/${firmId}`} className="font-semibold text-brand underline">Switch it on under Firms → this firm.</Link> : 'Contact us to switch it on.'}
        </p>
      </div>
    );
  }

  const open = chats?.find((c) => c.id === chatParam) ?? null;
  const { data: messages } = open && isUuid(open.id)
    ? await db.from('whatsapp_messages').select('*').eq('conversation_id', open.id).order('created_at').limit(300)
    : { data: [] };
  const needPerson = (chats ?? []).filter((c) => c.mode === 'human' && c.handover_reason).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">WhatsApp</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Riya answers clients who message {number?.display_number || 'your WhatsApp Business number'}, day and night: she asks what they need, sends matching listings with photos,
          and passes interested clients to your team as enquiries. Take over any chat to reply yourself.
        </p>
      </div>

      {!number && (
        <section className="rounded-xl border border-accent bg-accent/15 p-5 text-sm">
          <h2 className="text-base font-semibold">No WhatsApp number connected yet</h2>
          {ctx.isPlatformAdmin
            ? <div className="mt-4"><ConnectNumber connected={false} /></div>
            : <p className="mt-1">We are connecting your WhatsApp Business number. Chats appear here once it is live.</p>}
        </section>
      )}
      {needPerson > 0 && (
        <p className="rounded-xl border border-accent bg-accent/15 p-4 text-sm" role="status">
          <span className="font-semibold">{needPerson} chat{needPerson === 1 ? '' : 's'}</span> waiting for a person from your team (marked “Needs you” below).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Chats</h2>
          {!chats?.length ? (
            <p className="p-4 text-sm text-muted">No chats yet.</p>
          ) : (
            <ul className="max-h-[36rem] divide-y divide-line overflow-y-auto">
              {chats.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/whatsapp?chat=${c.id}`} className={`block px-4 py-3 text-sm hover:bg-mist ${open?.id === c.id ? 'bg-brand-light' : ''}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.client_name || shownNumber(c.client_phone)}</span>
                      {c.mode === 'human' && c.handover_reason
                        ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold">Needs you</span>
                        : c.enquiry_saved && <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand-dark">Enquiry</span>}
                    </span>
                    <span className="block text-xs text-muted">{formatDateTime(c.last_message_at)}{c.mode === 'human' ? ' · team' : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          {!open ? (
            <p className="text-sm text-muted">Choose a chat to read it.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{open.client_name || shownNumber(open.client_phone)}</h2>
                <p className="text-sm text-muted">
                  <a href={`tel:+${open.client_phone}`} className="underline">{shownNumber(open.client_phone)}</a>
                  {open.enquiry_saved && <> · <Link href="/admin/enquiries" className="underline">saved as an enquiry</Link></>}
                </p>
                {open.handover_reason && <p className="mt-2 rounded-lg bg-accent/15 p-3 text-sm"><span className="font-semibold">Riya handed this over:</span> {open.handover_reason}</p>}
              </div>
              <ol className="max-h-[30rem] space-y-2 overflow-y-auto">
                {(messages ?? []).map((m) => (
                  <li key={m.id} className={`flex ${m.direction === 'in' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.direction === 'in' ? 'bg-mist' : m.sender === 'team' ? 'bg-accent/20' : 'bg-brand-light'}`}>
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className="mt-1 text-xs text-muted">{SENDER[m.sender]} · {formatDateTime(m.created_at)}{m.error && <span className="text-red-700"> · not delivered: {m.error}</span>}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {number && (
                <ChatControls
                  chatId={open.id}
                  mode={open.mode}
                  canReply={Boolean(open.last_client_message_at) && Date.now() - new Date(open.last_client_message_at).getTime() < WINDOW_MS}
                />
              )}
            </div>
          )}
        </section>
      </div>

      {number && ctx.isPlatformAdmin && (
        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <p className="text-muted">Connected: {number.display_number || 'number'} (Meta phone number ID {number.phone_number_id}).</p>
          <div className="mt-3"><ConnectNumber connected /></div>
        </section>
      )}
    </div>
  );
}
