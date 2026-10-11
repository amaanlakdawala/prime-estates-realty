'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteContact, markDoNotCall, refreshCalls, startCall } from '@/app/admin/calls/actions';

export const CONTACT_STATUS = {
  new: ['Not called', 'bg-stone'],
  calling: ['Calling…', 'bg-marigold/40'],
  called: ['Called', 'bg-teal-light text-teal-dark'],
  no_answer: ['No answer', 'bg-basalt/10 text-muted'],
  failed: ['Call failed', 'bg-red-100 text-red-800'],
  do_not_call: ['Do not call', 'bg-red-100 text-red-800'],
};
const SOURCE = { manual: 'Added', upload: 'Uploaded', website: 'Website' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Contacts, with "Call" per person and "Call selected", which calls one person at a time:
// the next call starts only after the previous one has ended.
export default function ContactsTable({ contacts, canCall }) {
  const router = useRouter();
  const [filter, setFilter] = useState('new');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(null); // contact id with a call or action running
  const [queue, setQueue] = useState(null); // { done, total, current } while calling a list
  const [notice, setNotice] = useState(null);
  const stopRef = useRef(false);

  const shown = useMemo(() => contacts.filter((c) => filter === 'all' || c.status === filter || (filter === 'retry' && ['no_answer', 'failed'].includes(c.status))), [contacts, filter]);
  const callable = (c) => !['do_not_call', 'calling'].includes(c.status);

  // Places one call and waits (checking every 5 s, up to 10 min) until it has ended.
  async function callAndWait(contact) {
    setBusy(contact.id);
    const res = await startCall(contact.id);
    if (res?.error) { setBusy(null); return res.error; }
    for (let i = 0; i < 120 && !stopRef.current; i++) {
      await sleep(5000);
      const r = await refreshCalls([res.callId]);
      const status = r?.calls?.[0]?.status;
      if (status && !['queued', 'in_progress'].includes(status)) break;
    }
    setBusy(null);
    return null;
  }

  async function callOne(contact) {
    setNotice(null);
    stopRef.current = false;
    const error = await callAndWait(contact);
    setNotice(error ? { error: true, text: error } : { text: `Call to ${contact.name || contact.phone} finished. The result is under Recent calls.` });
    router.refresh();
  }

  async function callSelected() {
    const list = contacts.filter((c) => selected.has(c.id) && callable(c));
    if (!list.length) return;
    setNotice(null);
    stopRef.current = false;
    for (let i = 0; i < list.length && !stopRef.current; i++) {
      setQueue({ done: i, total: list.length, current: list[i].name || list[i].phone });
      const error = await callAndWait(list[i]);
      if (error) {
        setNotice({ error: true, text: `Stopped at ${list[i].name || list[i].phone}: ${error}` });
        break;
      }
      await sleep(3000); // a short gap between calls
    }
    setQueue(null);
    setSelected(new Set());
    router.refresh();
  }

  async function act(fn, contact, label) {
    setBusy(contact.id);
    const res = await fn(contact.id);
    setBusy(null);
    setNotice(res?.error ? { error: true, text: res.error } : { text: label });
    router.refresh();
  }

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = shown.length > 0 && shown.filter(callable).every((c) => selected.has(c.id));
  const counts = Object.fromEntries(Object.keys(CONTACT_STATUS).map((k) => [k, contacts.filter((c) => c.status === k).length]));

  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Your call list <span className="font-normal text-muted">({contacts.length})</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto py-2" value={filter} onChange={(e) => { setFilter(e.target.value); setSelected(new Set()); }}>
            <option value="new">Not called yet ({counts.new})</option>
            <option value="retry">No answer / failed ({counts.no_answer + counts.failed})</option>
            <option value="called">Called ({counts.called})</option>
            <option value="do_not_call">Do not call ({counts.do_not_call})</option>
            <option value="all">All ({contacts.length})</option>
          </select>
          {queue ? (
            <button type="button" className="btn-outline" onClick={() => { stopRef.current = true; }}>Stop after this call</button>
          ) : (
            <button type="button" className="btn-primary" onClick={callSelected} disabled={!canCall || !selected.size || !!busy}>
              Call selected ({selected.size})
            </button>
          )}
        </div>
      </div>

      {queue && (
        <p className="mt-3 rounded-lg bg-marigold/15 px-4 py-2.5 text-sm" role="status">
          Calling {queue.current} ({queue.done + 1} of {queue.total})… The next call starts when this one ends.
        </p>
      )}
      {notice && <p className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${notice.error ? 'bg-red-50 text-red-800' : 'bg-teal-light text-teal-dark'}`} role="status">{notice.text}</p>}

      {!shown.length ? (
        <p className="mt-4 text-sm text-muted">{contacts.length ? 'Nobody in this view.' : 'No contacts yet. Add a client or upload a list above.'}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-stone text-muted">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-teal" checked={allShownSelected} disabled={!!queue}
                    onChange={(e) => setSelected(e.target.checked ? new Set(shown.filter(callable).map((c) => c.id)) : new Set())} />
                </th>
                <th scope="col" className="px-4 py-3 font-medium">Client</th>
                <th scope="col" className="px-4 py-3 font-medium">Why / looking for</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.slice(0, 300).map((c) => {
                const [label, style] = CONTACT_STATUS[c.status] ?? [c.status, 'bg-stone'];
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${c.name || c.phone}`} className="h-4 w-4 accent-teal" checked={selected.has(c.id)} disabled={!callable(c) || !!queue} onChange={() => toggle(c.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.name || '—'}</p>
                      <p className="text-muted">{c.phone} · {SOURCE[c.source]}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted">
                      {c.context && <p>{c.context}</p>}
                      {c.notes && <p>{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{busy === c.id && queue ? 'Calling…' : label}</span>
                      {c.call_count > 0 && <span className="ml-2 text-xs text-muted">{c.call_count}×</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-basalt disabled:opacity-50"
                          disabled={!canCall || !callable(c) || !!busy || !!queue} onClick={() => callOne(c)}>
                          {busy === c.id ? 'Calling…' : 'Call'}
                        </button>
                        {c.status !== 'do_not_call' && (
                          <button type="button" className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-basalt disabled:opacity-50"
                            disabled={!!busy || !!queue} onClick={() => act(markDoNotCall, c, `${c.name || c.phone} won't be called again.`)}>Do not call</button>
                        )}
                        <button type="button" className="rounded-md border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:border-red-700 disabled:opacity-50"
                          disabled={!!busy || !!queue} onClick={() => act(deleteContact, c, 'Contact removed.')}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length > 300 && <p className="px-4 py-3 text-sm text-muted">Showing the first 300. Use the filter to narrow the list.</p>}
        </div>
      )}
    </section>
  );
}
