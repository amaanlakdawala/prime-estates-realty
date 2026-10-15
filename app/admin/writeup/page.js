// Thin route: the feature lives in features/whatsapp-writeup.
import { requireFirm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import WriteupMaker from '@/features/whatsapp-writeup/admin/WriteupMaker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'WhatsApp write-up' };

export default async function WriteupPage({ searchParams }) {
  const ctx = await requireFirm();
  if (!ctx) return null;
  const { listing } = await searchParams;
  const supabase = await createClient();
  const { data: listings } = await supabase.from('listings')
    .select('id, title, locality, price, deal_type, property_type, bhk, area_sqft, floor, amenities, description, rera_number, show_on_website')
    .eq('firm_id', ctx.firm.id).eq('status', 'available').order('created_at', { ascending: false });
  const preselect = typeof listing === 'string' && (listings ?? []).some((l) => l.id === listing) ? [listing] : [];
  const meta = ctx.user.user_metadata ?? {};

  return (
    <>
      <h1 className="text-3xl font-semibold">WhatsApp write-up</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Turn listings, or any messy property message, into a neat WhatsApp post with your number under every property,
        ready to send to your broker and client groups.
      </p>
      <WriteupMaker
        listings={listings ?? []}
        site={ctx.firm}
        me={{ name: meta.full_name ?? '', phone: meta.phone ?? '' }}
        preselect={preselect}
        aiReady={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </>
  );
}
