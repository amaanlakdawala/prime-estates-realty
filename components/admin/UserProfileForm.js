'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateEmployeeProfile } from '@/app/admin/users/actions';

export default function UserProfileForm({ employee }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phone);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();
  const changed = fullName !== employee.name || phone !== employee.phone;

  function onSubmit(e) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateEmployeeProfile(employee.id, { fullName, phone });
      setMessage(result?.error ? { error: true, text: result.error } : { text: 'Saved.' });
      if (!result?.error) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="field-label">Full name</span>
        <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Not set" />
      </label>
      <label className="block">
        <span className="field-label">Phone</span>
        <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Not set" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending || !changed}>{pending ? 'Saving…' : 'Save details'}</button>
        {message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</p>}
      </div>
    </form>
  );
}
