'use server';

import { revalidatePath } from 'next/cache';
import { isUuid, requirePlatformAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { placeLeadCall } from './calls';

// The "Call with AI" button on a lead's page.
export async function callLeadWithAI(leadId) {
  try {
    await requirePlatformAdmin('Only the platform admin can place AI sales calls.');
    if (!isUuid(leadId)) return { error: 'Lead not found.' };
    await placeLeadCall(leadId);
    revalidatePath(`/admin/leads/${leadId}`);
    revalidatePath('/admin/leads/calls');
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}

// Leads → AI sales calls → Automatic calling.
export async function saveAutoSettings({ enabled, statuses, perDay }) {
  try {
    await requirePlatformAdmin('Only the platform admin can change automatic calling.');
    const allowed = ['contacted', 'new', 'interested', 'demo_sent'];
    const { error } = await createAdminClient().from('sales_caller_settings').upsert({
      id: 1,
      enabled: Boolean(enabled),
      statuses: (statuses ?? []).filter((s) => allowed.includes(s)),
      per_day: Math.min(Math.max(Number.parseInt(perDay, 10) || 1, 1), 30),
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: error.message.includes('sales_caller_settings') ? 'Run supabase/12_sales_caller.sql in Supabase first.' : error.message };
    revalidatePath('/admin/leads/calls');
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
}
