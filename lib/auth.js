import { createClient } from '@/lib/supabase/server';

// The "admin" role is stored in app_metadata, which only a service-role
// request can set - unlike user_metadata, an employee can never grant it to
// themselves. The first admin is set once by hand in Supabase (see README).
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function isAdmin(user) {
  return user?.app_metadata?.role === 'admin';
}
