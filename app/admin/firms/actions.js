'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminContext, MANAGE_FIRM_COOKIE, requirePlatformAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { RESERVED_SLUGS } from '@/lib/site';
import { revalidateSite } from '@/app/actions/site';

// Firms are written with the secret key, so every action checks permission itself first.

const text = (formData, key, max = 200) => (formData.get(key) ?? '').toString().trim().slice(0, max);

function slugError(slug) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 40) {
    return 'Web address: 2–40 lowercase letters, numbers and single hyphens, e.g. "seabreeze-realtors".';
  }
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is already used by the site. Choose another web address.`;
  return null;
}

// Contact details a firm can edit about itself. Name included: it's how they appear on their site.
function contactFields(formData) {
  const founded = Number(text(formData, 'founded_year', 4));
  return {
    name: text(formData, 'name', 120),
    city: text(formData, 'city', 80),
    phone: text(formData, 'phone', 30),
    whatsapp: text(formData, 'whatsapp', 30),
    email: text(formData, 'email', 120),
    address: text(formData, 'address', 300),
    hours: text(formData, 'hours', 120),
    rera_no: text(formData, 'rera_no', 40),
    founded_year: founded >= 1900 && founded <= 2100 ? founded : null,
    localities: text(formData, 'localities', 1000).split(',').map((l) => l.trim()).filter(Boolean).slice(0, 40),
    logo_url: text(formData, 'logo_url', 500),
    hero_url: text(formData, 'hero_url', 500),
  };
}

export async function createFirm(formData) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    return { error: err.message };
  }
  const slug = text(formData, 'slug', 40).toLowerCase();
  const fields = contactFields(formData);
  if (!fields.name) return { error: 'Enter the firm name.' };
  const badSlug = slugError(slug);
  if (badSlug) return { error: badSlug };

  const { data, error } = await createAdminClient().from('firms').insert({ ...fields, slug }).select('id').single();
  if (error) return { error: error.code === '23505' ? `The web address "${slug}" is taken. Choose another.` : error.message };

  revalidatePath('/admin/firms');
  redirect(`/admin/firms/${data.id}`);
}

// The platform admin can change everything; a firm login only its own contact details.
export async function updateFirm(firmId, formData) {
  const ctx = await getAdminContext();
  const ownFirm = ctx?.firm?.id === firmId && ctx.firm.active;
  if (!ctx || (!ctx.isPlatformAdmin && !ownFirm)) return { error: 'You can only edit your own firm.' };

  const fields = contactFields(formData);
  if (!fields.name) return { error: 'Enter the firm name.' };

  if (ctx.isPlatformAdmin) {
    const slug = text(formData, 'slug', 40).toLowerCase();
    const badSlug = slugError(slug);
    if (badSlug) return { error: badSlug };
    fields.slug = slug;
    fields.demo_content = formData.get('demo_content') === 'on';
    fields.website_enabled = formData.get('website_enabled') === 'on';
    // AI calling costs the platform owner money, so only the platform admin switches it on and sets the cap.
    fields.ai_calls_enabled = formData.get('ai_calls_enabled') === 'on';
    fields.ai_calls_monthly_limit = Math.min(Math.max(Number.parseInt(text(formData, 'ai_calls_monthly_limit', 6), 10) || 0, 0), 100000);
    const voice = text(formData, 'voice_agent', 10);
    fields.voice_agent = ['simran', 'sarvam'].includes(voice) ? voice : 'sia';
  }

  const db = createAdminClient();
  const { data: before } = await db.from('firms').select('slug').eq('id', firmId).maybeSingle();
  const { error } = await db.from('firms').update(fields).eq('id', firmId);
  if (error) return { error: error.code === '23505' ? 'That web address is taken. Choose another.' : error.message };

  revalidatePath('/admin', 'layout');
  await revalidateSite(before?.slug);
  if (fields.slug && fields.slug !== before?.slug) await revalidateSite(fields.slug);
  return { success: true };
}

export async function setFirmActive(firmId, active) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    return { error: err.message };
  }
  const { data: firm, error } = await createAdminClient().from('firms').update({ active: Boolean(active) }).eq('id', firmId).select('slug').maybeSingle();
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  await revalidateSite(firm?.slug);
  return { success: true };
}

// A login for the firm: role 'firm' (never admin) and linked in firm_users.
export async function createFirmLogin(firmId, formData) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    return { error: err.message };
  }
  const email = text(formData, 'email', 200).toLowerCase();
  const password = (formData.get('password') ?? '').toString();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const db = createAdminClient();
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'firm' },
    user_metadata: { full_name: text(formData, 'full_name', 120), phone: text(formData, 'phone', 30) },
  });
  if (error) return { error: error.message };

  const { error: linkError } = await db.from('firm_users').insert({ user_id: created.user.id, firm_id: firmId });
  if (linkError) {
    await db.auth.admin.deleteUser(created.user.id); // don't leave a login that belongs to no firm
    return { error: linkError.message };
  }

  revalidatePath(`/admin/firms/${firmId}`);
  return { success: true };
}

// Platform admin: work on this firm's listings and enquiries in the admin panel.
export async function manageFirm(firmId) {
  await requirePlatformAdmin();
  (await cookies()).set(MANAGE_FIRM_COOKIE, firmId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  redirect('/admin');
}

export async function stopManagingFirm() {
  (await cookies()).delete(MANAGE_FIRM_COOKIE);
  redirect('/admin/firms');
}
