'use client';

import { useState } from 'react';

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function EmiCalculator({ price }) {
  const [loan, setLoan] = useState(Math.round((price * 0.8) / 100000) * 100000 || 5000000);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);

  const r = rate / 12 / 100;
  const n = years * 12;
  const emi = r === 0 ? loan / n : (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const total = emi * n;

  return (
    <div className="rounded-xl border border-line p-5">
      <h2 className="font-display text-xl font-semibold">EMI calculator</h2>
      <p className="mt-1 text-sm text-muted">An estimate only. Your bank will confirm the final rate.</p>
      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="flex justify-between text-sm font-medium"><span>Loan amount</span><span>{inr(loan)}</span></span>
          <input type="range" className="mt-2 w-full accent-brand" min={500000} max={Math.max(price, 10000000)} step={100000} value={loan} onChange={(e) => setLoan(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="flex justify-between text-sm font-medium"><span>Interest rate</span><span>{rate.toFixed(1)}% a year</span></span>
          <input type="range" className="mt-2 w-full accent-brand" min={6} max={14} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="flex justify-between text-sm font-medium"><span>Loan tenure</span><span>{years} years</span></span>
          <input type="range" className="mt-2 w-full accent-brand" min={5} max={30} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </label>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-mist p-4">
        <div>
          <dt className="text-sm text-muted">Monthly EMI</dt>
          <dd className="font-display text-2xl font-semibold text-brand">{inr(emi)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Total interest</dt>
          <dd className="font-display text-2xl font-semibold">{inr(total - loan)}</dd>
        </div>
      </dl>
    </div>
  );
}
