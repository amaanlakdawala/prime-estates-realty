'use server';

import { revalidatePath } from 'next/cache';
import { requireFirmService, runAction } from '@/features/shared/firm-service';
import { saveLeadEmail } from './leads';

// "Paste a lead": for a lead that came on WhatsApp or SMS from a portal, or to try the service before email
// forwarding is set up. Goes through the same reader as forwarded emails.
export async function pasteLead(text) {
  return runAction(async () => {
    const { firm } = await requireFirmService('portal_leads_enabled', 'Portal leads');
    const body = (text ?? '').toString().trim().slice(0, 6000);
    if (body.length < 15) throw new Error('Paste the whole lead message, with the name and mobile number.');
    const row = await saveLeadEmail(firm, { sender: 'Pasted in the admin panel', subject: '', text: body });
    revalidatePath('/admin/portal-leads');
    revalidatePath('/admin/enquiries');
    return { status: row.status, note: row.note };
  });
}
