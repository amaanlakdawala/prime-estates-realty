'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addContact } from '@/app/admin/calls/actions';

export default function AddContactForm() {
  const router = useRouter();
  const formRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e) {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    setMessage(null);
    startTransition(async () => {
      const result = await addContact(formData);
      if (result?.error) return setMessage({ error: true, text: result.error });
      setMessage({ text: 'Added to your list.' });
      formRef.current.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Name</span>
          <input name="name" className="field" placeholder="Rahul Sharma" />
        </label>
        <label className="block">
          <span className="field-label">Mobile number</span>
          <input name="phone" type="tel" required className="field" placeholder="98200 12345" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">Why we&apos;re calling <span className="font-normal text-muted">(optional)</span></span>
        <input name="context" className="field" placeholder="Enquired on 99acres last week / visited our office" />
      </label>
      <label className="block">
        <span className="field-label">What they&apos;re looking for <span className="font-normal text-muted">(optional)</span></span>
        <input name="notes" className="field" placeholder="2 BHK in Powai, budget around 2 crore" />
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-teal" />
        <span>This person asked us to contact them or is our client.</span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add client'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-teal-dark'}`} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
