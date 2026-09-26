'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from './ConfirmDialog';
import { deleteEmployee, setEmployeeRole } from '@/app/admin/users/actions';
import { formatDate } from '@/lib/format';

export default function UsersTable({ employees, currentUserId }) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function toggleRole(emp) {
    const nextRole = emp.role === 'admin' ? 'staff' : 'admin';
    setBusyId(emp.id);
    setNotice('');
    startTransition(async () => {
      const result = await setEmployeeRole(emp.id, nextRole);
      setBusyId(null);
      if (result?.error) return setNotice(result.error);
      setNotice(`${emp.email} is now ${nextRole === 'admin' ? 'an admin' : 'staff'}.`);
      router.refresh();
    });
  }

  function confirmDelete() {
    const emp = toDelete;
    startTransition(async () => {
      const result = await deleteEmployee(emp.id);
      setToDelete(null);
      if (result?.error) return setNotice(result.error);
      setNotice(`${emp.email}'s access was removed.`);
      router.refresh();
    });
  }

  if (!employees.length) {
    return <p className="mt-4 text-muted">No team members yet.</p>;
  }

  return (
    <div className="mt-4">
      {notice && <p className="mb-3 rounded-lg border border-line bg-stone px-4 py-2.5 text-sm" role="status">{notice}</p>}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line bg-stone text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Email</th>
              <th scope="col" className="px-4 py-3 font-medium">Role</th>
              <th scope="col" className="px-4 py-3 font-medium">Added</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {employees.map((emp) => {
              const isSelf = emp.id === currentUserId;
              const busy = busyId === emp.id;
              return (
                <tr key={emp.id}>
                  <td className="px-4 py-3">
                    {emp.email} {isSelf && <span className="text-muted">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${emp.role === 'admin' ? 'bg-basalt text-white' : 'bg-teal-light text-teal-dark'}`}>
                      {emp.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(emp.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" disabled={isSelf || busy || pending} onClick={() => toggleRole(emp)} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-basalt disabled:opacity-50">
                        Make {emp.role === 'admin' ? 'staff' : 'admin'}
                      </button>
                      <button type="button" disabled={isSelf} onClick={() => setToDelete(emp)} className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:border-red-700 disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        busy={pending}
        title="Remove this team member?"
        message={toDelete ? `${toDelete.email} will no longer be able to sign in to the admin panel.` : ''}
        confirmLabel="Remove access"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
