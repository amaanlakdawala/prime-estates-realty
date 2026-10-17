'use client';

import { useEffect, useRef, useState } from 'react';
import { submitEnquiry } from '@/app/actions/enquiry';

// firmId: the firm whose website this is. The enquiry lands in that firm's admin panel only.
export default function EnquiryForm({ firmId, listingId = null, source = 'website', defaultMessage = '', submitLabel = 'Send enquiry', compact = false }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: defaultMessage });
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const startedAt = useRef(0); // when the form appeared: instant submissions are bots
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const digits = form.phone.replace(/\D/g, '');
    if (form.name.trim().length < 2) return setError('Enter your name.');
    if (digits.length < 10) return setError('Enter a 10-digit mobile number.');

    setState('sending');
    // Saved on the server, which checks for spam and rate limits (app/actions/enquiry.js).
    const result = await submitEnquiry({ ...form, firmId, listingId, source, startedAt: startedAt.current, website: e.currentTarget.elements.website?.value })
      .catch(() => ({ error: 'Your enquiry could not be sent. Check your connection and try again, or call us directly.' }));
    if (result?.error) {
      setState('error');
      setError(result.error);
      return;
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand-light p-5" role="status">
        <p className="font-semibold text-brand-dark">Enquiry sent.</p>
        <p className="mt-1 text-sm text-ink/80">Our team will call you on {form.phone} within one working day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3.5">
      {/* Hidden from people (and screen readers); bots that fill every field are ignored. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <div className={compact ? 'space-y-3.5' : 'grid gap-3.5 sm:grid-cols-2'}>
        <label className="block">
          <span className="field-label">Name</span>
          <input className="field" value={form.name} onChange={update('name')} autoComplete="name" required />
        </label>
        <label className="block">
          <span className="field-label">Mobile number</span>
          <input className="field" type="tel" inputMode="tel" value={form.phone} onChange={update('phone')} autoComplete="tel" placeholder="98765 43210" required />
        </label>
      </div>
      <label className="block">
        <span className="field-label">Email <span className="font-normal text-muted">(optional)</span></span>
        <input className="field" type="email" value={form.email} onChange={update('email')} autoComplete="email" />
      </label>
      <label className="block">
        <span className="field-label">Message <span className="font-normal text-muted">(optional)</span></span>
        <textarea className="field min-h-[96px]" value={form.message} onChange={update('message')} />
      </label>
      {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}
