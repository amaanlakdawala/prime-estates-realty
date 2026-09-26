import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Full-access Supabase client using the SECRET service role key.
// Only ever import this inside server code (server actions, route handlers) -
// never in a 'use client' component or anything that ships to the browser.
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local. Add it from Supabase -> Project Settings -> API Keys -> Secret keys.');
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
