'use client';

import { useState, useTransition } from 'react';
import { createFirm } from '@/app/admin/firms/actions';

// "Sea Breeze Realtors" -> "sea-breeze-realtors"
const toSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function NewFirmForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError('');
    startTransition(async () => {
      const result = await createFirm(formData); // redirects to the new firm's page on success
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <label className="block">
        <span className="field-label">Firm name</span>
        <input
          name="name"
          required
          className="field"
          placeholder="Sea Breeze Realtors"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(toSlug(e.target.value));
          }}
        />
      </label>
      <label className="block">
        <span className="field-label">Web address</span>
        <div className="flex items-center rounded-lg border border-line bg-white focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20">
          <span className="pl-3.5 text-[15px] text-muted">/</span>
          <input
            name="slug"
            required
            className="w-full rounded-lg bg-transparent px-1 py-2.5 text-[15px] focus:outline-none"
            placeholder="sea-breeze-realtors"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
              setSlugEdited(true);
            }}
          />
        </div>
        <p className="mt-1.5 text-sm text-muted">Their website will be at /{slug || 'their-name'}.</p>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">City</span>
          <input name="city" className="field" placeholder="Mumbai" />
        </label>
        <label className="block">
          <span className="field-label">Phone</span>
          <input name="phone" type="tel" className="field" placeholder="+91 98200 12345" />
        </label>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? 'Creating…' : 'Create firm'}</button>
      <p className="text-sm text-muted">Next you&apos;ll fill in their other details and create their login.</p>
    </form>
  );
}
