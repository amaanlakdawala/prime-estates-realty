'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addArea, deleteProject, saveProject } from '@/features/knowledge-base/actions';

const ZONES = ['South Mumbai', 'Central Mumbai', 'Western suburbs', 'Eastern suburbs', 'Thane', 'Navi Mumbai', 'Mira-Bhayandar'];
const k = (n) => (n ? `₹${Math.round(n / 1000)}k` : '');
const rateText = (p) => (p.price_min_psf ? `${k(p.price_min_psf)}${p.price_max_psf && p.price_max_psf !== p.price_min_psf ? `–${k(p.price_max_psf)}` : ''} / sq ft` : '—');

function ProjectForm({ project, areas, onDone }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  // onSubmit, not a form action: an action resets the fields, wiping what was typed when the save fails.
  const submit = (formData) => startTransition(async () => {
    const result = await saveProject(project?.id ?? null, formData);
    if (result?.error) return setError(result.error);
    router.refresh();
    onDone();
  });
  const remove = () => {
    if (!window.confirm(`Remove ${project.name} from the list?`)) return;
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result?.error) return setError(result.error);
      router.refresh();
      onDone();
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }} className="grid gap-3 rounded-lg border border-line bg-mist/60 p-4 sm:grid-cols-2">
      <label className="block"><span className="field-label">Tower or project</span>
        <input name="name" className="field" defaultValue={project?.name} required placeholder="Lodha Park" /></label>
      <label className="block"><span className="field-label">Area</span>
        <select name="area" className="field" defaultValue={project?.area ?? ''} required>
          <option value="" disabled>Choose…</option>
          {areas.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select></label>
      <label className="block sm:col-span-2"><span className="field-label">Other names callers use (comma separated)</span>
        <input name="aliases" className="field" defaultValue={project?.aliases?.join(', ')} placeholder="Lodha The Park, Lodha World Park" /></label>
      <label className="block"><span className="field-label">Developer</span>
        <input name="developer" className="field" defaultValue={project?.developer ?? ''} placeholder="Lodha" /></label>
      <label className="block"><span className="field-label">Flat sizes</span>
        <input name="configurations" className="field" defaultValue={project?.configurations ?? ''} placeholder="2, 3 and 4 BHK" /></label>
      <label className="block"><span className="field-label">Rate from (₹ per sq ft)</span>
        <input name="price_min_psf" className="field" inputMode="numeric" defaultValue={project?.price_min_psf ?? ''} placeholder="45000" /></label>
      <label className="block"><span className="field-label">Rate up to (₹ per sq ft)</span>
        <input name="price_max_psf" className="field" inputMode="numeric" defaultValue={project?.price_max_psf ?? ''} placeholder="60000" /></label>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="price_verified" defaultChecked={project?.price_verified} className="mt-0.5" />
        <span><span className="font-medium">Price checked</span> — Riya quotes this rate on calls (always as approximate). Leave unticked and she gives only the location.</span>
      </label>
      <label className="block sm:col-span-2"><span className="field-label">Notes (for you; Riya doesn&apos;t read these)</span>
        <input name="notes" className="field" defaultValue={project?.notes ?? ''} /></label>
      {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : project ? 'Save' : 'Add tower'}</button>
        <button type="button" className="btn-outline" onClick={onDone} disabled={pending}>Cancel</button>
        {project && <button type="button" onClick={remove} disabled={pending} className="ml-auto text-sm text-red-700 underline">Remove</button>}
      </div>
    </form>
  );
}

function AreaForm({ onDone }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const submit = (formData) => startTransition(async () => {
    const result = await addArea(formData);
    if (result?.error) return setError(result.error);
    router.refresh();
    onDone();
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }} className="mt-4 grid gap-3 rounded-lg border border-line bg-mist/60 p-4 sm:grid-cols-2">
      <label className="block"><span className="field-label">Area name</span><input name="name" className="field" required placeholder="Chandivali" /></label>
      <label className="block"><span className="field-label">Region</span>
        <select name="zone" className="field" defaultValue="" required>
          <option value="" disabled>Choose…</option>
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select></label>
      <label className="block"><span className="field-label">Map position</span>
        <input name="position" className="field" required placeholder="19.1100, 72.9000" />
        <span className="mt-1 block text-xs text-muted">In Google Maps, right-click the middle of the area and click the numbers at the top to copy them.</span></label>
      <label className="block"><span className="field-label">Other names (comma separated)</span><input name="aliases" className="field" /></label>
      {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add area'}</button>
        <button type="button" className="btn-outline" onClick={onDone} disabled={pending}>Cancel</button>
      </div>
    </form>
  );
}

export default function KnowledgeAdmin({ projects, areas }) {
  const [query, setQuery] = useState('');
  const [uncheckedOnly, setUncheckedOnly] = useState(false);
  const [editing, setEditing] = useState(null); // project id, 'new', or null
  const [addingArea, setAddingArea] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => (!uncheckedOnly || !p.price_verified)
      && (!q || [p.name, p.area, p.developer, ...(p.aliases ?? [])].some((s) => s?.toLowerCase().includes(q))));
  }, [projects, query, uncheckedOnly]);
  const unchecked = projects.filter((p) => !p.price_verified).length;
  const byZone = ZONES.map((z) => [z, areas.filter((a) => a.zone === z)]).filter(([, list]) => list.length);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Towers and projects <span className="font-normal text-muted">({projects.length})</span></h2>
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>Add tower</button>
        </div>
        <p className="mt-1 text-sm text-muted">{unchecked} of {projects.length} rates are not checked yet. Riya gives only the location for those.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <input type="search" className="field max-w-xs" placeholder="Search tower, area or developer" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search towers" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={uncheckedOnly} onChange={(e) => setUncheckedOnly(e.target.checked)} /> Rate not checked only</label>
        </div>
        {editing === 'new' && <div className="mt-4"><ProjectForm areas={areas} onDone={() => setEditing(null)} /></div>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-mist text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Tower</th>
                <th scope="col" className="px-4 py-3 font-medium">Area</th>
                <th scope="col" className="px-4 py-3 font-medium">Developer · sizes</th>
                <th scope="col" className="px-4 py-3 font-medium">Approx. rate</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((p) => (editing === p.id ? (
                <tr key={p.id}><td colSpan={5} className="p-3"><ProjectForm project={p} areas={areas} onDone={() => setEditing(null)} /></td></tr>
              ) : (
                <tr key={p.id} className="hover:bg-mist/60">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{p.name}</span>
                    {p.aliases?.length > 0 && <span className="block text-xs text-muted">also: {p.aliases.join(', ')}</span>}
                  </td>
                  <td className="px-4 py-3">{p.area}</td>
                  <td className="px-4 py-3 text-muted">{[p.developer, p.configurations].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3">
                    {rateText(p)}
                    {p.price_min_psf > 0 && (p.price_verified
                      ? <span className="ml-2 rounded bg-brand-light px-1.5 py-0.5 text-xs font-semibold text-brand-dark">Checked</span>
                      : <span className="ml-2 rounded bg-accent/30 px-1.5 py-0.5 text-xs font-semibold">Not checked</span>)}
                  </td>
                  <td className="px-4 py-3 text-right"><button type="button" className="font-medium text-brand underline" onClick={() => setEditing(p.id)}>Edit</button></td>
                </tr>
              )))}
              {!shown.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No towers match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Areas <span className="font-normal text-muted">({areas.length})</span></h2>
          {!addingArea && <button type="button" className="btn-outline" onClick={() => setAddingArea(true)}>Add area</button>}
        </div>
        <p className="mt-1 text-sm text-muted">Each area&apos;s map position tells Riya which areas are near each other, so she suggests close alternatives and says honestly when one is far.</p>
        {addingArea && <AreaForm onDone={() => setAddingArea(false)} />}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {byZone.map(([zone, list]) => (
            <div key={zone}>
              <dt className="text-sm font-semibold">{zone}</dt>
              <dd className="mt-1 text-sm text-muted">{list.map((a) => a.name).join(', ')}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
