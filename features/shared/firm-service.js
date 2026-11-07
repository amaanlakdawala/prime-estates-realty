import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// For server actions of the paid add-on services (portal leads, listing checks, WhatsApp AI): the firm this login
// works on, as a full firms row, only when the platform admin has switched that service on for it.
// column: the firm's switch, e.g. 'portal_leads_enabled'.
export async function requireFirmService(column, name) {
  const ctx = await getAdminContext();
  if (!ctx?.firm) throw new Error('Choose a firm first.');
  if (!ctx.isPlatformAdmin && !ctx.firm.active) throw new Error('Your account is paused.');
  const { data: firm } = await createAdminClient().from('firms').select('*').eq('id', ctx.firm.id).single();
  if (!firm?.[column]) throw new Error(`${name} is not switched on for this firm.${ctx.isPlatformAdmin ? ' Switch it on under Firms → this firm.' : ' Contact us to switch it on.'}`);
  return { ctx, firm };
}

export const runAction = (fn) => fn().catch((err) => ({ error: err.message }));
