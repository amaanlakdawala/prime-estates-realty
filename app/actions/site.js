'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext } from '@/lib/auth';

// Firm websites are cached (see app/[firm]/page.js) so visits don't rebuild the page each time.
// After any change a visitor can see, the firm's cached pages are rebuilt on the next visit.
export async function revalidateSite(slug) {
  if (slug && /^[a-z0-9-]+$/.test(slug)) revalidatePath(`/${slug}`, 'layout');
}

// For the admin's browser-side saves (listing form, listings table): refreshes the firm being managed.
export async function refreshFirmSite() {
  const ctx = await getAdminContext();
  await revalidateSite(ctx?.firm?.slug);
}
