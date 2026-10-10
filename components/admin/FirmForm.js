'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateFirm } from '@/app/admin/firms/actions';

// Edits a firm's details. adminFields: also the web address and demo setting (platform admin only).
export default function FirmForm({ firm, adminFields = false }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await updateFirm(firm.id, formData);
      setMessage(result?.error ? { error: true, text: result.error } : { text: 'Saved. The website shows the new details now.' });
      if (!result?.error) router.refresh();
    });
  }

  const field = (name, label, value, props = {}) => (
    <label className={`block ${props.wide ? 'sm:col-span-2' : ''}`}>
      <span className="field-label">{label}{props.optional && <span className="font-normal text-muted"> (optional)</span>}</span>
      <input name={name} defaultValue={value ?? ''} className="field" type={props.type ?? 'text'} placeholder={props.placeholder} required={props.required} />
      {props.hint && <p className="mt-1.5 text-sm text-muted">{props.hint}</p>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      {field('name', 'Firm name', firm.name, { required: true, placeholder: 'Sea Breeze Realtors' })}
      {adminFields
        ? field('slug', 'Web address', firm.slug, { required: true, hint: `Their site: /${firm.slug}. Changing it breaks links they've already shared.` })
        : <div />}
      {field('city', 'City', firm.city, { placeholder: 'Mumbai' })}
      {field('founded_year', 'Founded in', firm.foundedYear, { type: 'number', placeholder: '2015', hint: 'Shown as "since 2015". Leave empty to hide.' })}
      {field('phone', 'Phone', firm.phoneDisplay, { type: 'tel', placeholder: '+91 98200 12345' })}
      {field('whatsapp', 'WhatsApp number', firm.whatsappRaw, { type: 'tel', optional: true, hint: 'Only if different from the phone number.' })}
      {field('email', 'Email', firm.email, { type: 'email', placeholder: 'hello@seabreezerealtors.in' })}
      {field('hours', 'Office hours', firm.hours, { placeholder: 'Monday to Saturday, 10 am to 7 pm' })}
      {field('address', 'Office address', firm.address, { wide: true, placeholder: 'Shop 3, Lokhandwala Complex, Andheri West, Mumbai 400053' })}
      {field('localities', 'Areas covered', firm.localities.join(', '), { wide: true, placeholder: 'Andheri West, Bandra West, Powai, Juhu', hint: 'Separate with commas. These become the locality filter on their site.' })}
      {field('rera_no', 'MahaRERA agent number', firm.mahareraAgentNo, { optional: true, hint: 'Every MahaRERA mention on the site stays hidden until this is filled in.' })}
      {field('logo_url', 'Logo image link', firm.logoUrl, { optional: true, placeholder: 'https://…/logo.png' })}
      {field('hero_url', 'Home page photo or video link', firm.heroUrl, { optional: true, wide: true, placeholder: 'https://…/building.jpg or …/tour.mp4', hint: 'Shown behind the headline. Empty = sample photo collage.' })}
      {adminFields && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-4 sm:col-span-2 has-[:checked]:border-marigold has-[:checked]:bg-marigold/10">
          <input type="checkbox" name="demo_content" defaultChecked={firm.demoContent} className="mt-1 h-4 w-4 accent-teal" />
          <span>
            <span className="block font-medium">Demo firm: show sample testimonials and team</span>
            <span className="text-sm text-muted">Only for your own demo sites. Never tick this for a real client, or invented reviews appear on their site.</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-teal-dark'}`} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
