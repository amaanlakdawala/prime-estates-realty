import { createAdminClient } from '@/lib/supabase/admin';
import { readLeadEmail } from './parse';

// A lead email (forwarded by the firm, or pasted) becomes an enquiry. The enquiry trigger
// (supabase/05_auto_call.sql) then queues the firm's automatic AI call, about a minute later.

const DUPLICATE_HOURS = 24; // portals often send the same lead twice, or to several brokers at once

export const portalSource = (portal) => `portal:${portal || 'Property portal'}`;

// Portal emails are often HTML only.
export function htmlToText(html = '') {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t') // table cells: "Buyer Name<tab>Rahul Mehta"
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/ +/g, ' ')
    .replace(/ *\t[ \t]*/g, '\t')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

// firm: a firms row. email: { sender, subject, text }. Returns the portal_emails row as saved.
export async function saveLeadEmail(firm, { sender = '', subject = '', text = '' }) {
  const db = createAdminClient();
  const { data: row, error } = await db.from('portal_emails').insert({
    firm_id: firm.id, sender: sender.slice(0, 200), subject: subject.slice(0, 300), body: text.slice(0, 6000),
  }).select('*').single();
  if (error) throw new Error(error.message);
  const finish = async (fields) => (await db.from('portal_emails').update(fields).eq('id', row.id).select('*').single()).data ?? { ...row, ...fields };

  try {
    const read = await readLeadEmail({ sender, subject, text });
    if (!read.lead) {
      return finish({ status: 'not_a_lead', portal: read.portal, note: read.gmailConfirm ? `${read.note} ${read.gmailConfirm}` : read.note });
    }
    const { lead } = read;
    const { data: earlier } = await db.from('enquiries').select('id').eq('firm_id', firm.id).eq('phone', lead.phone)
      .gte('created_at', new Date(Date.now() - DUPLICATE_HOURS * 3600e3).toISOString()).limit(1);
    if (earlier?.length) {
      return finish({ status: 'duplicate', portal: lead.portal, enquiry_id: earlier[0].id, note: `${lead.name}, ${lead.phone}: already an enquiry from the last ${DUPLICATE_HOURS} hours.` });
    }
    const { data: enquiry, error: enqError } = await db.from('enquiries').insert({
      firm_id: firm.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      message: `Enquired on ${lead.portal || 'a property portal'}${lead.requirement ? `: ${lead.requirement}` : '.'}`.slice(0, 2000),
      source: portalSource(lead.portal),
    }).select('id').single();
    if (enqError) throw new Error(enqError.message);
    return finish({ status: 'lead', portal: lead.portal, enquiry_id: enquiry.id, note: `${lead.name}, ${lead.phone}${lead.requirement ? `: ${lead.requirement}` : ''}`.slice(0, 500) });
  } catch (err) {
    console.error('Portal lead not saved:', err.message);
    return finish({ status: 'failed', note: err.message.slice(0, 300) });
  }
}
