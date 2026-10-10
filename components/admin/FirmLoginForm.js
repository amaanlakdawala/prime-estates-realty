'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createFirmLogin } from '@/app/admin/firms/actions';
import { generatePassword } from '@/lib/password';

// Creates a login for one firm. It can only ever see and change that firm's data.
export default function FirmLoginForm({ firmId }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [password, setPassword] = useState('');
  // Generated after load so the server-rendered and browser values don't differ.
  useEffect(() => setPassword(generatePassword()), []);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e) {
    e.preventDefault();
    setError('');
    setCreated(null);
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      const result = await createFirmLogin(firmId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setCreated({ email: formData.get('email'), password: formData.get('password') });
      formRef.current?.reset();
      setPassword(generatePassword());
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Person&apos;s name</span>
          <input name="full_name" type="text" className="field" placeholder="Firm owner's name" autoComplete="off" />
        </label>
        <label className="block">
          <span className="field-label">Phone <span className="font-normal text-muted">(optional)</span></span>
          <input name="phone" type="tel" className="field" placeholder="+91 98200 12345" autoComplete="off" />
        </label>
      </div>
      <label className="block">
        <span className="field-label">Login email</span>
        <input name="email" type="email" required className="field" placeholder="owner@seabreezerealtors.in" autoComplete="off" />
      </label>
      <label className="block">
        <span className="field-label">Password</span>
        <div className="flex gap-2">
          <input name="password" type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setPassword(generatePassword())}>New</button>
        </div>
        <p className="mt-1.5 text-sm text-muted">Share it with them directly. They sign in at /login. If they forget it, open the login below and set a new one.</p>
      </label>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {created && (
        <p className="rounded-lg border border-teal/30 bg-teal-light p-3 text-sm text-teal-dark" role="status">
          Login created for {created.email}. Password: <span className="font-semibold">{created.password}</span>
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create login'}</button>
    </form>
  );
}
