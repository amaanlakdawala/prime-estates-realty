'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { site, PROPERTY_TYPES, BUY_BUDGETS, RENT_BUDGETS } from '@/lib/site';

export default function HeroSearch() {
  const router = useRouter();
  const [deal, setDeal] = useState('buy');
  const [locality, setLocality] = useState('');
  const [type, setType] = useState('');
  const [max, setMax] = useState('');
  const budgets = deal === 'rent' ? RENT_BUDGETS : BUY_BUDGETS;

  function onSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams({ deal });
    if (locality) params.set('locality', locality);
    if (type) params.set('type', type);
    if (max) params.set('max', max);
    router.push(`/properties?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-white p-4 text-basalt shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] sm:p-5">
      <div className="mb-4 inline-flex rounded-lg bg-stone p-1" role="radiogroup" aria-label="Buy or rent">
        {['buy', 'rent'].map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={deal === d}
            onClick={() => { setDeal(d); setMax(''); }}
            className={`rounded-md px-5 py-2 text-sm font-semibold ${deal === d ? 'bg-white text-teal shadow-sm' : 'text-muted'}`}
          >
            {d === 'buy' ? 'Buy' : 'Rent'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
        <label className="block">
          <span className="field-label">Locality</span>
          <select className="field" value={locality} onChange={(e) => setLocality(e.target.value)}>
            <option value="">All of {site.city}</option>
            {site.localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Property type</span>
          <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">{deal === 'rent' ? 'Max rent / month' : 'Max budget'}</span>
          <select className="field" value={max} onChange={(e) => setMax(e.target.value)}>
            <option value="">No limit</option>
            {budgets.map((b) => <option key={b.value} value={b.value}>Up to {b.label}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full lg:w-auto lg:px-8">Search</button>
        </div>
      </div>
    </form>
  );
}
