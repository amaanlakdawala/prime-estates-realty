'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// firmId: the firm whose website this is. The enquiry lands in that firm's admin panel only.
export default function EnquiryForm({ firmId, listingId = null, source = 'website', defaultMessage = '', submitLabel = 'Send enquiry', compact = false }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: defaultMessage });
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const digits = form.phone.replace(/\D/g, '');
    if (form.name.trim().length < 2) return setError('Enter your name.');
    if (digits.length < 10) return setError('Enter a 10-digit mobile number.');

    setState('sending');
    const supabase = createClient();
    const { error: dbError } = await supabase.from('enquiries').insert({
      firm_id: firmId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      message: form.message.trim() || null,
      listing_id: listingId,
      source,
    });
    if (dbError) {
      setState('error');
      setError('Your enquiry could not be sent. Check your connection and try again, or call us directly.');
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
