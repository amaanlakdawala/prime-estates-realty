import Link from 'next/link';
import { formatDate, formatDateTime } from '@/lib/format';

export function RoleBadge({ employee }) {
  return employee.role === 'admin' ? (
    <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">Platform admin</span>
  ) : (
    <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand-dark">{employee.firm?.name ?? 'No firm'}</span>
  );
}

// Every login. Each row opens that login's page (password, removal, details).
export default function UsersTable({ employees, currentUserId }) {
  if (!employees.length) {
    return <p className="text-muted">No logins yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-mist text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Person</th>
            <th scope="col" className="px-4 py-3 font-medium">Access</th>
            <th scope="col" className="px-4 py-3 font-medium">Last sign-in</th>
            <th scope="col" className="px-4 py-3 font-medium">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {employees.map((emp) => (
            <tr key={emp.id} className="relative hover:bg-mist/60">
              <td className="px-4 py-3">
                {/* The link's ::after covers the whole row, so anywhere on it is clickable. */}
                <Link href={`/admin/users/${emp.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                  {emp.name || emp.email}
                </Link>
                {emp.id === currentUserId && <span className="ml-1 text-muted">(you)</span>}
                {emp.name && <span className="block text-muted">{emp.email}</span>}
              </td>
              <td className="px-4 py-3"><RoleBadge employee={emp} /></td>
              <td className="px-4 py-3 text-muted">{emp.last_sign_in_at ? formatDateTime(emp.last_sign_in_at) : 'Never'}</td>
              <td className="px-4 py-3 text-muted">{formatDate(emp.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
