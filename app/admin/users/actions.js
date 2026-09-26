'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error('Only an admin can do this.');
  return user;
}

export async function createEmployee(formData) {
  try {
    await requireAdmin();
  } catch (err) {
    return { error: err.message };
  }

  const email = formData.get('email')?.toString().trim().toLowerCase();
  const password = formData.get('password')?.toString() ?? '';
  const role = formData.get('role')?.toString() === 'admin' ? 'admin' : 'staff';

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: true };
}

export async function deleteEmployee(userId) {
  let me;
  try {
    me = await requireAdmin();
  } catch (err) {
    return { error: err.message };
  }
  if (me.id === userId) return { error: 'You cannot remove your own account.' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: true };
}

export async function setEmployeeRole(userId, role) {
  let me;
  try {
    me = await requireAdmin();
  } catch (err) {
    return { error: err.message };
  }
  if (me.id === userId) return { error: 'You cannot change your own role.' };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role: role === 'admin' ? 'admin' : 'staff' } });
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: true };
}
