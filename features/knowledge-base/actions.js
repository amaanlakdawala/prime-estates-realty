'use server';

import { revalidatePath } from 'next/cache';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { forgetKnowledge } from './lookup';

// Written with the secret key, so every action checks permission itself first.
async function requirePlatformAdmin() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) throw new Error('Only the platform admin can do this.');
}

const text = (formData, key, max = 200) => (formData.get(key) ?? '').toString().trim().slice(0, max);
const list = (formData, key) => text(formData, key, 1000).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
// "45000", "45,000" or "45k" -> 45000; empty -> null.
const rate = (formData, key) => {
  const raw = text(formData, key, 20).toLowerCase().replace(/[,\s₹]/g, '');
  if (!raw) return null;
  const n = raw.endsWith('k') ? Number(raw.slice(0, -1)) * 1000 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : NaN;
};

function done() {
  forgetKnowledge();
  revalidatePath('/admin/knowledge');
}

// Creates a tower (no id) or updates one.
export async function saveProject(id, formData) {
  try { await requirePlatformAdmin(); } catch (err) { return { error: err.message }; }
  const fields = {
    name: text(formData, 'name', 120),
    aliases: list(formData, 'aliases'),
    area: text(formData, 'area', 80),
    developer: text(formData, 'developer', 80) || null,
    configurations: text(formData, 'configurations', 80) || null,
    price_min_psf: rate(formData, 'price_min_psf'),
    price_max_psf: rate(formData, 'price_max_psf'),
    price_verified: formData.get('price_verified') === 'on',
    notes: text(formData, 'notes', 500) || null,
    updated_at: new Date().toISOString(),
  };
  if (!fields.name) return { error: 'Enter the tower or project name.' };
  if (!fields.area) return { error: 'Choose its area.' };
  if (Number.isNaN(fields.price_min_psf) || Number.isNaN(fields.price_max_psf)) return { error: 'Rates must be numbers, e.g. 45000 or 45k.' };
  if (fields.price_min_psf && fields.price_max_psf && fields.price_min_psf > fields.price_max_psf) return { error: 'The low rate is above the high rate.' };
  if (fields.price_verified && !fields.price_min_psf) return { error: 'Enter a rate before ticking “Price checked”.' };

  const db = createAdminClient();
  const { error } = id ? await db.from('kb_projects').update(fields).eq('id', id) : await db.from('kb_projects').insert(fields);
  if (error) return { error: error.code === '23505' ? `“${fields.name}” is already in the list.` : error.message };
  done();
  return { ok: true };
}

export async function deleteProject(id) {
  try { await requirePlatformAdmin(); } catch (err) { return { error: err.message }; }
  const { error } = await createAdminClient().from('kb_projects').delete().eq('id', id);
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

// Adds an area. Its map position comes from Google Maps: right-click the place, click the numbers to copy them.
export async function addArea(formData) {
  try { await requirePlatformAdmin(); } catch (err) { return { error: err.message }; }
  const [lat, lng] = text(formData, 'position', 60).split(',').map((s) => Number(s.trim()));
  const fields = { name: text(formData, 'name', 80), zone: text(formData, 'zone', 40), lat, lng, aliases: list(formData, 'aliases') };
  if (!fields.name || !fields.zone) return { error: 'Enter the area name and choose its region.' };
  if (!(lat > 18 && lat < 20 && lng > 72 && lng < 74)) return { error: 'Paste the map position as two numbers, e.g. 19.1360, 72.8296 (Mumbai region).' };
  const { error } = await createAdminClient().from('kb_areas').insert(fields);
  if (error) return { error: error.code === '23505' ? `“${fields.name}” is already in the list.` : error.message };
  done();
  return { ok: true };
}
