// Creates an admin login, or resets the password of an existing one, without needing email.
// Use it when you are locked out of the admin panel.
//
//   npm run set-admin -- someone@example.com 'NewPassword123'
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local'));

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: npm run set-admin -- <email> '<password>'");
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match || data.users.length < 200) return match ?? null;
  }
}

const normalized = email.trim().toLowerCase();
const existing = await findUserByEmail(normalized);

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    app_metadata: { ...existing.app_metadata, role: 'admin' },
  });
  if (error) throw error;
  console.log(`Updated ${normalized}: new password set and admin access confirmed.`);
} else {
  const { error } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  });
  if (error) throw error;
  console.log(`Created admin login ${normalized}.`);
}
