'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatPrice } from '@/lib/format';
import { propertyFromListing, renderWriteup, validPhone, EMPTY_PROPERTY } from '../format';
import { tidyDescription, saveMyContact } from '../actions';

const SAVED_CONTACT = 'writeup-contact'; // this browser's last used contact, if the profile has none

export default function WriteupMaker({ listings, site, me, preselect = [], aiReady }) {
  const [contact, setContact] = useState({ name: me.name, phone: me.phone });
  const [contactNote, setContactNote] = useState('');
  const [mode, setMode] = useState('listings');
  const [selected, setSelected] = useState(preselect);
  const [search, setSearch] = useState('');
  const [pasted, setPasted] = useState('');
  const [tidied, setTidied] = useState(null); // properties from the AI
  const [opts, setOpts] = useState({ emoji: true, withPrice: true, withNotes: false, withLink: true });
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!me.phone) {
      try { const c = JSON.parse(localStorage.getItem(SAVED_CONTACT) || 'null'); if (c?.phone) setContact(c); } catch { /* storage blocked */ }
    }
  }, [me.phone]);

  const contactOk = validPhone(contact.phone);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => !q || `${l.title} ${l.locality}`.toLowerCase().includes(q));
  }, [listings, search]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function remember() {
    try { localStorage.setItem(SAVED_CONTACT, JSON.stringify(contact)); } catch { /* storage blocked */ }
  }

  function makeFromListings() {
    const chosen = selected.map((id) => listings.find((l) => l.id === id)).filter(Boolean);
    const props = chosen.map((l) => propertyFromListing(l, site, { origin: opts.withLink ? origin : '', withPrice: opts.withPrice, withNotes: opts.withNotes }));
    setOutput(renderWriteup(props, contact, { firmName: site.name, emoji: opts.emoji }));
    remember();
  }

  function makeFromPaste() {
    setError('');
    startTransition(async () => {
      const res = await tidyDescription(pasted);
      if (res.error) { setError(res.error); return; }
      const props = res.properties.map((p) => ({ ...EMPTY_PROPERTY, ...p, price: opts.withPrice ? p.price : '', notes: opts.withNotes ? p.notes : '' }));
      setTidied(props);
      setOutput(renderWriteup(props, contact, { firmName: site.name, emoji: opts.emoji }));
      remember();
    });
  }

  // Changing the contact or the options re-renders a pasted write-up without asking the AI again.
  useEffect(() => {
    if (mode === 'paste' && tidied) {
      const props = tidied.map((p) => ({ ...p, price: opts.withPrice ? p.price : '', notes: opts.withNotes ? p.notes : '' }));
      setOutput(renderWriteup(props, contact, { firmName: site.name, emoji: opts.emoji }));
    }
  }, [opts.emoji, opts.withPrice, opts.withNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveAsMine() {
    setContactNote('');
    startTransition(async () => {
      const res = await saveMyContact(contact);
      setContactNote(res.error ? res.error : 'Saved. It will be filled in for you next time.');
    });
  }

  async function copy() {
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select by hand */ }
  }

  const canMake = contactOk && (mode === 'listings' ? selected.length > 0 : pasted.trim().length >= 15);
  const opt = (key, label) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))} className="h-4 w-4 accent-brand" />
      {label}
    </label>
  );

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {/* 1. Contact */}
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">1. Your contact details</h2>
          <p className="mt-1 text-sm text-muted">Added below every property, so enquiries from the group come to you.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Your name</span>
              <input className="field" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="Rahul Sharma" />
            </label>
            <label className="block">
              <span className="field-label">Your mobile number</span>
              <input className="field" type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="98200 12345" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-outline py-1.5 text-sm" onClick={saveAsMine} disabled={!contactOk || pending}>Save as my details</button>
            {!contactOk && <span className="text-sm text-red-700">Enter your mobile number to make a write-up.</span>}
            {contactNote && <span className="text-sm text-brand-dark" role="status">{contactNote}</span>}
          </div>
        </section>

        {/* 2. Property */}
        <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold">2. Property details</h2>
          <div className="mt-3 flex gap-2" role="tablist">
            {[['listings', 'From my listings'], ['paste', 'Paste a description']].map(([m, label]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setOutput(''); setError(''); }}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${mode === m ? 'border-brand bg-brand text-white' : 'border-line'}`}>{label}</button>
            ))}
          </div>

          {mode === 'listings' ? (
            <div className="mt-4">
              <input className="field" type="search" placeholder="Search by title or area" value={search} onChange={(e) => setSearch(e.target.value)} />
              <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {filtered.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-mist">
                      <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} className="mt-1 h-4 w-4 accent-brand" />
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium">{l.title}</span>
                        <span className="text-muted">{l.locality} · {formatPrice(l.price, l.deal_type)}{l.show_on_website === false ? ' · Private' : ''}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {!filtered.length && <li className="px-3 py-4 text-sm text-muted">No available listings match.</li>}
              </ul>
              <p className="mt-2 text-sm text-muted">{selected.length} selected. Several properties go in one message, each with your number below it.</p>
            </div>
          ) : (
            <div className="mt-4">
              {!aiReady && <p className="mb-3 rounded-lg bg-accent/15 p-3 text-sm">AI tidy-up is not switched on yet. Ask the platform admin to add the AI key.</p>}
              <textarea className="field min-h-[200px]" value={pasted} onChange={(e) => { setPasted(e.target.value); setTidied(null); }}
                placeholder={'Paste any property message, e.g.\n2bhk lodha park lower parel 1050 carpet 22nd flr SF sea view 2.1cr nego call 98xxxxxx'} />
              <p className="mt-2 text-sm text-muted">The AI only organises what you paste. It removes phone numbers and agent names from the text and never adds details.</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {opt('emoji', 'Emojis')}
            {opt('withPrice', 'Show price')}
            {opt('withNotes', 'Add short description')}
            {mode === 'listings' && opt('withLink', 'Add photos link (public listings)')}
          </div>

          <button type="button" className="btn-primary mt-5" disabled={!canMake || pending || (mode === 'paste' && !aiReady)}
            onClick={mode === 'listings' ? makeFromListings : makeFromPaste}>
            {pending && mode === 'paste' ? 'Organising…' : 'Make write-up'}
          </button>
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        </section>
      </div>

      {/* 3. Result */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-lg font-semibold">3. Your WhatsApp message</h2>
        {output ? (
          <>
            <p className="mt-1 text-sm text-muted">Edit anything here before sending. *Stars* show as bold on WhatsApp.</p>
            <textarea className="field mt-3 min-h-[420px] font-[inherit] text-sm" value={output} onChange={(e) => setOutput(e.target.value)} aria-label="WhatsApp message" />
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy message'}</button>
              <a className="btn-outline" href={`https://wa.me/?text=${encodeURIComponent(output)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            </div>
            <p className="mt-2 text-xs text-muted">"Share on WhatsApp" opens WhatsApp so you can pick the groups to send it to.</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Add your number, choose listings or paste a description, then press "Make write-up".</p>
        )}
      </section>
    </div>
  );
}
