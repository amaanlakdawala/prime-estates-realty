'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { createDemoSite, markWhatsAppSent, updateLead } from '@/app/admin/leads/actions';
import { buildMessage, cleanName, whatsappNumber } from '@/lib/leads';

const SETTINGS_KEY = 'sendQueueSettings';
const DEFAULTS = { dailyLimit: 25, includeWithWebsite: false, autoDemo: true, followUpDays: 3 };

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

// One lead at a time: open WhatsApp with the message typed, you press Send, then "Sent → next"
// records it. Nothing is ever sent automatically.
export default function SendQueue({ leads, template, sentToday }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [ready, setReady] = useState(false); // saved settings loaded; nothing happens before this
  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
  }, []);
  const saveSetting = (key, value) => setSettings((s) => {
    const next = { ...s, [key]: value };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });

  const [origin, setOrigin] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    setIsMobile(/Mobi|Android|iPhone/i.test(navigator.userAgent));
  }, []);

  const [handled, setHandled] = useState(() => new Set()); // sent, skipped or blocked this session
  const [demoSlugs, setDemoSlugs] = useState(() => Object.fromEntries(leads.filter((l) => l.demoSlug).map((l) => [l.id, l.demoSlug])));
  const [sentCount, setSentCount] = useState(sentToday);
  const [sessionSent, setSessionSent] = useState(0);
  const [override, setOverride] = useState(false);
  const [opened, setOpened] = useState(false);
  const [message, setMessage] = useState('');
  const [demoState, setDemoState] = useState('idle');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const queue = useMemo(
    () => leads.filter((l) => !handled.has(l.id) && (settings.includeWithWebsite || !l.website)),
    [leads, handled, settings.includeWithWebsite]
  );
  const lead = queue[0] ?? null;
  const demoSlug = lead ? demoSlugs[lead.id] : null;
  const demoLink = demoSlug && origin ? `${origin}/${demoSlug}` : '';
  const limitReached = sentCount >= settings.dailyLimit && !override;

  // New lead on screen: make its demo site if wanted, then prepare the message.
  useEffect(() => {
    if (!lead || !ready) return;
    setOpened(false);
    setError('');
    if (settings.autoDemo && !demoSlugs[lead.id]) {
      setDemoState('creating');
      createDemoSite(lead.id).then((result) => {
        if (result?.error) {
          setDemoState('failed');
          setError(`Demo website not created: ${result.error}`);
        } else {
          setDemoSlugs((m) => ({ ...m, [lead.id]: result.slug }));
          setDemoState('idle');
        }
      });
    } else {
      setDemoState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, settings.autoDemo, ready]);

  useEffect(() => {
    if (lead) setMessage(buildMessage(template, lead, demoLink));
  }, [lead, template, demoLink]);

  function openWhatsApp() {
    const wa = whatsappNumber(lead.phone_intl);
    const text = encodeURIComponent(message);
    const url = isMobile ? `https://wa.me/${wa}?text=${text}` : `https://web.whatsapp.com/send?phone=${wa}&text=${text}`;
    window.open(url, 'whatsapp-send'); // reuses one WhatsApp tab for the whole session
    setOpened(true);
  }

  const done = (id) => setHandled((s) => new Set(s).add(id));

  function markSent() {
    setError('');
    const current = lead;
    startTransition(async () => {
      const result = await markWhatsAppSent(current.id, { followUpDays: settings.followUpDays, message });
      if (result?.error) return setError(result.error);
      setSentCount((n) => n + 1);
      setSessionSent((n) => n + 1);
      done(current.id);
    });
  }

  function doNotContact() {
    setError('');
    const current = lead;
    startTransition(async () => {
      const result = await updateLead(current.id, { status: 'do_not_contact', nextFollowUp: '' });
      if (result?.error) return setError(result.error);
      done(current.id);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {!lead ? (
          <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
            <p className="font-semibold">{sessionSent ? `Done: ${sessionSent} sent this session.` : 'No new leads to message.'}</p>
            <p className="mt-1 text-muted">
              {settings.includeWithWebsite ? 'Every new lead with a WhatsApp number has been handled.' : 'Every new lead without a website has been handled. Tick “Include leads that have a website” to keep going, or find more leads.'}
            </p>
            <Link href="/admin/leads" className="btn-primary mt-5">Back to leads</Link>
          </div>
        ) : limitReached ? (
          <div className="rounded-xl border border-marigold bg-marigold/15 p-8 text-center">
            <p className="text-lg font-semibold">You&apos;ve reached today&apos;s limit of {settings.dailyLimit} messages.</p>
            <p className="mx-auto mt-2 max-w-md text-muted">
              Messaging many new people in one day is what gets WhatsApp numbers banned. {queue.length} leads are waiting for tomorrow.
            </p>
            <button type="button" className="btn-outline mt-5" onClick={() => setOverride(true)}>Send more anyway</button>
          </div>
        ) : (
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Next of {queue.length} waiting</p>
                <h2 className="text-2xl font-semibold">{cleanName(lead.name)}</h2>
                <p className="text-muted">
                  {[lead.locality, lead.city].filter(Boolean).join(', ')} · {lead.phone}
                  {lead.rating ? ` · ${lead.rating}★ (${lead.review_count})` : ''} · score {lead.score}/7
                  {!lead.website && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">No website</span>}
                </p>
              </div>
              <Link href={`/admin/leads/${lead.id}`} target="_blank" className="text-sm font-medium text-teal underline">Open lead</Link>
            </div>

            <div className="mt-4 rounded-lg bg-stone/60 px-4 py-3 text-sm">
              <span className="font-semibold">Demo website: </span>
              {demoState === 'creating' ? 'creating…'
                : demoLink ? <a href={demoLink} target="_blank" rel="noopener noreferrer" className="break-all text-teal underline">{demoLink}</a>
                : settings.autoDemo ? 'not created' : 'off (tick “Create a demo website” to include one)'}
            </div>

            <label className="mt-4 block">
              <span className="field-label">Message (you can edit it for this lead)</span>
              <textarea className="field min-h-[190px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-whatsapp" onClick={openWhatsApp} disabled={demoState === 'creating'}>
                1. Open in WhatsApp
              </button>
              <button type="button" className={opened ? 'btn-primary' : 'btn-outline'} onClick={markSent} disabled={pending || demoState === 'creating'}>
                2. Sent → next
              </button>
              <button type="button" className="btn-outline" onClick={() => done(lead.id)} disabled={pending}>Skip</button>
              <button type="button" className="ml-auto text-sm font-medium text-red-700 underline" onClick={doNotContact} disabled={pending}>Do not contact</button>
            </div>
            <p className="mt-3 text-sm text-muted">
              WhatsApp opens with the message typed. Press <span className="font-semibold">Enter</span> there to send, then come back and click
              {' '}<span className="font-semibold">Sent → next</span>. It marks them Contacted with a follow-up in {settings.followUpDays} days.
              Skip leaves them in the queue for another day.
            </p>
            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          </section>
        )}
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-line bg-white p-5">
        <div>
          <p className="text-sm text-muted">Sent today</p>
          <p className="font-display text-3xl font-semibold">{sentCount}<span className="text-lg text-muted"> / {settings.dailyLimit}</span></p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div className={`h-full ${sentCount >= settings.dailyLimit ? 'bg-marigold' : 'bg-[#1E8E4E]'}`} style={{ width: `${Math.min(100, (sentCount / settings.dailyLimit) * 100)}%` }} />
          </div>
        </div>
        <label className="block">
          <span className="field-label">Daily limit</span>
          <input type="number" min={1} max={200} className="field" value={settings.dailyLimit} onChange={(e) => saveSetting('dailyLimit', Math.max(1, Number(e.target.value) || 1))} />
          <p className="mt-1.5 text-sm text-muted">20–30 new people a day is safer, especially on a new number.</p>
        </label>
        <label className="block">
          <span className="field-label">Follow up after</span>
          <select className="field" value={settings.followUpDays} onChange={(e) => saveSetting('followUpDays', Number(e.target.value))}>
            {[2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <label className="flex items-start gap-2.5 text-[15px]">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-teal" checked={settings.autoDemo} onChange={(e) => saveSetting('autoDemo', e.target.checked)} />
          <span>Create a demo website for each lead and put its link in the message</span>
        </label>
        <label className="flex items-start gap-2.5 text-[15px]">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-teal" checked={settings.includeWithWebsite} onChange={(e) => saveSetting('includeWithWebsite', e.target.checked)} />
          <span>Include leads that have a website</span>
        </label>
      </aside>
    </div>
  );
}
