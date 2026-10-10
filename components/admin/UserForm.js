'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEmployee } from '@/app/admin/users/actions';
import { generatePassword } from '@/lib/password';

export default function UserForm() {
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
      const result = await createEmployee(formData);
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
    <form ref={formRef} onSubmit={onSubmit} className="mt-5 space-y-4">
      <label className="block">
        <span className="field-label">Full name</span>
        <input name="full_name" type="text" className="field" placeholder="Priya Deshmukh" autoComplete="off" />
      </label>
      <label className="block">
        <span className="field-label">Phone <span className="font-normal text-muted">(optional)</span></span>
        <input name="phone" type="tel" className="field" placeholder="+91 98765 43210" autoComplete="off" />
      </label>
      <label className="block">
        <span className="field-label">Email</span>
        <input name="email" type="email" required className="field" placeholder="employee@primeestatesrealty.com" />
      </label>
      <label className="block">
        <span className="field-label">Temporary password</span>
        <div className="flex gap-2">
          <input name="password" type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setPassword(generatePassword())}>New</button>
        </div>
        <p className="mt-1.5 text-sm text-muted">Share this with them directly. If they forget it, open their page from the list and set a new one.</p>
      </label>
      <fieldset>
        <legend className="field-label">Access level</legend>
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-line px-4 py-2.5 text-[15px] font-medium has-[:checked]:border-teal has-[:checked]:bg-teal-light has-[:checked]:text-teal-dark">
            <input type="radio" name="role" value="staff" defaultChecked className="sr-only" />
            Staff
          </label>
          <label className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-line px-4 py-2.5 text-[15px] font-medium has-[:checked]:border-teal has-[:checked]:bg-teal-light has-[:checked]:text-teal-dark">
            <input type="radio" name="role" value="admin" className="sr-only" />
            Admin
          </label>
        </div>
        <p className="mt-1.5 text-sm text-muted">Staff can manage listings and enquiries. Admins can also add or remove team members.</p>
      </fieldset>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {created && (
        <p className="rounded-lg border border-teal/30 bg-teal-light p-3 text-sm text-teal-dark" role="status">
          Account created for {created.email}. Password: <span className="font-semibold">{created.password}</span>
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? 'Creating…' : 'Create login'}</button>
    </form>
  );
}
