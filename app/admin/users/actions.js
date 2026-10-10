'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Only the platform admin manages logins. Firm logins are created on the firm's page
// (createFirmLogin in app/admin/firms/actions.js).
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error('Only the platform admin can do this.');
  return user;
}

// Name and phone live in the login's user_metadata, so no extra table is needed.
function cleanProfile(fullName, phone) {
  return {
    full_name: (fullName ?? '').toString().trim().slice(0, 120),
    phone: (phone ?? '').toString().trim().slice(0, 30),
  };
}

export async function updateEmployeeProfile(userId, { fullName, phone }) {
  try {
    await requireAdmin();
  } catch (err) {
    return { error: err.message };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: cleanProfile(fullName, phone) });
  if (error) return { error: error.message };

  revalidatePath('/admin', 'layout');
  return { success: true };
}

// Removing a firm's login also unlinks it from the firm (firm_users cascades). Their listings stay.
export async function deleteEmployee(userId) {
  let me;
  try {
    me = await requireAdmin();
  } catch (err) {
    return { error: err.message };
  }
  if (me.id === userId) return { error: 'You cannot remove your own login.' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath('/admin', 'layout');
  return { success: true };
}

// Logins can't reset their own password; the platform admin sets a new one and passes it on.
export async function setEmployeePassword(userId, password) {
  try {
    await requireAdmin();
  } catch (err) {
    return { error: err.message };
  }
  if (typeof password !== 'string' || password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { success: true };
}
