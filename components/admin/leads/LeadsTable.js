'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cleanName, LEAD_STATUSES, statusLabel, whatsappNumber } from '@/lib/leads';
import { formatDate } from '@/lib/format';

const OPEN = ['new', 'contacted', 'interested', 'demo_sent'];
const PAGE = 200;

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function StatusBadge({ status }) {
  const style = LEAD_STATUSES.find((s) => s.value === status)?.style ?? 'bg-mist';
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{statusLabel(status)}</span>;
}

export default function LeadsTable({ leads, today }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('open');
  const [locality, setLocality] = useState('');
  const [noWebsite, setNoWebsite] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [sort, setSort] = useState('score');
  const [shown, setShown] = useState(PAGE);

  const localities = useMemo(() => [...new Set(leads.map((l) => l.locality).filter(Boolean))].sort(), [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = leads.filter((l) =>
      (!q || l.name.toLowerCase().includes(q) || l.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))) &&
      (status === 'all' || (status === 'open' ? OPEN.includes(l.status) : l.status === status)) &&
      (!locality || l.locality === locality) &&
      (!noWebsite || !l.website) &&
      (!dueOnly || (l.next_follow_up && l.next_follow_up <= today))
    );
    const by = {
      score: (a, b) => b.score - a.score || b.review_count - a.review_count,
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      followup: (a, b) => (a.next_follow_up ?? '9999').localeCompare(b.next_follow_up ?? '9999'),
      reviews: (a, b) => b.review_count - a.review_count,
    }[sort];
    return [...rows].sort(by);
  }, [leads, search, status, locality, noWebsite, dueOnly, sort, today]);

  function exportCsv() {
    const header = ['Name', 'Phone', 'WhatsApp', 'Website', 'Area', 'City', 'Rating', 'Reviews', 'Score', 'Status', 'Follow-up'];
    const lines = filtered.map((l) => {
      const wa = whatsappNumber(l.phone_intl);
      return [cleanName(l.name), l.phone, wa ? `https://wa.me/${wa}` : '', l.website, l.locality, l.city, l.rating ?? '', l.review_count, l.score, statusLabel(l.status), l.next_follow_up ?? ''].map(csvCell).join(',');
    });
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `leads-${today}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!leads.length) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
        <p className="font-semibold">No leads yet</p>
        <p className="mt-1 text-muted">Use “Find leads on Google” above. Start with one or two areas to see how it works.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="block">
          <span className="field-label">Search</span>
          <input className="field" type="search" placeholder="Name or phone" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} />
        </label>
        <label className="block">
          <span className="field-label">Status</span>
          <select className="field" value={status} onChange={(e) => { setStatus(e.target.value); setShown(PAGE); }}>
            <option value="open">Open (not won, lost or blocked)</option>
            <option value="all">All</option>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Area</span>
          <select className="field" value={locality} onChange={(e) => { setLocality(e.target.value); setShown(PAGE); }}>
            <option value="">All areas</option>
            {localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Sort by</span>
          <select className="field" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">Best prospects first</option>
            <option value="followup">Follow-up date</option>
            <option value="reviews">Most reviews</option>
            <option value="newest">Newest found</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-[15px]">
            <input type="checkbox" checked={noWebsite} onChange={(e) => { setNoWebsite(e.target.checked); setShown(PAGE); }} className="h-4 w-4 accent-brand" />
            No website only
          </label>
          <label className="flex items-center gap-2 text-[15px]">
            <input type="checkbox" checked={dueOnly} onChange={(e) => { setDueOnly(e.target.checked); setShown(PAGE); }} className="h-4 w-4 accent-brand" />
            Follow-up due
          </label>
          <button type="button" onClick={exportCsv} className="ml-auto text-sm font-medium text-brand underline" disabled={!filtered.length}>
            Download these {filtered.length} as CSV
          </button>
        </div>
      </div>

      <p className="text-sm text-muted">Showing {Math.min(shown, filtered.length)} of {filtered.length} matching leads ({leads.length} in total).</p>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line bg-mist text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Brokerage</th>
              <th scope="col" className="px-4 py-3 font-medium">Phone</th>
              <th scope="col" className="px-4 py-3 font-medium">Website</th>
              <th scope="col" className="px-4 py-3 font-medium">Google</th>
              <th scope="col" className="px-4 py-3 font-medium">Score</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.slice(0, shown).map((l) => {
              const due = l.next_follow_up && l.next_follow_up <= today && OPEN.includes(l.status);
              return (
                <tr key={l.id} className="relative hover:bg-mist/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/leads/${l.id}`} className="font-semibold after:absolute after:inset-0 hover:underline">{cleanName(l.name)}</Link>
                    <span className="block text-muted">{l.locality || l.city}</span>
                  </td>
                  <td className="px-4 py-3">
                    {l.phone || <span className="text-muted">None</span>}
                    {whatsappNumber(l.phone_intl) && <span className="ml-2 rounded bg-[#1E8E4E]/10 px-1.5 py-0.5 text-xs font-semibold text-[#177540]">WhatsApp</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.website ? <span className="text-muted">Has website</span> : <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800">No website</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{l.rating ? `${l.rating}★ (${l.review_count})` : '—'}</td>
                  <td className="px-4 py-3"><span className="font-display text-lg font-semibold">{l.score}</span><span className="text-muted">/7</span></td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className={`px-4 py-3 ${due ? 'font-semibold text-red-700' : 'text-muted'}`}>{l.next_follow_up ? formatDate(l.next_follow_up) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length > shown && (
        <button type="button" className="btn-outline w-full" onClick={() => setShown((s) => s + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more</button>
      )}
    </section>
  );
}
