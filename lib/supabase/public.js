import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Supabase client for the public firm websites, on the server. Deliberately ignores any login
// cookie, so pages always see exactly what a visitor sees, even when someone signed in to the
// admin panel is browsing another firm's site.
export function createPublicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
