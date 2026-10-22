import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toSite } from '@/lib/site';

// Two kinds of login:
//  - Platform admin (you): app_metadata.role = 'admin'. Manages every firm and every login.
//    Set only with the secret key (Logins page, set-admin script), so nobody can grant it to themselves.
//  - Firm login: app_metadata.role = 'firm' plus a row in firm_users. Sees and changes only its firm.
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function isAdmin(user) {
  return user?.app_metadata?.role === 'admin';
}

// Which firm the platform admin is currently working on in the admin panel (chosen on the Firms page).
export const MANAGE_FIRM_COOKIE = 'manage_firm';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Row ids are UUIDs: anything else from a form, cookie or address is refused before it reaches the database.
export const isUuid = (value) => UUID.test(value ?? '');

// Everything an admin page needs to know about who is signed in, once per request.
// firm: the firm being worked on (always the login's own firm for a firm login), or null.
export const getAdminContext = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const platformAdmin = isAdmin(user);
  const db = createAdminClient();

  let firmId = null;
  if (platformAdmin) {
    const chosen = (await cookies()).get(MANAGE_FIRM_COOKIE)?.value;
    firmId = chosen && UUID.test(chosen) ? chosen : null;
  } else {
    const { data } = await db.from('firm_users').select('firm_id').eq('user_id', user.id).maybeSingle();
    firmId = data?.firm_id ?? null;
  }

  let firm = null;
  if (firmId) {
    const { data } = await db.from('firms').select('*').eq('id', firmId).maybeSingle();
    firm = data ? toSite(data) : null;
  }

  return { user, isPlatformAdmin: platformAdmin, firm };
});

// For server actions that write with the secret key on behalf of the platform admin only.
export async function requirePlatformAdmin(message = 'Only the platform admin can do this.') {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) throw new Error(message);
  return ctx;
}

// For pages that work on one firm's listings or enquiries. Returns the context, or null when a
// firm login has no usable firm (the admin layout then explains why). The platform admin without
// a chosen firm is sent to pick one.
export async function requireFirm() {
  const ctx = await getAdminContext();
  if (!ctx) redirect('/login');
  if (!ctx.firm) {
    if (ctx.isPlatformAdmin) redirect('/admin/firms');
    return null;
  }
  if (!ctx.isPlatformAdmin && !ctx.firm.active) return null;
  return ctx;
}
