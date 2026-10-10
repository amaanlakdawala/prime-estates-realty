'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';
import SetPasswordDialog from './SetPasswordDialog';
import { deleteEmployee, setEmployeePassword, setEmployeeRole } from '@/app/admin/users/actions';

// Password, role and removal buttons on a team member's page.
export default function UserActions({ employee, isSelf }) {
  const router = useRouter();
  const [settingPassword, setSettingPassword] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const nextRole = employee.role === 'admin' ? 'staff' : 'admin';

  function savePassword(password) {
    startTransition(async () => {
      const result = await setEmployeePassword(employee.id, password);
      if (result?.error) return setNotice(result.error);
      setSettingPassword(false);
      setNotice(`New password: ${password} — share it with them directly.`);
    });
  }

  function toggleRole() {
    setNotice('');
    startTransition(async () => {
      const result = await setEmployeeRole(employee.id, nextRole);
      if (result?.error) return setNotice(result.error);
      setNotice(`Now ${nextRole === 'admin' ? 'an admin' : 'staff'}.`);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      if (result?.error) {
        setConfirmingRemove(false);
        return setNotice(result.error);
      }
      router.push('/admin/users');
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" disabled={pending} onClick={() => setSettingPassword(true)}>Set password</button>
        <button type="button" className="btn-outline" disabled={isSelf || pending} onClick={toggleRole}>Make {nextRole}</button>
        <button type="button" className="btn-outline border-red-200 text-red-700 hover:border-red-700" disabled={isSelf || pending} onClick={() => setConfirmingRemove(true)}>Remove access</button>
      </div>
      {isSelf && <p className="mt-2 text-sm text-muted">You can't change your own role or remove yourself. Another admin can.</p>}
      {notice && <p className="mt-3 rounded-lg border border-line bg-stone px-4 py-2.5 text-sm" role="status">{notice}</p>}

      <SetPasswordDialog employee={settingPassword ? employee : null} busy={pending} onSubmit={savePassword} onCancel={() => setSettingPassword(false)} />
      <ConfirmDialog
        open={confirmingRemove}
        busy={pending}
        title="Remove this team member?"
        message={`${employee.email} will no longer be able to sign in to the admin panel. Listings they added stay on the website.`}
        confirmLabel="Remove access"
        onConfirm={remove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
