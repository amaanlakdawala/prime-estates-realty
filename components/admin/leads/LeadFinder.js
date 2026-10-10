'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchLeads } from '@/app/admin/leads/actions';
import { DEFAULT_CITY, DEFAULT_LOCALITIES, DEFAULT_QUERIES } from '@/lib/leads';

const splitList = (text) => text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

// Runs the Google search one page at a time from the browser, so a long run never hits a
// server time limit and can be stopped at any point. Leads already found are kept.
export default function LeadFinder({ used, limit, keyConfigured }) {
  const router = useRouter();
  const [open, setOpen] = useState(used === 0);
  const [city, setCity] = useState(DEFAULT_CITY);
  const [localities, setLocalities] = useState(DEFAULT_LOCALITIES.join(', '));
  const [queries, setQueries] = useState(DEFAULT_QUERIES.join(', '));
  const [pages, setPages] = useState(1);
  const [requireCity, setRequireCity] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [totals, setTotals] = useState(null);
  const [usedNow, setUsedNow] = useState(used);
  const stopRef = useRef(false);

  const areaList = splitList(localities);
  const queryList = splitList(queries);
  const maxRequests = Math.max(areaList.length, 1) * queryList.length * pages;
  const remaining = Math.max(0, limit - usedNow);

  async function run() {
    if (!city.trim() || !queryList.length) return;
    if (maxRequests > remaining && !window.confirm(`This search could use up to ${maxRequests} Google requests, but only ${remaining} are left this month. It will stop when the limit is reached. Continue?`)) return;

    stopRef.current = false;
    setRunning(true);
    setLog([]);
    const sum = { requests: 0, found: 0, added: 0 };
    setTotals({ ...sum });
    const areas = areaList.length ? areaList : [''];

    outer: for (const locality of areas) {
      for (const query of queryList) {
        let pageToken = null;
        for (let page = 1; page <= pages; page++) {
          if (stopRef.current) break outer;
          const result = await searchLeads({ city, locality, query, pageToken, requireCity });
          if (result.error) {
            setLog((l) => [...l, { error: true, text: result.error }]);
            if (result.limitReached || /GOOGLE_PLACES_API_KEY|refused/.test(result.error)) break outer;
            break;
          }
          sum.requests += 1;
          sum.found += result.found;
          sum.added += result.added;
          setTotals({ ...sum });
          setUsedNow(result.used);
          setLog((l) => [...l, { text: `${result.textQuery}${page > 1 ? ` (page ${page})` : ''}: ${result.found} found, ${result.added} new` }]);
          pageToken = result.nextPageToken;
          if (!pageToken) break;
        }
      }
    }

    setRunning(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-line bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left sm:px-6" aria-expanded={open}>
        <span>
          <span className="block text-lg font-semibold">Find leads on Google</span>
          <span className="text-sm text-muted">Search areas of a city for brokerages. Firms already found are updated, never duplicated.</span>
        </span>
        <span className="text-2xl text-muted" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="border-t border-line px-5 pb-6 pt-5 sm:px-6">
          {!keyConfigured && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              GOOGLE_PLACES_API_KEY isn&apos;t set. Add it to .env.local (and Netlify&apos;s environment variables for the live site).
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="field-label">City</span>
              <input className="field" value={city} onChange={(e) => setCity(e.target.value)} disabled={running} />
            </label>
            <label className="block">
              <span className="field-label">Search phrases</span>
              <input className="field" value={queries} onChange={(e) => setQueries(e.target.value)} disabled={running} />
              <p className="mt-1.5 text-sm text-muted">Separate with commas. Each is searched in every area.</p>
            </label>
            <label className="block lg:col-span-2">
              <span className="field-label">Areas ({areaList.length})</span>
              <textarea className="field min-h-[84px]" value={localities} onChange={(e) => setLocalities(e.target.value)} disabled={running} />
              <p className="mt-1.5 text-sm text-muted">Separate with commas. Google returns at most 60 results per search, so splitting a city into areas finds far more firms.</p>
            </label>
            <label className="block">
              <span className="field-label">Results per search</span>
              <select className="field" value={pages} onChange={(e) => setPages(Number(e.target.value))} disabled={running}>
                <option value={1}>Up to 20 (1 request)</option>
                <option value={2}>Up to 40 (2 requests)</option>
                <option value={3}>Up to 60 (3 requests)</option>
              </select>
            </label>
            <label className="flex items-center gap-3 self-end rounded-lg border border-line px-4 py-3 text-[15px]">
              <input type="checkbox" checked={requireCity} onChange={(e) => setRequireCity(e.target.checked)} disabled={running} className="h-4 w-4 accent-teal" />
              Only keep firms whose address is in {city || 'this city'}
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {running ? (
              <button type="button" className="btn-outline" onClick={() => { stopRef.current = true; }}>Stop</button>
            ) : (
              <button type="button" className="btn-primary" onClick={run} disabled={!keyConfigured || !queryList.length || remaining === 0}>Find leads</button>
            )}
            <p className="text-sm text-muted">
              Up to <span className="font-semibold text-basalt">{maxRequests}</span> Google requests · {remaining} left this month
            </p>
          </div>

          {totals && (
            <div className="mt-5 rounded-lg bg-stone p-4">
              <p className="text-sm font-semibold" role="status">
                {running ? 'Searching… ' : 'Done. '}
                {totals.found} found, {totals.added} new leads, {totals.requests} requests used
              </p>
              <ol className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-sm">
                {log.map((entry, i) => (
                  <li key={i} className={entry.error ? 'font-medium text-red-700' : 'text-muted'}>{entry.text}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
