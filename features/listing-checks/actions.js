'use server';

import { revalidatePath } from 'next/cache';
import { isUuid } from '@/lib/auth';
import { requireFirmService, runAction } from '@/features/shared/firm-service';
import { checkListingNow } from './checks';

// "Check now" on the Listing checks page.
export async function checkNow(listingId) {
  return runAction(async () => {
    const { firm } = await requireFirmService('listing_checks_enabled', 'Listing checks');
    if (!isUuid(listingId)) throw new Error('Unknown listing.');
    await checkListingNow(firm, listingId);
    revalidatePath('/admin/listing-checks');
    return { success: true };
  });
}
