'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';
import SetPasswordDialog from './SetPasswordDialog';
import { deleteEmployee, setEmployeePassword } from '@/app/admin/users/actions';

// Password and removal buttons on a login's page (platform admin only).
export default function UserActions({ employee, isSelf }) {
  const router = useRouter();
  const [settingPassword, setSettingPassword] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function savePassword(password) {
    startTransition(async () => {
      const result = await setEmployeePassword(employee.id, password);
      if (result?.error) return setNotice(result.error);
      setSettingPassword(false);
      setNotice(`New password: ${password} — share it with them directly.`);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);
      if (result?.error) {
        setConfirmingRemove(false);
        return setNotice(result.error);
      }
      router.push(employee.firm ? `/admin/firms/${employee.firm.id}` : '/admin/users');
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" disabled={pending} onClick={() => setSettingPassword(true)}>Set password</button>
        <button type="button" className="btn-outline border-red-200 text-red-700 hover:border-red-700" disabled={isSelf || pending} onClick={() => setConfirmingRemove(true)}>Remove login</button>
      </div>
      {isSelf && <p className="mt-2 text-sm text-muted">You can&apos;t remove your own login.</p>}
      {notice && <p className="mt-3 rounded-lg border border-line bg-stone px-4 py-2.5 text-sm" role="status">{notice}</p>}

      <SetPasswordDialog employee={settingPassword ? employee : null} busy={pending} onSubmit={savePassword} onCancel={() => setSettingPassword(false)} />
      <ConfirmDialog
        open={confirmingRemove}
        busy={pending}
        busyLabel="Removing…"
        title="Remove this login?"
        message={`${employee.email} will no longer be able to sign in.${employee.firm ? ` ${employee.firm.name}'s listings and website are not affected.` : ''}`}
        confirmLabel="Remove login"
        onConfirm={remove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
