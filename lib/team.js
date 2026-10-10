// Turns a Supabase auth user into the fields the Logins pages show.
// firmsByUser: { [userId]: { id, name } } from firm_users, for showing which firm a login belongs to.
export function toEmployee(u, firmsByUser = {}) {
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || '',
    phone: u.user_metadata?.phone || '',
    role: u.app_metadata?.role === 'admin' ? 'admin' : 'firm',
    firm: firmsByUser[u.id] ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  };
}

// { [userId]: { id, name } } for the given auth users, read with the secret-key client.
export async function firmsByUser(db) {
  const { data } = await db.from('firm_users').select('user_id, firms(id, name)');
  return Object.fromEntries((data ?? []).filter((r) => r.firms).map((r) => [r.user_id, r.firms]));
}
