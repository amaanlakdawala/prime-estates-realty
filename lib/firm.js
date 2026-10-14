import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { toSite } from '@/lib/site';

// The firm whose public website is at /<slug>, or null if there is no active firm with a live website there.
// cache(): the layout and the page both ask for it on every request; this fetches it once.
export const getSiteBySlug = cache(async (slug) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug ?? '')) return null;
  const { data } = await createPublicClient().from('firms').select('*').eq('slug', slug).eq('active', true).eq('website_enabled', true).maybeSingle();
  return data ? toSite(data) : null;
});

// For firm pages: the site, or the "not found" page. Pages render alongside the layout, so each
// one must check for itself rather than rely on the layout's check.
export async function requireSite(params) {
  const site = await getSiteBySlug((await params).firm);
  if (!site) notFound();
  return site;
}
