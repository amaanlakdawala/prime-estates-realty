'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addClient, addClientNote, saveRequirement, updateClientStage } from '../actions';
import { STAGES } from '../format';

function useAction() {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();
  const act = (fn, ok) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setMessage({ error: true, text: r.error });
      else { setMessage(ok ? { text: typeof ok === 'function' ? ok(r) : ok } : null); router.refresh(); }
    });
  };
  const note = message && <p className={`text-sm ${message.error ? 'text-red-700' : 'text-brand-dark'}`} role="status">{message.text}</p>;
  return { act, pending, note, router };
}

// Clients page: a new client in three fields; what they want is read into the requirement.
export function AddClientForm() {
  const { act, pending, note, router } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn-primary" onClick={() => setOpen(true)}>Add client</button>;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); act(() => addClient(data), (r) => { router.push(`/admin/clients/${r.id}`); return 'Added.'; }); }}
      className="grid w-full gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2"
    >
      <label className="block"><span className="field-label">Name</span><input name="name" className="field" placeholder="Rahul Mehta" /></label>
      <label className="block"><span className="field-label">Mobile</span><input name="phone" type="tel" className="field" required placeholder="98200 12345" /></label>
      <label className="block sm:col-span-2">
        <span className="field-label">What they want</span>
        <input name="wants" className="field" placeholder="2 BHK on rent in Powai or Andheri, budget 60k, from January" />
        <span className="mt-1 block text-sm text-muted">Written as they said it. Deal, BHK, budget and areas are picked out; you can correct them after.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add client'}</button>
        <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
        {note}
      </div>
    </form>
  );
}

// Client page: stage buttons and the next follow-up date.
export function StageControl({ clientId, stage, followUp }) {
  const { act, pending, note } = useAction();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button key={s.value} type="button" disabled={pending || s.value === stage} onClick={() => act(() => updateClientStage(clientId, { stage: s.value }))}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${s.value === stage ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:border-brand'}`}>
            {s.label}
          </button>
        ))}
      </div>
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Next follow-up</span>
        <input type="date" defaultValue={followUp ?? ''} className="field w-auto py-1.5" disabled={pending}
          onChange={(e) => act(() => updateClientStage(clientId, { followUp: e.target.value }), 'Saved.')} />
      </label>
      {note}
    </div>
  );
}

// Client page: the requirement as fields. Budgets take "1.5 cr", "85 lakh", "60k".
export function RequirementForm({ client }) {
  const { act, pending, note } = useAction();
  const lakh = (v) => (v ? (v >= 1e7 ? `${+(v / 1e7).toFixed(2)} cr` : v >= 1e5 ? `${+(v / 1e5).toFixed(2)} lakh` : `${v}`) : '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); act(() => saveRequirement(client.id, data), (r) => `Saved. ${r.added ? `${r.added} new matching listing${r.added === 1 ? '' : 's'}.` : 'Matches updated.'}`); }}
      className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="field-label">Buy or rent</span>
        <select name="deal" defaultValue={client.req_deal} className="field"><option value="">Not known</option><option value="buy">Buy</option><option value="rent">Rent</option></select></label>
      <label className="block"><span className="field-label">Property type</span>
        <select name="type" defaultValue={client.req_type} className="field"><option value="">Any</option><option value="flat">Flat</option><option value="villa">Villa / bungalow</option><option value="office">Office</option><option value="shop">Shop</option><option value="plot">Plot</option></select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="field-label">BHK from</span><input name="bhk_min" type="number" min="1" max="10" defaultValue={client.req_bhk_min ?? ''} className="field" /></label>
        <label className="block"><span className="field-label">to</span><input name="bhk_max" type="number" min="1" max="10" defaultValue={client.req_bhk_max ?? ''} className="field" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="field-label">Budget from</span><input name="budget_min" defaultValue={lakh(client.req_budget_min)} className="field" placeholder="optional" /></label>
        <label className="block"><span className="field-label">up to</span><input name="budget_max" defaultValue={lakh(client.req_budget_max)} className="field" placeholder={client.req_deal === 'rent' ? '60k' : '1.5 cr'} /></label>
      </div>
      <label className="block sm:col-span-2"><span className="field-label">Areas</span>
        <input name="areas" defaultValue={(client.req_areas ?? []).join(', ')} className="field" placeholder="Powai, Andheri West, Western suburbs" />
        <span className="mt-1 block text-sm text-muted">Separate with commas. Listings in nearby areas (within 8 km) match too.</span></label>
      <label className="block sm:col-span-2"><span className="field-label">Other wishes</span>
        <input name="req_notes" defaultValue={client.req_notes} className="field" placeholder="Furnished, high floor, moving in January" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save and find matches'}</button>
        {note}
      </div>
    </form>
  );
}

export function NoteForm({ clientId }) {
  const { act, pending, note } = useAction();
  const [text, setText] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); act(() => addClientNote(clientId, text), () => { setText(''); return 'Added.'; }); }} className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="field" placeholder="Spoke to him, wants to see Saturday after 4" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-outline py-1.5 text-sm" disabled={pending || !text.trim()}>Add note</button>
        {note}
      </div>
    </form>
  );
}
