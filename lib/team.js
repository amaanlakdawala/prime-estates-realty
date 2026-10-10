// Turns a Supabase auth user into the fields the Team pages show.
export function toEmployee(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || '',
    phone: u.user_metadata?.phone || '',
    role: u.app_metadata?.role === 'admin' ? 'admin' : 'staff',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  };
}
