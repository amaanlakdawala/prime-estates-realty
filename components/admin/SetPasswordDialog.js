'use client';

import { useEffect, useRef, useState } from 'react';
import { generatePassword } from '@/lib/password';

// Lets an admin choose a new password for a team member. `employee` null = closed.
export default function SetPasswordDialog({ employee, busy, onSubmit, onCancel }) {
  const ref = useRef(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (employee && !dialog.open) {
      setPassword(generatePassword());
      dialog.showModal();
    }
    if (!employee && dialog.open) dialog.close();
  }, [employee]);

  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }} className="w-[min(92vw,26rem)] rounded-xl p-0 backdrop:bg-basalt/60">
      <form className="p-6" onSubmit={(e) => { e.preventDefault(); onSubmit(password); }}>
        <h2 className="text-xl font-semibold">Set a new password</h2>
        <p className="mt-2 text-[15px] text-basalt/80">For {employee?.email}. Their old password stops working straight away.</p>
        <label className="mt-4 block">
          <span className="field-label">New password</span>
          <div className="flex gap-2">
            <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="field" autoComplete="off" />
            <button type="button" className="btn-outline whitespace-nowrap" onClick={() => setPassword(generatePassword())} disabled={busy}>New</button>
          </div>
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
        </div>
      </form>
    </dialog>
  );
}
