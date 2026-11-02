'use client';

import { useEffect, useRef, useState } from 'react';

// The AI chatbot on a firm's website: a button above the WhatsApp button that opens a chat window.
// Replies come from /api/chat (lib/chat/assistant.js). Shown only when the platform admin switched it on
// for the firm. The conversation is kept for the browser tab, so it survives moving between pages.

const STARTERS = ['I want to buy a flat', 'Looking for a flat on rent', 'Talk to a consultant'];

const store = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: not kept */ } },
};

function ChatIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" />
    </svg>
  );
}

function ListingCard({ l }) {
  return (
    <a href={l.link} className="flex gap-3 rounded-xl border border-line bg-white p-2 transition hover:border-brand/50 hover:shadow-card">
      {l.photo
        ? <img src={l.photo} alt="" loading="lazy" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
        : <span className="h-16 w-20 shrink-0 rounded-lg bg-mist" aria-hidden="true" />}
      <span className="min-w-0 text-sm">
        <span className="block truncate font-semibold text-ink">{l.title}</span>
        <span className="block truncate text-muted">{[l.bhk ? `${l.bhk} BHK` : l.type, l.area].filter(Boolean).join(' · ')}</span>
        <span className="block font-semibold text-brand">{l.price}</span>
      </span>
    </a>
  );
}

export default function ChatWidget({ site }) {
  const key = `chat:${site.slug}`;
  const greeting = { role: 'assistant', content: `Hi! I'm Riya, ${site.name}'s AI assistant. Looking to buy or rent? Tell me the area and budget, and I'll show you what we have.` };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([greeting]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const saved = store.get(key);
    if (saved?.messages?.length) setMessages(saved.messages);
    if (saved?.open) setOpen(true);
    if (saved?.seen) return undefined;
    const t = setTimeout(() => setTeaser(true), 8000); // a gentle nudge, once per visit
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => { store.set(key, { messages, open, seen: true }); }, [key, messages, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text) {
    const content = text.trim().slice(0, 600);
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firm: site.slug, messages: next.map(({ role, content: c }) => ({ role, content: c })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || 'Sorry, the chat is not working right now.');
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, listings: data.listings?.length ? data.listings : undefined }]);
    } catch (err) {
      // Shown, but not sent back to the AI as something it said.
      setMessages((m) => [...m, { role: 'notice', content: `${err.message} ${site.phoneDisplay ? `You can also call ${site.phoneDisplay}.` : ''}`.trim() }]);
    } finally {
      setBusy(false);
    }
  }

  const openChat = () => { setTeaser(false); setOpen(true); };
  const visitorSpoke = messages.some((m) => m.role === 'user');

  return (
    <>
      {!open && (
        <div className="fixed bottom-[9.5rem] right-5 z-50 flex items-end gap-2">
          {teaser && (
            <div className="relative mb-1 max-w-[220px] animate-fade-in rounded-2xl rounded-br-sm bg-white px-4 py-3 text-sm text-ink shadow-lift">
              <button type="button" onClick={() => setTeaser(false)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-white" aria-label="Dismiss">✕</button>
              <button type="button" onClick={openChat} className="text-left">Hi! Looking for a property? <span className="font-semibold text-brand">Ask me</span></button>
            </div>
          )}
          <button
            type="button"
            onClick={openChat}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_30px_-6px_rgb(43_89_232_/_0.6)] transition duration-300 hover:-translate-y-1 hover:bg-brand-dark"
            aria-label="Chat with our AI assistant"
          >
            <ChatIcon />
          </button>
        </div>
      )}

      {open && (
        <section
          className="fixed inset-x-0 bottom-0 z-[60] flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-mist shadow-lift sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[calc(100dvh-2.5rem)] sm:w-[380px] sm:rounded-2xl"
          role="dialog"
          aria-label={`Chat with ${site.name}`}
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand"><ChatIcon size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display font-semibold">Riya · {site.name}</span>
              <span className="block text-xs text-white/70">AI assistant · replies in seconds</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-white/10" aria-label="Close chat">✕</button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                {m.role === 'notice'
                  ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{m.content}</p>
                  : (
                    <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${m.role === 'user' ? 'rounded-br-sm bg-brand text-white' : 'rounded-bl-sm bg-white text-ink shadow-card'}`}>
                      {m.content}
                    </p>
                  )}
                {m.listings && <div className="mt-2 space-y-2">{m.listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>}
              </div>
            ))}
            {busy && (
              <div className="inline-flex gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-card" aria-label="Riya is typing">
                {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-muted/60" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            )}
            {!visitorSpoke && !busy && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-brand/40 bg-white px-3 py-1.5 text-sm text-brand transition hover:bg-brand-light">{s}</button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line bg-white p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={600}
                placeholder="Type your message…"
                className="field flex-1 !text-base"
                aria-label="Your message"
              />
              <button type="submit" disabled={busy || !input.trim()} className="btn-primary !px-4 disabled:opacity-50" aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12l-11.5 1.9z" /></svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">AI assistant, can make mistakes. Details you share go only to {site.name}.</p>
          </form>
        </section>
      )}
    </>
  );
}
