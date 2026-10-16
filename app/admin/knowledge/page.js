// Thin route: the knowledge base lives in features/knowledge-base/.
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import KnowledgeAdmin from '@/features/knowledge-base/admin/KnowledgeAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Towers & areas' };

export default async function KnowledgePage() {
  const ctx = await getAdminContext();
  if (!ctx?.isPlatformAdmin) redirect('/admin');

  const db = createAdminClient();
  const [{ data: projects, error }, { data: areas }] = await Promise.all([
    db.from('kb_projects').select('*').order('name'),
    db.from('kb_areas').select('name, zone').order('name'),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Towers &amp; areas</h1>
      <p className="mt-1 text-muted">What Riya knows about Mumbai on every firm&apos;s calls: which area each tower is in, its approximate rate, and which areas are close to each other.</p>
      {error
        ? <p className="mt-4 text-sm text-red-700" role="alert">The list could not be loaded: {error.message}</p>
        : <div className="mt-6"><KnowledgeAdmin projects={projects ?? []} areas={areas ?? []} /></div>}
    </div>
  );
}
