'use client';

import { useEffect, useRef, useState } from 'react';
import { submitServiceEnquiry } from '@/app/actions/contact';

// The home page's "talk to me" form. Saved on the server, which checks for spam (app/actions/contact.js).
export default function ContactForm() {
  const [form, setForm] = useState({ name: '', firm: '', phone: '', message: '' });
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const startedAt = useRef(0); // when the form appeared: instant submissions are bots
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Enter your name.');
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Enter a 10-digit mobile number.');
    setState('sending');
    const result = await submitServiceEnquiry({ ...form, startedAt: startedAt.current, website: e.currentTarget.elements.website?.value })
      .catch(() => ({ error: 'Your message could not be sent. Please WhatsApp me instead.' }));
    if (result?.error) {
      setState('error');
      setError(result.error);
      return;
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="rounded-2xl border border-brand/30 bg-brand-light p-6" role="status">
        <p className="font-display text-lg font-semibold text-brand-dark">Thank you, {form.name.split(' ')[0]}.</p>
        <p className="mt-1 text-ink/80">I&apos;ll WhatsApp you on {form.phone} today to set up a quick demo.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-card sm:grid-cols-2" noValidate>
      <label className="block">
        <span className="field-label">Your name</span>
        <input className="field" value={form.name} onChange={update('name')} autoComplete="name" placeholder="Rahul Shah" required />
      </label>
      <label className="block">
        <span className="field-label">Brokerage name <span className="font-normal text-muted">(optional)</span></span>
        <input className="field" value={form.firm} onChange={update('firm')} autoComplete="organization" placeholder="Shah Realty" />
      </label>
      <label className="block sm:col-span-2">
        <span className="field-label">Mobile number (WhatsApp)</span>
        <input className="field" type="tel" inputMode="tel" value={form.phone} onChange={update('phone')} autoComplete="tel" placeholder="98200 12345" required />
      </label>
      <label className="block sm:col-span-2">
        <span className="field-label">What would you like? <span className="font-normal text-muted">(optional)</span></span>
        <textarea className="field min-h-[96px]" value={form.message} onChange={update('message')} placeholder="A website for my brokerage, AI calling for my enquiries, or both" />
      </label>
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Request a demo'}</button>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>
    </form>
  );
}
