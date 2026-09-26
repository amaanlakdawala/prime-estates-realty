'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} className="rounded-md border border-white/25 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
      Sign out
    </button>
  );
}
